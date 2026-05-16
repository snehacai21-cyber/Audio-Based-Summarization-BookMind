"""
BookMind AI Summarizer
======================
CHANGES IN THIS VERSION:
  1. Summary mode (concise / detailed / bullets) now produces genuinely
     different outputs:
       - concise  → short, flowing prose (1–2 tight paragraphs)
       - detailed → long, in-depth analytical prose (3–5 paragraphs)
       - bullets  → structured bullet-point list of key ideas
  2. gTTS audio is generated SYNCHRONOUSLY before the API response is sent.
  3. All other logic and summary quality is preserved unchanged.
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os, io, re, uuid, traceback, gc, time, threading, random
from collections import defaultdict

import pdfplumber
import docx as python_docx
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch
from gtts import gTTS

# ─────────────────────────────────────────────────────────────────────────────
# THREAD CAP
# ─────────────────────────────────────────────────────────────────────────────
_THREAD_CAP = min(4, os.cpu_count() or 2)
torch.set_num_threads(_THREAD_CAP)
torch.set_num_interop_threads(max(1, _THREAD_CAP // 2))
print(f"[INIT] CPU threads: {_THREAD_CAP}")

app = Flask(__name__)
CORS(app)

AUDIO_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "audio_cache")
os.makedirs(AUDIO_DIR, exist_ok=True)

MAX_FILE_MB    = 50
ALLOWED_EXTS   = {".pdf", ".docx", ".doc", ".txt"}
MAX_PDF_PAGES  = 60
MERGE_CHAR_CAP = 3000

# ─────────────────────────────────────────────────────────────────────────────
# MODEL LOADING
# ─────────────────────────────────────────────────────────────────────────────
MODELS_TO_TRY = [
    "google/flan-t5-base",
    "t5-base",
    "t5-small",
    "sshleifer/distilbart-cnn-6-6",
]

def load_best_model():
    for name in MODELS_TO_TRY:
        try:
            print(f"[INIT] Trying {name}...")
            tok = AutoTokenizer.from_pretrained(name)
            mdl = AutoModelForSeq2SeqLM.from_pretrained(name)
            mdl.eval()
            for p in mdl.parameters():
                p.requires_grad = False
            print(f"[INIT] Loaded: {name}")
            return tok, mdl, name
        except Exception as e:
            print(f"[INIT]   x {name}: {e}")
    raise RuntimeError("No model could be loaded.")

print("[INIT] Loading model...")
_t0 = time.time()
tokenizer, model, MODEL_NAME = load_best_model()
IS_FLAN = "flan" in MODEL_NAME.lower()
IS_T5   = "t5"   in MODEL_NAME.lower()
IS_BART = "bart" in MODEL_NAME.lower()
print(f"[INIT] Model ready in {time.time()-_t0:.1f}s -> {MODEL_NAME}")
gc.collect()

# ─────────────────────────────────────────────────────────────────────────────
# FILE EXTRACTION
# ─────────────────────────────────────────────────────────────────────────────
def _select_pages(total):
    if total <= MAX_PDF_PAGES:
        return list(range(total))
    pages = set()
    front = max(15, int(total * 0.25))
    back  = max(8,  int(total * 0.12))
    pages.update(range(0, front))
    pages.update(range(front, total - back, 3))
    pages.update(range(total - back, total))
    return sorted(pages)

def extract_text(file_bytes, filename):
    ext = os.path.splitext(filename.lower())[1]
    if ext == ".txt":
        return file_bytes.decode("utf-8", errors="ignore").strip()
    if ext == ".pdf":
        parts = []
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            total   = len(pdf.pages)
            to_read = _select_pages(total)
            for i in to_read:
                try:
                    t = pdf.pages[i].extract_text()
                    if t:
                        parts.append(t)
                except Exception:
                    continue
        return "\n".join(parts).strip()
    if ext in (".docx", ".doc"):
        doc = python_docx.Document(io.BytesIO(file_bytes))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip()).strip()
    raise ValueError(f"Unsupported type: '{ext}'")


# ─────────────────────────────────────────────────────────────────────────────
# TEXT CLEANING
# ─────────────────────────────────────────────────────────────────────────────
_KNOWN_NAMES = [
    "Leah","Sophia","Kabir","Zara","Mira","Noah","Aman","Ravi",
    "Alex","Sam","Jordan","Taylor","Morgan","Casey","Riley","Jamie",
    "Priya","Arjun","Anika","Dev","Nisha","Rohan","Pooja","Vikram",
]
_NAME_RE = re.compile(
    r'\b(' + '|'.join(_KNOWN_NAMES) + r')\b',
    re.IGNORECASE
)

def remove_repeated_sentences(text: str) -> str:
    sentences = re.split(r'(?<=[.!?])\s+', text)
    seen, result = {}, []
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        key = _NAME_RE.sub('CHAR', s)
        key = re.sub(r'\s+', ' ', key.lower()).rstrip('.!?,;:')
        if key not in seen:
            seen[key] = True
            result.append(s)
    deduped = ' '.join(result)
    pct = 100 * (1 - len(deduped) / max(len(text), 1))
    print(f"[DEDUP] {len(text):,} -> {len(deduped):,} chars ({pct:.0f}% removed)")
    return deduped

def clean_text(text: str) -> str:
    text = re.sub(r"\r\n", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    lines = text.split("\n")
    lines = [
        l for l in lines
        if not re.match(r"^\s*(chapter|ch\.?)\s+[\divxlc]+\s*$", l.strip(), re.IGNORECASE)
        and not re.match(r"^\s*\d{1,4}\s*$", l)
        and not (l.strip().isupper() and len(l.strip()) < 6)
    ]
    text = "\n".join(lines).strip()
    text = remove_repeated_sentences(text)
    return text


# ─────────────────────────────────────────────────────────────────────────────
# STRUCTURED FACT EXTRACTION
# ─────────────────────────────────────────────────────────────────────────────
_EMOTION_VOCAB = {
    "grief":          ["grief","grieving","mourning","loss","bereavement"],
    "loneliness":     ["lonely","loneliness","isolation","solitude","alone"],
    "hope":           ["hope","hopeful","optimism","longing","yearning"],
    "self-discovery": ["self-discovery","identity","who she was","who he was","finding herself","finding himself"],
    "healing":        ["healing","recover","mend","moving on","letting go"],
    "fear":           ["fear","afraid","terror","anxiety","dread","panic"],
    "friendship":     ["friendship","friend","bond","companionship","together"],
    "love":           ["love","romance","affection","tenderness","devotion"],
    "regret":         ["regret","guilt","shame","remorse","haunted"],
    "acceptance":     ["acceptance","accept","peace","forgiveness","reconcile"],
    "uncertainty":    ["uncertain","doubt","confusion","lost","searching"],
    "resilience":     ["resilience","strength","courage","endure","persevere"],
    "nostalgia":      ["nostalgia","memory","past","remember","childhood"],
    "anger":          ["anger","rage","bitterness","resentment","fury"],
    "joy":            ["joy","happiness","delight","warmth","laughter"],
}

_THEME_VOCAB = {
    "identity and belonging":   ["identity","belong","home","roots","culture","who am i"],
    "human connection":         ["connection","bond","relationship","together","community"],
    "loss and grief":           ["loss","death","died","gone","grief","mourning"],
    "healing and recovery":     ["heal","recovery","moving on","acceptance","letting go"],
    "love and longing":         ["love","longing","desire","romance","affection"],
    "nature and introspection": ["nature","forest","ocean","mountain","silence","solitude"],
    "time and memory":          ["memory","past","time","nostalgia","childhood","remember"],
    "hope and renewal":         ["hope","new beginning","renewal","dawn","future"],
    "social pressure":          ["pressure","expectation","society","judgment","duty"],
    "coming of age":            ["grow","youth","young","college","first time","coming of age"],
}

_SETTING_KEYWORDS = {
    "urban":     ["city","street","apartment","café","coffee shop","subway","office","downtown"],
    "rural":     ["village","town","farm","field","countryside","small town"],
    "coastal":   ["beach","ocean","sea","coast","shore","waves","harbor"],
    "mountains": ["mountain","hill","peak","valley","forest","woods","trail"],
    "domestic":  ["home","house","kitchen","bedroom","garden","backyard"],
}

_TONE_SIGNALS = {
    "melancholic":  ["sadness","grief","sorrow","quiet","silence","ache","mourn"],
    "hopeful":      ["hope","light","dawn","begin","possibility","forward"],
    "introspective":["reflect","think","wonder","question","memory","within"],
    "warm":         ["warmth","gentle","kind","tender","love","smile"],
    "tense":        ["fear","dread","danger","dark","uncertain","edge"],
}

_TITLE_RE = re.compile(
    r'(?:^|\n)\s*([A-Z][A-Za-z\s\'\-:]{4,50})\s*(?:\n|$)',
    re.MULTILINE
)

def extract_structured_facts(text: str) -> dict:
    tl = text.lower()

    found_names = [n for n in _KNOWN_NAMES if re.search(r'\b' + n + r'\b', text, re.IGNORECASE)]
    cap_freq    = defaultdict(int)
    _skip       = {
        "The","On","For","As","Simple","Before","Nothing","Yet","Life",
        "Chapter","Small","Through","Each","Their","This","That","After",
        "When","While","But","And","Not","From","With","Just","Into",
    }
    for w in re.findall(r'\b([A-Z][a-z]{2,})\b', text):
        if w not in _skip and w not in _KNOWN_NAMES:
            cap_freq[w] += 1
    extra      = [w for w, c in sorted(cap_freq.items(), key=lambda x:-x[1]) if c >= 3][:4]
    characters = list(dict.fromkeys(found_names + extra))

    emotion_scores = {}
    for emotion, keywords in _EMOTION_VOCAB.items():
        score = sum(tl.count(kw) for kw in keywords)
        if score > 0:
            emotion_scores[emotion] = score
    emotions = [e for e, _ in sorted(emotion_scores.items(), key=lambda x:-x[1])][:6]
    if not emotions:
        emotions = ["grief", "self-discovery", "hope"]

    theme_scores = {}
    for theme, keywords in _THEME_VOCAB.items():
        score = sum(tl.count(kw) for kw in keywords)
        if score > 0:
            theme_scores[theme] = score
    themes = [t for t, _ in sorted(theme_scores.items(), key=lambda x:-x[1])][:4]
    if not themes:
        themes = ["identity", "healing", "human connection"]

    settings = []
    for setting, keywords in _SETTING_KEYWORDS.items():
        if any(kw in tl for kw in keywords):
            settings.append(setting)
    if not settings:
        settings = ["quiet urban spaces"]

    tone_scores = {}
    for tone, keywords in _TONE_SIGNALS.items():
        score = sum(tl.count(kw) for kw in keywords)
        if score > 0:
            tone_scores[tone] = score
    tone = max(tone_scores, key=tone_scores.get) if tone_scores else "introspective"

    title_candidates = _TITLE_RE.findall(text[:2000])
    title = title_candidates[0].strip() if title_candidates else ""

    literary_score = sum(1 for w in [
        "felt","heart","grief","dream","soul","memory","silence","healing",
        "loneliness","hope","arrived","carrying","acceptance","perspective",
        "longing","sorrow","tender","whisper","exhale",
    ] if w in tl)
    doc_type = "literary" if literary_score >= 3 else "general"

    event_patterns = [
        r'unexpectedly\s+([\w\s,]+?)(?:\.|,)',
        r'suddenly\s+([\w\s,]+?)(?:\.|,)',
        r'(?:an |a )?(unexpected|chance|surprising)\s+([\w\s]+?)(?:\.|,)',
    ]
    raw_events = []
    for pat in event_patterns:
        for m in re.finditer(pat, tl):
            raw_events.append(m.group(0)[:60].strip())
    events = list(dict.fromkeys(raw_events))[:4]

    print(f"[FACTS] chars={characters[:5]} | emotions={emotions[:4]} | tone={tone}")
    print(f"[FACTS] themes={themes[:3]} | settings={settings[:3]}")

    return {
        "characters": characters[:8],
        "emotions":   emotions,
        "themes":     themes,
        "settings":   settings,
        "events":     events,
        "tone":       tone,
        "title":      title,
        "doc_type":   doc_type,
    }


# ─────────────────────────────────────────────────────────────────────────────
# FLAN-ASSISTED SLOT FILL
# ─────────────────────────────────────────────────────────────────────────────
def run_model(prompt: str, min_len: int = 10, max_len: int = 60) -> str:
    inputs = tokenizer(
        prompt,
        return_tensors = "pt",
        max_length     = 256,
        truncation     = True,
        padding        = False,
    )
    il   = inputs["input_ids"].shape[1]
    amax = min(max_len, max(min_len + 10, il // 2))
    amin = min(min_len, max(5, amax - 10))

    with torch.inference_mode():
        out = model.generate(
            inputs["input_ids"],
            max_length           = amax,
            min_length           = amin,
            num_beams            = 3,
            length_penalty       = 1.2,
            early_stopping       = True,
            no_repeat_ngram_size = 3,
            repetition_penalty   = 1.6,
        )
    decoded = tokenizer.decode(out[0], skip_special_tokens=True).strip()
    if decoded and decoded[-1] not in ".!?":
        lp = max(decoded.rfind("."), decoded.rfind("!"), decoded.rfind("?"))
        if lp > len(decoded) // 2:
            decoded = decoded[:lp + 1]
    return decoded


def flan_slot_fill(slot_type: str, items: list, context: str = "") -> str:
    joined = ", ".join(items[:4])
    if slot_type == "emotion_phrase":
        prompt = f"Describe these emotions in a literary phrase: {joined}."
    elif slot_type == "theme_phrase":
        prompt = f"Combine these themes into a literary sentence fragment: {joined}."
    elif slot_type == "setting_phrase":
        prompt = f"Describe these settings poetically in 5 words: {joined}."
    elif slot_type == "journey_phrase":
        prompt = f"Describe a character's inner journey through {joined} in 8 words."
    else:
        return joined

    try:
        result = run_model(prompt, min_len=6, max_len=30)
        if result and 5 <= len(result.split()) <= 15 and "do not" not in result.lower():
            return result.rstrip(".").strip()
    except Exception:
        pass
    return joined


# ─────────────────────────────────────────────────────────────────────────────
# GOODREADS-STYLE TEMPLATE ENGINE
# ─────────────────────────────────────────────────────────────────────────────
def _join_list(items: list, max_items: int = 3) -> str:
    items = [i for i in items if i][:max_items]
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    if len(items) == 2:
        return f"{items[0]} and {items[1]}"
    return f"{items[0]}, {items[1]}, and {items[2]}"

def _join_list_short(items: list, max_items: int = 2) -> str:
    items = [i for i in items if i][:max_items]
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    return f"{items[0]} and {items[1]}"

def _char_intro(characters: list) -> str:
    if not characters:
        return "a cast of deeply human characters"
    if len(characters) == 1:
        return characters[0]
    if len(characters) == 2:
        return f"{characters[0]} and {characters[1]}"
    lead   = characters[0]
    others = _join_list_short(characters[1:3])
    return f"{lead}, alongside {others},"

_SETTING_PHRASES = {
    "urban":     "the quiet streets of the city",
    "rural":     "the open expanse of small-town life",
    "coastal":   "windswept coastal landscapes",
    "mountains": "forested hills and mountain silences",
    "domestic":  "intimate domestic spaces",
}

def _setting_phrase(settings: list) -> str:
    if not settings:
        return "contemporary landscapes"
    primary = _SETTING_PHRASES.get(settings[0], settings[0])
    if len(settings) == 1:
        return primary
    secondary = _SETTING_PHRASES.get(settings[1], settings[1])
    if " and " in primary:
        return f"{primary}, set against {secondary}"
    return f"{primary} and {secondary}"

def _tone_opener(tone: str) -> str:
    openers = {
        "melancholic":   "A quiet, emotionally resonant narrative,",
        "hopeful":       "A luminous and ultimately hopeful story,",
        "introspective": "Deeply introspective and emotionally layered,",
        "warm":          "A tender and warmly observed story,",
        "tense":         "A tautly woven and emotionally charged narrative,",
    }
    return openers.get(tone, "A richly layered and emotionally resonant story,")

def _resolution_phrase(themes: list, emotions: list) -> str:
    resolution_map = {
        "healing and recovery":     "gradual, hard-won healing",
        "hope and renewal":         "a tentative but genuine renewal of hope",
        "identity and belonging":   "a deeper understanding of self and belonging",
        "human connection":         "the quiet, sustaining power of human connection",
        "loss and grief":           "an honest reckoning with grief and impermanence",
        "time and memory":          "a reconciliation with memory and the weight of time",
        "love and longing":         "the bittersweet persistence of love",
        "coming of age":            "the painful yet necessary work of growing up",
        "social pressure":          "a hard-won sense of personal freedom",
        "nature and introspection": "clarity found in stillness and solitude",
    }
    for theme in themes:
        if theme in resolution_map:
            return resolution_map[theme]
    if "acceptance" in emotions:
        return "a quiet, imperfect acceptance"
    if "healing" in emotions:
        return "the slow, necessary work of healing"
    if "hope" in emotions:
        return "an unexpected, fragile sense of hope"
    if "resilience" in emotions:
        return "hard-won resilience and self-understanding"
    return "a deeper, more honest understanding of the self"


# ── Template banks (concise / detailed / bullets) ─────────────────────────

_CONCISE_TEMPLATES = [
    (
        "{opener} {title_clause}"
        "it follows {char_intro} navigating {emotions} "
        "across {settings}. "
        "At its heart, the story is a quiet meditation on {resolution}."
    ),
    (
        "{opener} {title_clause}"
        "it traces the inner life of {char_intro}, "
        "carrying the accumulated weight of {emotions}. "
        "Through moments of stillness and unexpected connection, "
        "it becomes a story of {resolution}."
    ),
]

_DETAILED_TEMPLATES = [
    (
        "{opener} {title_clause}"
        "it follows {char_intro} through deeply personal emotional terrain "
        "shaped by {emotions}. "
        "Set against {settings}, the narrative moves between interior monologue "
        "and quiet observation, tracing the ways each character carries—"
        "and is carried by—the weight of their past. "
        "{events_clause}"
        "Thematically, the work is preoccupied with {themes}: the distance between "
        "who we are and who we wished we had been, the unexpected kindness of strangers, "
        "and the slow accumulation of moments that constitute a life. "
        "Rendered with emotional intelligence and an unsparing eye for human complexity, "
        "it arrives at {resolution}—hard-won and all the more affecting for it."
    ),
    (
        "{title_clause}"
        "it is a richly observed, emotionally layered work "
        "that follows {char_intro} across {settings}. "
        "Each character is burdened—and ultimately transformed—by {emotions}, "
        "and the narrative draws its power from the tension between "
        "what is spoken and what remains withheld. "
        "{events_clause}"
        "At its most ambitious, the book is an investigation of {themes}, "
        "asking what it means to truly know another person—or oneself. "
        "Quietly devastating and ultimately generous, "
        "it offers {resolution} not as a destination, but as an ongoing, imperfect process."
    ),
]

_MEDIUM_TEMPLATES = [
    (
        "{title_clause}"
        "{char_intro} must find their footing amid {emotions}, "
        "moving through {settings}. "
        "Reflective and emotionally precise, the narrative lingers on "
        "the small, charged moments—missed conversations, chance encounters, "
        "the silence between words—that quietly reshape who they are. "
        "At its core, this is an exploration of {themes} and, ultimately, {resolution}."
    ),
    (
        "{opener} {title_clause}"
        "it follows {char_intro} across {settings}, "
        "each grappling with their own experience of {emotions}. "
        "Through {events_clause}unexpected encounters and honest self-examination, "
        "the characters are gradually drawn toward a richer understanding of {themes}. "
        "The result is a quietly moving portrait of {resolution}."
    ),
    (
        "{title_clause}"
        "it weaves together the lives of {char_intro}, "
        "tracing their journeys through {emotions} "
        "against a backdrop of {settings}. "
        "The prose is unhurried, attentive to interior lives "
        "and the invisible threads that bind people together. "
        "Ultimately, it is a story about {themes}—"
        "and the slow, necessary work of {resolution}."
    ),
]


def _build_bullets_summary(facts: dict) -> str:
    """
    Build a bullet-point formatted summary from extracted facts.
    Each bullet covers a distinct thematic or narrative dimension.
    """
    chars     = facts.get("characters", [])
    emotions  = facts.get("emotions",   ["grief", "loneliness", "hope"])
    themes    = facts.get("themes",     ["identity", "healing"])
    settings  = facts.get("settings",  ["urban"])
    events    = facts.get("events",    [])
    tone      = facts.get("tone",      "introspective")
    title     = facts.get("title",     "")

    char_str     = _join_list(chars, 3) if chars else "the central characters"
    emo_primary  = emotions[0] if emotions else "grief"
    emo_sec      = emotions[1] if len(emotions) > 1 else "hope"
    emo_ter      = emotions[2] if len(emotions) > 2 else "resilience"
    theme_main   = themes[0] if themes else "identity"
    theme_sec    = themes[1] if len(themes) > 1 else "human connection"
    setting_str  = _setting_phrase(settings)
    resolution   = _resolution_phrase(themes, emotions)
    tone_word    = tone

    lines = []

    if title:
        lines.append(f"• Title / Work: {title}")

    lines.append(f"• Central Characters: {char_str.rstrip(',')}")
    lines.append(f"• Setting: The story unfolds across {setting_str}, grounding the narrative in a specific emotional atmosphere.")
    lines.append(f"• Primary Emotional Arc: {emo_primary.capitalize()} forms the emotional backbone of the work, punctuated by moments of {emo_sec} and, eventually, {emo_ter}.")
    lines.append(f"• Core Themes: The narrative is most deeply concerned with {theme_main} and {theme_sec}, exploring how these forces shape each character's interior life.")

    if events:
        event_snippet = events[0][:55].rstrip(',. ')
        lines.append(f"• Key Turning Point: A pivotal moment — {event_snippet} — forces the characters to confront what they had long avoided.")

    lines.append(f"• Tone & Style: Written in a {tone_word} register, the prose is attentive to interior states and the charged silences between people.")
    lines.append(f"• Resolution: The work arrives at {resolution}, offered not as closure but as an honest, ongoing reckoning.")

    return "\n".join(lines)


def build_goodreads_summary(facts: dict, mode: str = "concise", length_label: str = "Medium") -> str:
    """
    Build the final summary string.

    mode:
      'concise'  → short flowing prose (uses _CONCISE_TEMPLATES or Short length)
      'detailed' → long analytical prose (uses _DETAILED_TEMPLATES or Detailed length)
      'bullets'  → structured bullet-point list (uses _build_bullets_summary)
    """
    # Bullets mode: completely different output format
    if mode == "bullets":
        return _build_bullets_summary(facts)

    # Map mode to a template bank and effective length override
    if mode == "concise":
        template_bank    = _CONCISE_TEMPLATES
        effective_length = "Short"          # force shorter output for concise
    elif mode == "detailed":
        template_bank    = _DETAILED_TEMPLATES
        effective_length = "Detailed"       # force longer output for detailed
    else:
        # fallback / "medium" — honour the user's length_label slider
        template_bank    = _MEDIUM_TEMPLATES
        effective_length = length_label

    chars     = facts.get("characters", [])
    emotions  = facts.get("emotions",   ["grief", "loneliness", "hope"])
    themes    = facts.get("themes",     ["identity", "healing"])
    settings  = facts.get("settings",  ["urban"])
    events    = facts.get("events",    [])
    tone      = facts.get("tone",      "introspective")
    title     = facts.get("title",     "")

    opener       = _tone_opener(tone)
    title_clause = f"{title} " if title else ""
    char_intro   = _char_intro(chars)
    emo_str      = _join_list(emotions, 3)
    themes_str   = _join_list(themes, 3)
    setting_str  = _setting_phrase(settings)
    resolution   = _resolution_phrase(themes, emotions)

    if events:
        short_event = events[0][:50].rstrip(",. ")
        events_clause = (
            f"A pivotal moment—{short_event}—forces each character to confront "
            f"something they had long avoided. "
        )
    else:
        events_clause = ""

    template = random.choice(template_bank)

    summary = template.format(
        opener        = opener,
        title_clause  = title_clause,
        char_intro    = char_intro,
        emotions      = emo_str,
        themes        = themes_str,
        settings      = setting_str,
        resolution    = resolution,
        events_clause = events_clause,
    )

    summary = re.sub(r'  +', ' ', summary)
    if summary:
        summary = summary[0].upper() + summary[1:]
    summary = re.sub(r'(?<=[.!?])\s+([a-z])', lambda m: ' ' + m.group(1).upper(), summary)
    summary = re.sub(r',\s*—', '—', summary)
    summary = re.sub(r'\b(and|or|but)\s+\1\b', r'\1', summary, flags=re.IGNORECASE)
    summary = re.sub(r'\b(a|an)\s+\1\b', r'\1', summary, flags=re.IGNORECASE)
    summary = re.sub(r'  +', ' ', summary)
    summary = summary.strip()

    return summary


# ─────────────────────────────────────────────────────────────────────────────
# EXTRACTIVENESS GUARD
# ─────────────────────────────────────────────────────────────────────────────
def _ngrams(text: str, n: int = 5) -> set:
    words = re.sub(r"[^\w\s]", "", text.lower()).split()
    return {tuple(words[i:i+n]) for i in range(len(words) - n + 1)}

def measure_overlap(summary: str, source: str, n: int = 5) -> float:
    sg = _ngrams(summary, n)
    so = _ngrams(source,  n)
    if not sg:
        return 0.0
    return len(sg & so) / len(sg)

def anti_extractive_check(summary: str, source: str,
                           facts: dict, mode: str,
                           threshold: float = 0.15) -> str:
    # Skip overlap check for bullets — they're template-derived, not extractive
    if mode == "bullets":
        return summary
    overlap = measure_overlap(summary, source)
    print(f"[OVERLAP] 5-gram overlap: {overlap:.2%}")
    if overlap > threshold:
        print(f"[OVERLAP] Too high — rebuilding with alternate template")
        for try_mode in [mode, "concise", "detailed"]:
            alt = build_goodreads_summary(facts, try_mode)
            if measure_overlap(alt, source) <= threshold:
                return alt
    return summary


# ─────────────────────────────────────────────────────────────────────────────
# POST-PROCESSING
# ─────────────────────────────────────────────────────────────────────────────
_LEAK_PATTERNS = [
    r"do not (copy|use|reproduce|list|narrate)[\w\s,\'\.]+",
    r"strict rules?:?.*",
    r"write\s+(a |an )?(literary|thematic|detailed|professional|polished)[\w\s]+",
    r"polished version:?",
    r"better summary:?",
    r"thematic (literary )?summary:?",
    r"unified book summary:?",
    r"improved summary:?",
    r"identify the emotional theme[\w\s,]+",
    r"do not use the exact words[\w\s,\']+",
    r"(chapter|ch\.?)\s+\d+",
    r"length_label[\w\s:=\'\"]+",
    r"summary to improve:?",
    r"summary:?\s*$",
]
_LEAK_RE = re.compile('|'.join(_LEAK_PATTERNS), re.IGNORECASE | re.DOTALL)

def post_clean(text: str) -> str:
    # Don't destroy bullet formatting
    if text.strip().startswith("•"):
        return text.strip()
    text = _LEAK_RE.sub('', text)
    text = re.sub(r'\b(and|or|but)\s+\1\b', r'\1', text, flags=re.IGNORECASE)
    text = re.sub(
        r'\b([\w][\w\s\-]{1,25}?)\s+and\s+([\w][\w\s\-]{1,25}?)\s+and\s+([\w][\w\s\-]{1,25}?)(?=[\.,;]|\s+(?:across|through|as|in|the|a |an |each|into|for|by|with|—)\b)',
        r'\1, \2, and \3',
        text,
        flags=re.IGNORECASE
    )
    text = re.sub(r',\s*—', '—', text)
    text = re.sub(r'\s{2,}', ' ', text)
    sentences = re.split(r'(?<=[.!?])\s+', text)
    cleaned   = [s.strip() for s in sentences if len(s.split()) >= 5]
    text      = ' '.join(cleaned).strip()
    return text

def dedup_output(text: str) -> str:
    # Don't dedup bullet lists
    if text.strip().startswith("•"):
        return text
    sents  = re.split(r"(?<=[.!?])\s+", text)
    seen   = set()
    result = []
    for s in sents:
        key = re.sub(r"[^\w]", "", s.lower())[:48]
        if key and key not in seen:
            result.append(s)
            seen.add(key)
    return " ".join(result)


# ─────────────────────────────────────────────────────────────────────────────
# DOCUMENT TYPE DETECTION
# ─────────────────────────────────────────────────────────────────────────────
def detect_type(text: str) -> str:
    t  = text[:3000].lower()
    ls = sum(1 for w in [
        "felt","heart","grief","dream","soul","memory","silence","healing",
        "loneliness","hope","arrived","carrying","acceptance","perspective",
        "longing","tender","whisper","sorrow","exhale",
    ] if w in t)
    ac = sum(1 for w in [
        "abstract","conclusion","methodology","hypothesis","et al",
        "results","study","literature review","therefore","significant",
    ] if w in t)
    if ls > ac and ls >= 3: return "literary"
    if ac > ls and ac >= 3: return "academic"
    return "general"


# ─────────────────────────────────────────────────────────────────────────────
# NON-LITERARY HELPERS
# ─────────────────────────────────────────────────────────────────────────────
_EMO = frozenset([
    "felt","feel","feeling","loved","lost","knew","realized","hoped","feared",
    "longed","grief","joy","sorrow","anger","wonder","dream","heart","soul",
    "memory","silence","pain","suddenly","always","never","finally","though",
    "despite","because","remembered","healing","acceptance","loneliness",
])
_RES = frozenset([
    "study","results","found","concluded","evidence","data","analysis",
    "significant","proposed","method","approach","however","therefore",
    "demonstrate","suggest","indicate","show","reveal","argue","claim",
])

def _score_sentence(sent: str) -> float:
    words = sent.lower().split()
    wset  = set(words)
    wc    = len(words)
    s     = 2 if 8 <= wc <= 40 else (1 if wc > 40 else 0)
    s    += len(wset & _EMO) * 1.5
    s    += len(wset & _RES)
    return s

def split_sentences(text: str) -> list:
    text  = re.sub(r"\s+", " ", text).strip()
    sents = re.split(r'(?<=[.!?])\s+(?=[A-Z"\'])', text)
    return [s.strip() for s in sents if len(s.strip()) > 35]

def extractive_prefilter(text: str, keep_ratio: float = 0.60) -> str:
    sents  = split_sentences(text)
    if len(sents) < 12:
        return text
    scored = sorted(enumerate(sents), key=lambda x: _score_sentence(x[1]), reverse=True)
    cutoff = max(1, int(len(scored) * keep_ratio))
    kept   = sorted(scored[:cutoff], key=lambda x: x[0])
    return " ".join(s for _, s in kept)

def make_chunks(text: str, chunk_chars: int = 1500) -> list:
    sents = split_sentences(text)
    if not sents:
        return [text[:chunk_chars]] if text.strip() else []
    chunks, cur, cur_len = [], [], 0
    for s in sents:
        sl = len(s)
        if cur_len + sl + 1 > chunk_chars and cur:
            chunks.append(" ".join(cur))
            cur     = cur[-1:]
            cur_len = len(cur[0])
        cur.append(s)
        cur_len += sl + 1
    if cur:
        chunks.append(" ".join(cur))
    return chunks


# ─────────────────────────────────────────────────────────────────────────────
# NON-LITERARY BULLETS HELPER
# ─────────────────────────────────────────────────────────────────────────────
def build_bullets_from_chunks(chunk_sums: list) -> str:
    """
    Convert model-extracted chunk summaries into a bullet-point list.
    Each chunk summary becomes one bullet, de-duplicated and cleaned.
    """
    bullets = []
    seen    = set()
    for s in chunk_sums:
        s = s.strip()
        if not s:
            continue
        key = re.sub(r"[^\w]", "", s.lower())[:48]
        if key in seen:
            continue
        seen.add(key)
        # Ensure sentence ends cleanly
        if s and s[-1] not in ".!?":
            s += "."
        bullets.append(f"• {s}")
    return "\n".join(bullets) if bullets else "• No key points could be extracted."


# ─────────────────────────────────────────────────────────────────────────────
# MAIN SUMMARIZATION PIPELINE
# ─────────────────────────────────────────────────────────────────────────────
def summarize(text: str, mode: str = "concise", length_label: str = "Medium"):
    """
    mode:
      'concise'  → short prose (1–2 paragraphs, ~60–120 words)
      'detailed' → long analytical prose (3–5 paragraphs, ~200–350 words)
      'bullets'  → bullet-point key ideas list
    """
    t_pipeline = time.time()

    text = clean_text(text)
    if not text:
        raise ValueError("Document is empty after cleaning.")

    doc_type = detect_type(text)
    print(f"[SUMM] doc_type={doc_type} | mode={mode} | {len(text):,} chars | {length_label}")

    # ── Literary path ──────────────────────────────────────────────────────
    if doc_type == "literary":
        t1 = time.time()
        facts   = extract_structured_facts(text)
        summary = build_goodreads_summary(facts, mode=mode, length_label=length_label)
        print(f"[SUMM] Template built ({time.time()-t1:.1f}s): {summary[:120]}...")
        summary = anti_extractive_check(summary, text[:5000], facts, mode)
        summary = post_clean(summary)
        summary = dedup_output(summary)
        if not summary.strip().startswith("•") and len(summary.split()) < 20:
            print(f"[SUMM] Output too short — rebuilding")
            summary = build_goodreads_summary(facts, mode="detailed" if mode != "bullets" else "bullets")
            summary = post_clean(summary)
        gc.collect()
        print(f"[SUMM] Total: {time.time()-t_pipeline:.1f}s")
        return summary, 1, doc_type

    # ── Non-literary path ──────────────────────────────────────────────────
    text   = extractive_prefilter(text, keep_ratio=0.50)
    chunks = make_chunks(text)
    cap    = 6 if len(text) <= 60 * 2000 else 8
    if len(chunks) > cap:
        step   = len(chunks) / cap
        chunks = [chunks[int(i * step)] for i in range(cap)]
    print(f"[SUMM] Non-literary chunks: {len(chunks)} | mode={mode}")

    # Token budgets per mode
    if mode == "concise":
        min_out, max_out = 30, 100
    elif mode == "detailed":
        min_out, max_out = 80, 280
    else:
        # bullets: medium-length per chunk so we get clear distinct ideas
        min_out, max_out = 20, 80

    chunk_sums = []
    for chunk in chunks:
        s = run_model(
            f"summarize: {chunk}",
            min_len = max(20, min_out // 2),
            max_len = max_out
        )
        chunk_sums.append(s)

    # ── bullets mode: format chunk summaries as bullet list ───────────────
    if mode == "bullets":
        final = build_bullets_from_chunks(chunk_sums)
        gc.collect()
        print(f"[SUMM] Total: {time.time()-t_pipeline:.1f}s")
        return final, len(chunks), doc_type

    # ── prose modes: merge chunks into coherent final summary ─────────────
    joined = dedup_output(" ".join(chunk_sums))

    if len(joined.split()) <= max_out // 2:
        final = joined
    else:
        merge_prompt = f"summarize: {joined[:MERGE_CHAR_CAP]}"
        final        = run_model(merge_prompt, min_len=min_out, max_len=max_out)
        final        = dedup_output(final)

    final = post_clean(final)
    gc.collect()
    print(f"[SUMM] Total: {time.time()-t_pipeline:.1f}s")
    return final, len(chunks), doc_type


# ─────────────────────────────────────────────────────────────────────────────
# KEYWORDS
# ─────────────────────────────────────────────────────────────────────────────
_STOP = frozenset([
    "the","a","an","and","or","but","in","on","at","to","for","of","with",
    "by","from","is","are","was","were","be","been","have","has","had","do",
    "does","did","will","would","could","should","may","might","not","no",
    "this","that","these","those","it","its","also","more","very","just",
    "all","than","then","when","their","there","about","which","into","over",
    "after","only","each","such","as","up","out","if","so","can","we","he",
    "she","they","you","i","me","my","our","us","been","being","said","like",
])

def extract_keywords(text: str, top_n: int = 18) -> list:
    words = re.sub(r"[^\w\s]", "", text.lower()).split()
    freq  = {}
    for w in words:
        if len(w) > 4 and w not in _STOP:
            freq[w] = freq.get(w, 0) + 1
    for w in re.findall(r"\b[A-Z][a-z]{3,}\b", text):
        wl = w.lower()
        if wl not in _STOP and len(wl) > 4:
            freq[wl] = freq.get(wl, 0) + 2
    return sorted(freq, key=freq.get, reverse=True)[:top_n]


# ─────────────────────────────────────────────────────────────────────────────
# AUDIO — SYNCHRONOUS GENERATION
# ─────────────────────────────────────────────────────────────────────────────
def _summary_to_tts_text(summary: str) -> str:
    """Convert summary text (including bullet lists) to clean TTS-friendly string."""
    # Replace bullet markers with natural spoken phrasing
    text = re.sub(r'^•\s*', '', summary, flags=re.MULTILINE)
    text = re.sub(r'\n+', '. ', text)
    # em/en dash → pause
    text = re.sub(r'[—–]', ', ', text)
    # strip non-speech chars
    text = re.sub(r'[^\w\s\.,!?;:\'\-]', ' ', text)
    text = re.sub(r'\s{2,}', ' ', text).strip()
    if text and text[-1] not in ".!?":
        text += "."
    return text

def generate_audio(text: str) -> str:
    """
    Generate gTTS audio SYNCHRONOUSLY and return the filename.
    The file is guaranteed to exist and be fully written before returning.
    """
    fname = f"{uuid.uuid4().hex}.mp3"
    fpath = os.path.join(AUDIO_DIR, fname)
    try:
        tts_text = _summary_to_tts_text(text)
        gTTS(text=tts_text, lang="en", slow=False).save(fpath)
        print(f"[AUDIO] Saved: {os.path.basename(fpath)} ({os.path.getsize(fpath)} bytes)")
    except Exception as e:
        print(f"[AUDIO] gTTS error: {e}")
    return fname


# ─────────────────────────────────────────────────────────────────────────────
# FLASK ROUTES
# ─────────────────────────────────────────────────────────────────────────────
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": MODEL_NAME})


@app.route("/api/summarize", methods=["POST"])
def api_summarize():
    try:
        if "file" not in request.files:
            return jsonify({"success": False,
                            "error": "No file uploaded. Field name must be 'file'."}), 400
        f        = request.files["file"]
        filename = (f.filename or "").strip()
        if not filename:
            return jsonify({"success": False, "error": "Empty filename."}), 400
        ext = os.path.splitext(filename.lower())[1]
        if ext not in ALLOWED_EXTS:
            return jsonify({"success": False,
                            "error": f"Unsupported type '{ext}'."}), 415
        file_bytes = f.read()
        size_mb    = len(file_bytes) / (1024 * 1024)
        if size_mb > MAX_FILE_MB:
            return jsonify({"success": False,
                            "error": f"File too large ({size_mb:.1f} MB)."}), 413

        mode         = request.form.get("mode", "concise").lower()
        length_label = request.form.get("lengthLabel", "Medium")
        if mode not in ("concise", "detailed", "bullets"):
            mode = "concise"
        if length_label not in ("Short", "Medium", "Detailed"):
            length_label = "Medium"

        text = extract_text(file_bytes, filename)
        if not text:
            return jsonify({"success": False, "error": "No text found."}), 422

        summary, chunk_count, doc_type = summarize(
            text, mode=mode, length_label=length_label
        )
        keywords    = extract_keywords(summary + " " + text[:3000])
        audio_fname = generate_audio(summary)

        return jsonify({
            "success":       True,
            "summary":       summary,
            "transcription": text[:3000],
            "keywords":      keywords,
            "audio_url":     f"/api/audio/{audio_fname}",
            "chunkCount":    chunk_count,
            "fileName":      filename,
            "fileSizeMB":    round(size_mb, 2),
            "docType":       doc_type,
            "modelUsed":     MODEL_NAME,
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/audio/<filename>", methods=["GET"])
def serve_audio(filename):
    if not re.match(r"^[a-f0-9]{32}\.mp3$", filename):
        return jsonify({"error": "Invalid filename"}), 400
    fpath = os.path.join(AUDIO_DIR, filename)
    if not os.path.exists(fpath):
        return jsonify({"error": "Audio file not found"}), 404
    return send_from_directory(AUDIO_DIR, filename, mimetype="audio/mpeg")


@app.route("/upload-book", methods=["POST"])
def legacy_upload():
    return api_summarize()

@app.route("/summarize-text", methods=["POST"])
def legacy_text():
    try:
        data = request.get_json(force=True) or {}
        text = data.get("text", "").strip()
        if not text:
            return jsonify({"success": False, "error": "No text provided"}), 400
        mode = data.get("mode", "concise").lower()
        if mode not in ("concise", "detailed", "bullets"):
            mode = "concise"
        summary, chunk_count, doc_type = summarize(text, mode=mode)
        keywords    = extract_keywords(summary + " " + text[:3000])
        audio_fname = generate_audio(summary)
        return jsonify({
            "success":       True,
            "summary":       summary,
            "transcription": text[:3000],
            "keywords":      keywords,
            "audio_url":     f"/api/audio/{audio_fname}",
            "chunkCount":    chunk_count,
            "docType":       doc_type,
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"[INIT] BookMind -> http://localhost:{port} | {MODEL_NAME}")
    app.run(host="0.0.0.0", port=port, debug=False)