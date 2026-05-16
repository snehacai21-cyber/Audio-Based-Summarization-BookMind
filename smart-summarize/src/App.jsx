import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  Link,
  useNavigate,
  useLocation,
} from "react-router-dom";

// ─── BACKEND URL ───────────────────────────────────────────────────────────────
const API_BASE = "http://localhost:5000";

/* ─────────────────────────── GLOBAL STYLES ─────────────────────────── */
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #050810; --bg2: #0a0f1e; --bg3: #0f1628;
      --surface: rgba(255,255,255,0.04); --surface2: rgba(255,255,255,0.07);
      --border: rgba(255,255,255,0.08); --border2: rgba(255,255,255,0.15);
      --text: #f0f4ff; --text2: #8892aa; --text3: #4a5568;
      --accent: #4f7dff; --accent2: #7c3aed; --accent3: #06d6a0;
      --glow: rgba(79,125,255,0.3); --glow2: rgba(124,58,237,0.2);
      --radius: 16px; --radius2: 12px; --radius3: 8px;
    }

    html { scroll-behavior: smooth; }

    body {
      font-family: 'DM Sans', sans-serif;
      background: var(--bg); color: var(--text);
      min-height: 100vh; overflow-x: hidden;
      line-height: 1.6;
    }

    .bg-mesh {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 0;
      background:
        radial-gradient(ellipse 60% 40% at 20% 10%, rgba(79,125,255,0.12) 0%, transparent 70%),
        radial-gradient(ellipse 40% 50% at 80% 20%, rgba(124,58,237,0.1) 0%, transparent 70%),
        radial-gradient(ellipse 50% 40% at 50% 80%, rgba(6,214,160,0.06) 0%, transparent 70%);
    }

    .particles { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; }
    .particle {
      position: absolute; border-radius: 50%;
      background: radial-gradient(circle, rgba(79,125,255,0.6), transparent);
      animation: float linear infinite;
    }
    @keyframes float {
      0% { transform: translateY(100vh) rotate(0deg); opacity: 0; }
      10% { opacity: 1; } 90% { opacity: 1; }
      100% { transform: translateY(-20px) rotate(360deg); opacity: 0; }
    }

    .app { position: relative; z-index: 1; }

    nav {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1.25rem 2rem;
      background: rgba(5,8,16,0.8); backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border);
      position: sticky; top: 0; z-index: 100;
    }

    .logo {
      font-family: 'Syne', sans-serif; font-size: 1.3rem; font-weight: 800;
      background: linear-gradient(135deg, #4f7dff, #7c3aed, #06d6a0);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text; text-decoration: none;
    }

    .nav-links { display: flex; gap: 1.5rem; align-items: center; }
    .nav-link {
      color: var(--text2); font-size: 0.88rem; cursor: pointer;
      transition: color 0.2s; text-decoration: none;
    }
    .nav-link:hover, .nav-link.active { color: var(--text); }

    .btn-primary {
      background: linear-gradient(135deg, #4f7dff, #7c3aed);
      color: #fff; border: none; border-radius: 8px;
      padding: 0.55rem 1.25rem; font-size: 0.85rem; font-weight: 500;
      cursor: pointer; transition: all 0.2s; font-family: 'DM Sans', sans-serif;
      box-shadow: 0 0 20px rgba(79,125,255,0.3); text-decoration: none;
      display: inline-block;
    }
    .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 0 30px rgba(79,125,255,0.5); }

    .btn-outline {
      background: transparent; color: var(--text2);
      border: 1px solid var(--border2); border-radius: 8px;
      padding: 0.55rem 1.25rem; font-size: 0.85rem; font-weight: 500;
      cursor: pointer; transition: all 0.2s; font-family: 'DM Sans', sans-serif;
      text-decoration: none; display: inline-block;
    }
    .btn-outline:hover { background: var(--surface); color: var(--text); }

    .page { max-width: 960px; margin: 0 auto; padding: 2rem 2rem 5rem; }

    .hero { text-align: center; padding: 6rem 2rem 4rem; }
    .hero-badge {
      display: inline-flex; align-items: center; gap: 0.5rem;
      background: rgba(79,125,255,0.1); border: 1px solid rgba(79,125,255,0.3);
      border-radius: 100px; padding: 0.35rem 1rem;
      font-size: 0.8rem; color: #7fa8ff; margin-bottom: 2rem;
      animation: pulse-badge 3s ease-in-out infinite;
    }
    @keyframes pulse-badge {
      0%, 100% { box-shadow: 0 0 0 0 rgba(79,125,255,0.3); }
      50% { box-shadow: 0 0 0 6px rgba(79,125,255,0); }
    }
    .hero-dot { width: 6px; height: 6px; border-radius: 50%; background: #06d6a0; animation: blink 1.5s ease-in-out infinite; }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }

    .hero h1 {
      font-family: 'Syne', sans-serif;
      font-size: clamp(2rem, 4.5vw, 3.2rem);
      font-weight: 700;
      line-height: 1.15;
      letter-spacing: -0.02em;
      margin-bottom: 1.5rem;
      background: linear-gradient(135deg, #fff 0%, #a8c0ff 50%, #c4b5fd 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }

    .hero-sub {
      font-size: 1.05rem;
      color: #9aa3b8;
      max-width: 540px;
      margin: 0 auto 2.5rem;
      line-height: 1.75;
      font-weight: 400;
    }

    .hero-actions { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }

    .glass {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius); backdrop-filter: blur(20px); transition: all 0.3s;
    }
    .glass:hover { border-color: var(--border2); background: var(--surface2); }

    .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
    .stat-card { padding: 1.25rem; text-align: center; border-radius: var(--radius2); background: var(--surface); border: 1px solid var(--border); }
    .stat-num { font-family: 'Syne', sans-serif; font-size: 1.8rem; font-weight: 700; color: var(--text); }
    .stat-label { font-size: 0.8rem; color: var(--text2); margin-top: 0.25rem; }

    .section-header { text-align: center; margin-bottom: 2.5rem; }
    .section-tag {
      display: inline-block; background: rgba(6,214,160,0.1); border: 1px solid rgba(6,214,160,0.25);
      color: #06d6a0; border-radius: 100px; padding: 0.3rem 1rem; font-size: 0.78rem;
      font-weight: 500; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.08em;
    }

    .section-title {
      font-family: 'Syne', sans-serif;
      font-size: clamp(1.5rem, 3vw, 2rem);
      font-weight: 700;
      color: #dce6ff;
      letter-spacing: -0.015em;
    }

    .section-sub { color: #7a849a; margin-top: 0.75rem; font-size: 0.9rem; line-height: 1.6; }

    .features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
    .feature-card {
      padding: 1.5rem; border-radius: var(--radius);
      background: var(--surface); border: 1px solid var(--border); transition: all 0.3s;
    }
    .feature-card:hover { transform: translateY(-4px); border-color: var(--border2); background: var(--surface2); box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
    .feature-icon { font-size: 1.75rem; margin-bottom: 0.85rem; }

    .feature-title {
      font-family: 'Syne', sans-serif;
      font-size: 0.95rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: #cdd8f0;
    }

    .feature-desc { font-size: 0.82rem; color: var(--text2); line-height: 1.6; }

    .upload-zone {
      border: 2px dashed rgba(79,125,255,0.3); border-radius: var(--radius);
      padding: 3rem 2rem; text-align: center; cursor: pointer;
      background: rgba(79,125,255,0.03); transition: all 0.3s; position: relative; overflow: hidden;
    }
    .upload-zone.drag-over { border-color: var(--accent); background: rgba(79,125,255,0.08); transform: scale(1.01); }
    .upload-zone:hover { border-color: rgba(79,125,255,0.5); background: rgba(79,125,255,0.05); }
    .upload-icon {
      width: 64px; height: 64px; margin: 0 auto 1.25rem;
      background: linear-gradient(135deg, rgba(79,125,255,0.15), rgba(124,58,237,0.15));
      border-radius: 18px; display: flex; align-items: center; justify-content: center;
      font-size: 1.75rem; border: 1px solid rgba(79,125,255,0.2);
    }
    .upload-title { font-family: 'Syne', sans-serif; font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem; }
    .upload-sub { font-size: 0.85rem; color: var(--text2); margin-bottom: 1.25rem; }
    .file-types { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
    .file-badge {
      background: var(--surface2); border: 1px solid var(--border2);
      border-radius: 6px; padding: 0.25rem 0.75rem; font-size: 0.75rem; color: var(--text2); font-weight: 500;
    }

    .controls-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1.25rem; }
    .control-group { padding: 1rem 1.25rem; border-radius: var(--radius2); background: var(--surface); border: 1px solid var(--border); }
    .control-label { font-size: 0.78rem; color: var(--text2); margin-bottom: 0.5rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; }
    .control-label span { color: var(--accent); margin-left: 0.5rem; }
    .mode-btns { display: flex; gap: 0.4rem; }
    .mode-btn {
      flex: 1; padding: 0.45rem; border-radius: 7px; border: 1px solid var(--border);
      background: transparent; color: var(--text2); font-size: 0.78rem;
      cursor: pointer; transition: all 0.2s; font-family: 'DM Sans', sans-serif;
    }
    .mode-btn.active {
      background: linear-gradient(135deg, rgba(79,125,255,0.2), rgba(124,58,237,0.2));
      border-color: var(--accent); color: var(--text);
    }

    input[type=range] {
      width: 100%; margin-top: 0.5rem; -webkit-appearance: none; appearance: none;
      height: 4px; border-radius: 2px;
      background: linear-gradient(to right, var(--accent) var(--pct, 50%), var(--border) var(--pct, 50%));
      outline: none;
    }
    input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none; width: 16px; height: 16px;
      border-radius: 50%; background: var(--accent); cursor: pointer; box-shadow: 0 0 8px var(--glow);
    }

    .generate-btn {
      width: 100%; margin-top: 1.25rem; padding: 1rem;
      background: linear-gradient(135deg, #4f7dff, #7c3aed);
      border: none; border-radius: var(--radius2); color: #fff;
      font-family: 'Syne', sans-serif; font-size: 1rem; font-weight: 600;
      cursor: pointer; transition: all 0.3s; position: relative; overflow: hidden;
      box-shadow: 0 4px 30px rgba(79,125,255,0.35);
    }
    .generate-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 40px rgba(79,125,255,0.55); }
    .generate-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

    .status-bar {
      margin-top: 1rem; padding: 0.85rem 1.25rem;
      border-radius: var(--radius2); background: rgba(79,125,255,0.08);
      border: 1px solid rgba(79,125,255,0.2);
      display: flex; align-items: center; gap: 0.75rem;
    }
    .status-bar.error { background: rgba(255,100,100,0.08); border-color: rgba(255,100,100,0.25); }
    .spinner { width: 18px; height: 18px; border: 2px solid rgba(79,125,255,0.3); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; flex-shrink: 0; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .status-text { font-size: 0.85rem; color: var(--text2); }

    .progress-ring { display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: var(--text2); margin-top: 0.5rem; }
    .ring-bar { flex: 1; height: 3px; background: var(--surface2); border-radius: 2px; overflow: hidden; }
    .ring-fill { height: 100%; background: linear-gradient(90deg, var(--accent), #06d6a0); border-radius: 2px; transition: width 0.5s ease; }

    .result-tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
    .result-tab {
      padding: 0.5rem 1rem; border-radius: 8px; border: 1px solid var(--border);
      background: transparent; color: var(--text2); font-size: 0.85rem;
      cursor: pointer; transition: all 0.2s; font-family: 'DM Sans', sans-serif;
    }
    .result-tab.active { background: linear-gradient(135deg, rgba(79,125,255,0.2), rgba(124,58,237,0.2)); border-color: var(--accent); color: var(--text); }
    .result-content {
      padding: 1.5rem; border-radius: var(--radius); background: var(--surface);
      border: 1px solid var(--border); min-height: 180px; position: relative;
      font-size: 0.9rem; line-height: 1.8; color: var(--text2);
    }
    .result-text { white-space: pre-wrap; }

    .keywords { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem; }
    .keyword {
      padding: 0.3rem 0.85rem; border-radius: 100px;
      background: rgba(6,214,160,0.1); border: 1px solid rgba(6,214,160,0.25);
      font-size: 0.8rem; color: #06d6a0; animation: fadeUp 0.3s ease both;
    }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

    /* ── Audio Player (gTTS only) ── */
    .audio-player {
      padding: 1.5rem; border-radius: var(--radius);
      background: linear-gradient(135deg, rgba(79,125,255,0.06), rgba(124,58,237,0.06));
      border: 1px solid rgba(79,125,255,0.15); margin-top: 1rem;
    }
    .audio-player-label {
      font-size: 0.85rem; font-weight: 500; margin-bottom: 0.85rem;
      display: flex; align-items: center; gap: 0.5rem; color: var(--text);
    }
    .audio-error-box {
      padding: 1rem 1.25rem; border-radius: var(--radius2);
      background: rgba(255,100,100,0.06); border: 1px solid rgba(255,100,100,0.2);
      display: flex; align-items: flex-start; gap: 0.75rem;
    }
    .audio-error-icon { font-size: 1.1rem; flex-shrink: 0; margin-top: 0.05rem; }
    .audio-error-text { font-size: 0.84rem; color: #ff8080; line-height: 1.6; }

    .export-row { display: flex; gap: 0.5rem; margin-top: 1rem; flex-wrap: wrap; }
    .export-btn {
      flex: 1; min-width: 100px; padding: 0.6rem 0.75rem; border-radius: 8px;
      border: 1px solid var(--border); background: var(--surface);
      color: var(--text2); font-size: 0.8rem; cursor: pointer; transition: all 0.2s;
      font-family: 'DM Sans', sans-serif; text-align: center;
    }
    .export-btn:hover { background: var(--surface2); color: var(--text); border-color: var(--border2); }

    .file-info { display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1.25rem; background: rgba(6,214,160,0.06); border: 1px solid rgba(6,214,160,0.2); border-radius: var(--radius2); margin-top: 1rem; }
    .file-remove { background: none; border: none; color: var(--text3); cursor: pointer; font-size: 1rem; padding: 0.25rem; border-radius: 4px; transition: all 0.2s; }
    .file-remove:hover { color: #ff6b6b; background: rgba(255,107,107,0.1); }

    .pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
    .price-card { padding: 2rem 1.5rem; border-radius: var(--radius); border: 1px solid var(--border); background: var(--surface); position: relative; transition: all 0.3s; }
    .price-card.featured { border-color: rgba(79,125,255,0.5); background: rgba(79,125,255,0.06); }
    .price-card:hover { transform: translateY(-4px); }
    .price-name { font-family: 'Syne', sans-serif; font-size: 0.9rem; font-weight: 700; color: var(--text2); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.75rem; }
    .price-amt { font-family: 'Syne', sans-serif; font-size: 2.5rem; font-weight: 800; line-height: 1; }
    .price-period { font-size: 0.8rem; color: var(--text2); }
    .price-features { list-style: none; margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.6rem; }
    .price-features li { font-size: 0.84rem; color: var(--text2); display: flex; align-items: flex-start; gap: 0.5rem; white-space: nowrap; }
    .price-features li::before { content: '✓'; color: var(--accent3); font-weight: 700; }
    .price-btn { width: 100%; margin-top: 1.5rem; padding: 0.8rem; border-radius: 10px; border: 1px solid var(--border2); background: transparent; color: var(--text); font-family: 'Syne', sans-serif; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; }
    .price-btn:hover { background: var(--surface2); }
    .price-btn.featured { background: linear-gradient(135deg, var(--accent), var(--accent2)); border: none; color: #fff; }
    .price-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, var(--accent), var(--accent2)); color: #fff; font-size: 0.72rem; font-weight: 700; padding: 0.25rem 1rem; border-radius: 100px; white-space: nowrap; }

    .testimonial-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
    .testimonial { padding: 1.5rem; border-radius: var(--radius); background: var(--surface); border: 1px solid var(--border); }
    .testimonial-text { font-size: 0.88rem; line-height: 1.7; color: var(--text2); margin-bottom: 1rem; }
    .testimonial-author { display: flex; align-items: center; gap: 0.75rem; }
    .avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--accent2)); display: flex; align-items: center; justify-content: center; font-size: 0.82rem; font-weight: 700; color: #fff; flex-shrink: 0; }
    .author-name { font-size: 0.85rem; font-weight: 500; }
    .author-role { font-size: 0.78rem; color: var(--text2); }

    .faq-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .faq-item { border-radius: var(--radius2); border: 1px solid var(--border); overflow: hidden; }
    .faq-q {
      padding: 1.1rem 1.25rem; cursor: pointer;
      display: flex; justify-content: space-between; align-items: center;
      font-size: 0.92rem; font-weight: 500;
      color: #c8d4ee;
      user-select: none; transition: background 0.2s;
    }
    .faq-q:hover { background: var(--surface); }
    .faq-chevron { transition: transform 0.3s; color: var(--text2); }
    .faq-chevron.open { transform: rotate(180deg); }
    .faq-a { overflow: hidden; transition: max-height 0.35s ease, padding 0.3s; padding: 0 1.25rem; font-size: 0.85rem; color: var(--text2); line-height: 1.7; max-height: 0; }
    .faq-a.open { max-height: 200px; padding: 0 1.25rem 1.1rem; }

    footer { border-top: 1px solid var(--border); padding: 2.5rem 2rem; margin-top: 4rem; max-width: 960px; margin-left: auto; margin-right: auto; }
    .footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 2rem; }
    .footer-brand { font-family: 'Syne', sans-serif; font-size: 1.1rem; font-weight: 800; margin-bottom: 0.5rem; background: linear-gradient(135deg, #4f7dff, #7c3aed); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .footer-desc { font-size: 0.82rem; color: var(--text2); line-height: 1.6; }
    .footer-col h4 { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text2); margin-bottom: 0.75rem; }
    .footer-col ul { list-style: none; display: flex; flex-direction: column; gap: 0.45rem; }
    .footer-col li { font-size: 0.83rem; color: var(--text3); cursor: pointer; transition: color 0.2s; }
    .footer-col li:hover { color: var(--text2); }
    .footer-bottom { margin-top: 2rem; padding-top: 1.25rem; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; color: var(--text3); }

    .divider { height: 1px; background: linear-gradient(90deg, transparent, var(--border), transparent); margin: 0 2rem; }

    .reveal { opacity: 0; transform: translateY(20px); transition: all 0.6s ease; }
    .reveal.shown { opacity: 1; transform: translateY(0); }

    .dash-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }
    .dash-card { padding: 1.5rem; border-radius: var(--radius); background: var(--surface); border: 1px solid var(--border); }
    .dash-num { font-family: 'Syne', sans-serif; font-size: 2rem; font-weight: 700; color: var(--text); }
    .dash-label { font-size: 0.82rem; color: var(--text2); margin-top: 0.25rem; }
    .dash-icon { font-size: 1.5rem; margin-bottom: 0.75rem; }

    .auth-card {
      max-width: 420px; margin: 4rem auto;
      padding: 2.5rem; border-radius: var(--radius);
      background: var(--surface); border: 1px solid var(--border);
    }
    .auth-title { font-family: 'Syne', sans-serif; font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; }
    .auth-sub { font-size: 0.88rem; color: var(--text2); margin-bottom: 2rem; }
    .form-group { margin-bottom: 1.25rem; }
    .form-label { font-size: 0.82rem; color: var(--text2); font-weight: 500; display: block; margin-bottom: 0.5rem; }
    .form-input {
      width: 100%; padding: 0.75rem 1rem; border-radius: var(--radius3);
      background: var(--bg2); border: 1px solid var(--border);
      color: var(--text); font-size: 0.88rem; font-family: 'DM Sans', sans-serif;
      outline: none; transition: all 0.2s;
    }
    .form-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(79,125,255,0.1); }
    .form-input::placeholder { color: var(--text3); }
    .auth-footer { text-align: center; margin-top: 1.5rem; font-size: 0.82rem; color: var(--text2); }
    .auth-link { color: var(--accent); cursor: pointer; text-decoration: none; }
    .auth-link:hover { text-decoration: underline; }

    .result-page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 2rem; }
    .result-doc-info { display: flex; align-items: center; gap: 1rem; }
    .result-doc-icon { width: 52px; height: 52px; border-radius: 14px; background: linear-gradient(135deg, rgba(79,125,255,0.15), rgba(124,58,237,0.15)); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; border: 1px solid rgba(79,125,255,0.2); }
    .result-doc-name { font-family: 'Syne', sans-serif; font-size: 1.1rem; font-weight: 600; }
    .result-doc-meta { font-size: 0.82rem; color: var(--text2); margin-top: 0.25rem; }
    .result-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }

    @keyframes modalBgIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes modalIn { from { opacity: 0; transform: scale(0.88) translateY(16px); } to { opacity: 1; transform: scale(1) translateY(0); } }

    @keyframes welcomeFadeIn {
      from { opacity: 0; transform: translateY(-10px) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes welcomeGlow {
      0%, 100% { box-shadow: 0 0 20px rgba(79,125,255,0.25), 0 0 40px rgba(124,58,237,0.15); }
      50% { box-shadow: 0 0 30px rgba(79,125,255,0.45), 0 0 60px rgba(124,58,237,0.3); }
    }
    .welcome-badge {
      display: inline-flex; align-items: center; gap: 0.6rem;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(79,125,255,0.35);
      border-radius: 100px; padding: 0.45rem 1.25rem;
      font-size: 0.92rem; font-weight: 500;
      margin-bottom: 2rem;
      animation: welcomeFadeIn 0.6s cubic-bezier(0.34,1.56,0.64,1) both, welcomeGlow 3s ease-in-out 0.6s infinite;
      backdrop-filter: blur(12px);
    }
    .welcome-text {
      background: linear-gradient(135deg, #a8c0ff 0%, #c4b5fd 40%, #06d6a0 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
      font-family: 'Syne', sans-serif; font-weight: 600;
    }

    @media (max-width: 640px) {
      .features-grid, .pricing-grid, .dash-grid { grid-template-columns: 1fr; }
      .testimonial-grid { grid-template-columns: 1fr; }
      .controls-grid { grid-template-columns: 1fr; }
      .footer-grid { grid-template-columns: 1fr; }
      .stats-row { grid-template-columns: 1fr; }
      nav { padding: 1rem; }
      .nav-links { gap: 0.75rem; }
    }
  `}</style>
);

/* ─────────────────────────── PARTICLES ─────────────────────────── */
function Particles() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.innerHTML = "";
    for (let i = 0; i < 18; i++) {
      const p = document.createElement("div");
      p.className = "particle";
      const sz = Math.random() * 4 + 2;
      p.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random() * 100}%;animation-duration:${8 + Math.random() * 12}s;animation-delay:${-Math.random() * 15}s;opacity:${0.3 + Math.random() * 0.4}`;
      c.appendChild(p);
    }
  }, []);
  return <div className="particles" ref={ref} />;
}

function useScrollReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("shown")),
      { threshold: 0.08, rootMargin: "0px 0px -30px 0px" }
    );
    const els = document.querySelectorAll(".reveal");
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  });
}

/* ─────────────────────────── NAVBAR ─────────────────────────── */
function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isActive = (path) => location.pathname === path ? "nav-link active" : "nav-link";

  return (
    <nav>
      <Link to="/" className="logo">BookMind</Link>
      <div className="nav-links">
        <Link to="/" className={isActive("/")}>Home</Link>
        <Link to="/upload" className={isActive("/upload")}>Upload</Link>
        <Link to="/pricing" className={isActive("/pricing")}>Pricing</Link>
        {user ? (
          <>
            <span style={{ color: "var(--text2)", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ width: 24, height: 24, borderRadius: "50%", background: "linear-gradient(135deg,#4f7dff,#7c3aed)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color: "#fff" }}>
                {user.name.charAt(0).toUpperCase()}
              </span>
              {user.name.split(" ")[0]}
            </span>
            <button className="btn-outline" onClick={() => { logout(); navigate("/"); }} style={{ padding: "0.45rem 1rem", fontSize: "0.82rem" }}>Log out</button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn-outline" style={{ padding: "0.45rem 1rem", fontSize: "0.82rem" }}>Log in</Link>
            <Link to="/upload" className="btn-primary" style={{ padding: "0.45rem 1rem", fontSize: "0.82rem" }}>Get started →</Link>
          </>
        )}
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer>
      <div className="footer-grid">
        <div>
          <div className="footer-brand">BookMind</div>
          <p className="footer-desc">The smartest way to read, understand, and absorb any book or document — instantly, accurately, and beautifully.</p>
        </div>
        <div className="footer-col">
          <h4>Product</h4>
          <ul>
            <li>Features</li>
            <li><Link to="/pricing" style={{ color: "inherit", textDecoration: "none" }}>Pricing</Link></li>
            <li>API Access</li>
            <li>Changelog</li>
          </ul>
        </div>
        <div className="footer-col">
          <h4>Company</h4>
          <ul>
            <li>About</li>
            <li>Blog</li>
            <li>Privacy Policy</li>
            <li>Terms of Service</li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 BookMind · All rights reserved</span>
        <span style={{ color: "var(--text2)" }}>🇮🇳 Made in India</span>
      </div>
    </footer>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="faq-item">
      <div className="faq-q" onClick={() => setOpen(!open)}>
        {q}
        <span className={`faq-chevron${open ? " open" : ""}`}>▼</span>
      </div>
      <div className={`faq-a${open ? " open" : ""}`}>{a}</div>
    </div>
  );
}

function Counter({ target, suffix }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const step = target / (1200 / 16);
    let cur = 0;
    const t = setInterval(() => {
      cur = Math.min(cur + step, target);
      setVal(Math.round(cur));
      if (cur >= target) clearInterval(t);
    }, 16);
    return () => clearInterval(t);
  }, [target]);
  return <>{val.toLocaleString()}{suffix}</>;
}

/* ─────────────────────────── HOME PAGE ─────────────────────────── */
function HomePage() {
  useScrollReveal();
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <>
      <div className="hero reveal" style={{ maxWidth: 960, margin: "0 auto", padding: "6rem 2rem 4rem" }}>
        {user ? (
          <div className="welcome-badge">
            <span style={{ fontSize: "1.1rem" }}>👋</span>
            <span className="welcome-text">Hey, {user.name.split(" ")[0]}!</span>
            <span style={{ color: "var(--text2)", fontSize: "0.82rem" }}>Welcome back</span>
          </div>
        ) : (
          <div className="hero-badge">
            <div className="hero-dot" />
            AI-powered document intelligence
          </div>
        )}

        <h1>Read Less.<br />Understand More.</h1>

        <p className="hero-sub">
          From textbooks to research papers, BookMind extracts what matters most — giving you clear summaries, key concepts, and audio narration so you absorb more in less time.
        </p>

        <div className="hero-actions">
          <button className="btn-primary" onClick={() => navigate("/upload")} style={{ padding: "0.75rem 1.75rem", fontSize: "0.95rem", borderRadius: 10 }}>
            ⚡ Try It Free
          </button>
          <button className="btn-outline" onClick={() => navigate("/upload")} style={{ padding: "0.75rem 1.75rem", fontSize: "0.95rem", borderRadius: 10 }}>
            See How It Works →
          </button>
        </div>
      </div>

      <div className="divider" />

      <section style={{ maxWidth: 960, margin: "0 auto", padding: "4rem 2rem" }}>
        <div className="section-header reveal">
          <div className="section-tag">Capabilities</div>
          <h2 className="section-title">Everything You Need</h2>
          <p className="section-sub">Powerful AI summarization built for students, researchers, and professionals</p>
        </div>
        <div className="features-grid">
          {[
            ["🧠","Deep Comprehension","Industry-leading language understanding with deep context preservation, nuance detection, and consistent accuracy across any domain or document type."],
            ["⚡","Smart Chunking","Process documents up to 1,500 pages with intelligent chunking that preserves context and merges summaries into a coherent whole."],
            ["🎙","Audio Narration","Convert summaries into clear, natural-sounding audio with multiple voice styles, speed control, waveform visualization, and MP3 export."],
            ["📊","Keyword Extraction","Automatically surface key concepts, entities, and themes from your documents for quick reference and faster review."],
            ["🔒","Private & Secure","Your documents are encrypted in transit, processed ephemerally, and never stored or used for model training."],
            ["📤","Flexible Export","Download summaries as PDF, DOCX, or TXT. Export audio as high-quality MP3. Share with a link instantly."],
          ].map(([icon, title, desc]) => (
            <div key={title} className="feature-card reveal">
              <div className="feature-icon">{icon}</div>
              <div className="feature-title">{title}</div>
              <div className="feature-desc">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="divider" />

      <section style={{ maxWidth: 960, margin: "0 auto", padding: "4rem 2rem" }}>
        <div className="section-header reveal">
          <div className="section-tag">FAQ</div>
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-sub">Everything you need to know before getting started</p>
        </div>
        <div className="faq-list reveal">
          <FaqItem q="How accurate is the AI summarization?" a="Our AI achieves over 96% accuracy on technical, academic, and legal content. It preserves key arguments, data points, and conclusions while eliminating redundancy." />
          <FaqItem q="Can it handle very large files (1000+ pages)?" a="Yes. Our Smart Chunking Engine splits large documents into semantically coherent chunks, processes each independently, then merges outputs into a unified, coherent summary." />
          <FaqItem q="Is my document data private and secure?" a="Absolutely. Documents are encrypted with AES-256 in transit and at rest. They are processed ephemerally — deleted within 1 hour after processing. We never use your documents for model training." />
          <FaqItem q="What audio voices and languages are available?" a="We currently offer AI-generated audio narration via gTTS. Multi-language support including Hindi, Spanish, French, and German is coming in Q3 2026." />
          <FaqItem q="What file formats are supported?" a="Currently PDF, DOC/DOCX, and TXT files. Support for EPUB, HTML, Markdown, and PowerPoint is on our Q3 2026 roadmap." />
        </div>
      </section>

      <Footer />
    </>
  );
}

/* ─────────────────────────── UPLOAD PAGE ─────────────────────────── */
function UploadPage() {
  useScrollReveal();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [mode, setMode] = useState("concise");
  const [length, setLength] = useState(2);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef(null);
  const abortRef = useRef(null);

  const lengthLabels = ["Short", "Medium", "Detailed"];

  // Mode display labels and descriptions
  const modeConfig = {
    concise:  { label: "Concise",  desc: "Compact, flowing prose" },
    detailed: { label: "Detailed", desc: "In-depth analysis" },
    bullets:  { label: "Bullets",  desc: "Structured key points" },
  };

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setErrorMsg("");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const startProgressAnimation = () => {
    let current = 5;
    const steps = [
      { target: 15, label: "Uploading document to server...", delay: 800 },
      { target: 30, label: "Extracting text from document...", delay: 2000 },
      { target: 45, label: "Chunking document intelligently...", delay: 1500 },
      { target: 60, label: "Running local NLP analysis on sections...", delay: 3000 },
      { target: 75, label: "Scoring and selecting key sentences...", delay: 4000 },
      { target: 85, label: "Merging section summaries...", delay: 3000 },
      { target: 90, label: "Generating audio narration...", delay: 2000 },
    ];

    let stepIdx = 0;
    const timers = [];

    const runStep = () => {
      if (stepIdx >= steps.length) return;
      const step = steps[stepIdx++];
      setStatusText(step.label);
      const interval = setInterval(() => {
        current = Math.min(current + 0.5, step.target);
        setProgress(Math.round(current));
        if (current >= step.target) clearInterval(interval);
      }, 100);
      timers.push(interval);
      const t = setTimeout(runStep, step.delay);
      timers.push(t);
    };

    runStep();
    return () => timers.forEach((t) => { clearInterval(t); clearTimeout(t); });
  };

  const handleGenerate = async () => {
    setLoading(true);
    setProgress(0);
    setErrorMsg("");
    setStatusText("Preparing upload...");

    const stopAnimation = startProgressAnimation();

    try {
      const formData = new FormData();
      if (file) {
        formData.append("file", file);
      }
      formData.append("mode", mode);
      formData.append("lengthLabel", lengthLabels[length - 1]);

      const controller = new AbortController();
      abortRef.current = controller;

      const response = await fetch(`${API_BASE}/api/summarize`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      const data = await response.json();

      stopAnimation();
      setProgress(100);
      setStatusText("Done!");

      if (!data.success) {
        throw new Error(data.error || "Backend returned an error.");
      }

      navigate("/result", {
        state: {
          summary: data.summary,
          keywords: data.keywords,
          audioUrl: data.audio_url ? `${API_BASE}${data.audio_url}` : null,
          fileName: file?.name || data.fileName || "document",
          fileSize: file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : "—",
          mode,
          length: lengthLabels[length - 1],
          chunkCount: data.chunkCount || 1,
        },
      });

    } catch (err) {
      stopAnimation();

      if (err.name === "AbortError") {
        setErrorMsg("Request was cancelled.");
      } else if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
        setErrorMsg("Cannot reach the backend server. Make sure Flask is running: python app.py (port 5000)");
      } else {
        setErrorMsg(err.message || "Something went wrong. Please try again.");
      }

      setLoading(false);
      setProgress(0);
      setStatusText("");
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "3rem 2rem 5rem" }}>
      <div className="section-header reveal">
        <div className="section-tag">Upload</div>
        <h2 className="section-title">Upload Your Document</h2>
        <p className="section-sub">Upload a document and watch the AI work in real-time</p>
      </div>

      <div
        className={`upload-zone reveal${dragOver ? " drag-over" : ""}`}
        onClick={() => !loading && fileRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
      >
        <div className="upload-icon">📄</div>
        <div className="upload-title">Drop your document here</div>
        <div className="upload-sub">or click to browse files</div>
        <div className="file-types">
          <span className="file-badge">PDF</span>
          <span className="file-badge">DOC</span>
          <span className="file-badge">TXT</span>
        </div>
      </div>
      <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />

      {file && (
        <div className="file-info">
          <div style={{ fontSize: "1.5rem" }}>📄</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.88rem", fontWeight: 500 }}>{file.name}</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text2)", marginTop: "0.15rem" }}>{(file.size / 1024 / 1024).toFixed(1)} MB · Ready for analysis</div>
          </div>
          <button className="file-remove" onClick={() => setFile(null)} disabled={loading}>✕</button>
        </div>
      )}

      <div className="controls-grid reveal">
        <div className="control-group">
          <div className="control-label">
            Summary Type
            <span style={{ marginLeft: "0.5rem", color: "var(--accent3)", fontSize: "0.72rem", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
              — {modeConfig[mode].desc}
            </span>
          </div>
          <div className="mode-btns">
            {Object.entries(modeConfig).map(([key, cfg]) => (
              <button
                key={key}
                className={`mode-btn${mode === key ? " active" : ""}`}
                onClick={() => setMode(key)}
                disabled={loading}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </div>
        <div className="control-group">
          <div className="control-label">Length <span>{lengthLabels[length - 1]}</span></div>
          <input
            type="range" min={1} max={3} step={1} value={length}
            style={{ "--pct": `${((length - 1) / 2) * 100}%` }}
            onChange={(e) => setLength(Number(e.target.value))}
            disabled={loading}
          />
        </div>
      </div>

      <button className="generate-btn reveal" disabled={loading} onClick={handleGenerate}>
        {loading ? "⏳ Analyzing locally..." : "✨ Generate Summary"}
      </button>

      {loading && (
        <>
          <div className="status-bar">
            <div className="spinner" />
            <div className="status-text">{statusText}</div>
          </div>
          <div className="progress-ring">
            <span>Local NLP processing...</span>
            <div className="ring-bar"><div className="ring-fill" style={{ width: `${progress}%` }} /></div>
            <span>{Math.round(progress)}%</span>
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text3)", marginTop: "0.5rem", textAlign: "center" }}>
            Processing locally — large documents may take 15–60 seconds. Please keep this tab open.
          </div>
        </>
      )}

      {!loading && errorMsg && (
        <div className="status-bar error">
          <span style={{ fontSize: "1.1rem" }}>❌</span>
          <div className="status-text" style={{ color: "#ff8080" }}>{errorMsg}</div>
        </div>
      )}

      <Footer />
    </div>
  );
}

/* ─────────────────────────── SUMMARY RESULT PAGE ─────────────────────────── */
function SummaryResultPage() {
  useScrollReveal();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};
  const summary = state.summary || "No summary generated yet. Please go to the Upload page first.";
  const fileName = state.fileName || "document.pdf";
  const fileSize = state.fileSize || "—";
  const backendAudioUrl = state.audioUrl || null;
  const [activeTab, setActiveTab] = useState("summary");
  const [audioError, setAudioError] = useState("");

  const wordCount = summary.split(/\s+/).filter(Boolean).length;

  const keywords = state.keywords?.length > 0 ? state.keywords : (() => {
    const stops = new Set(["the","a","an","and","or","but","in","on","at","to","for","of","with","by","from","is","are","was","were","be","been","have","has","had","do","does","did","will","would","could","should","may","might","not","no","this","that","these","those","it","its","also","more","very","just","all","than","then","when","their","there","about","which","into","over","after","only","each","such"]);
    const words = summary.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter((w) => w.length > 4 && !stops.has(w));
    const freq = {};
    words.forEach((w) => (freq[w] = (freq[w] || 0) + 1));
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([w]) => w);
  })();

  const exportPdf = () => {
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>BookMind Summary</title><style>body{font-family:sans-serif;max-width:720px;margin:2rem auto;line-height:1.7;color:#111}h1{font-size:1.2rem;margin-bottom:1rem}pre{white-space:pre-wrap;font-family:inherit}</style></head><body><h1>${fileName}</h1><pre>${summary}</pre></body></html>`);
    w.document.close(); w.print();
  };
  const copyText = () => navigator.clipboard.writeText(summary).catch(() => {});
  const exportTxt = () => {
    const blob = new Blob([summary], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "summary.txt"; a.click();
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "3rem 2rem 5rem" }}>
      <div className="result-page-header">
        <div className="result-doc-info">
          <div className="result-doc-icon">📄</div>
          <div>
            <div className="result-doc-name">{fileName}</div>
            <div className="result-doc-meta">{fileSize} · {state.mode || "concise"} · {state.length || "Medium"} · {wordCount.toLocaleString()} words{state.chunkCount > 1 ? ` · ${state.chunkCount} chunks processed` : ""}</div>
          </div>
        </div>
        <div className="result-actions">
          <button className="export-btn" onClick={exportTxt}>⬇ TXT</button>
          <button className="export-btn" onClick={exportPdf}>⬇ PDF</button>
          <button className="export-btn" onClick={copyText}>📋 Copy</button>
          <button className="btn-primary" onClick={() => navigate("/upload")} style={{ padding: "0.55rem 1.1rem", fontSize: "0.82rem" }}>+ New Summary</button>
        </div>
      </div>

      <div className="result-tabs reveal">
        <button className={`result-tab${activeTab === "summary" ? " active" : ""}`} onClick={() => setActiveTab("summary")}>📝 Summary</button>
        <button className={`result-tab${activeTab === "keywords" ? " active" : ""}`} onClick={() => setActiveTab("keywords")}>🏷 Keywords</button>
        <button className={`result-tab${activeTab === "audio" ? " active" : ""}`} onClick={() => setActiveTab("audio")}>🎵 Audio</button>
      </div>

      {activeTab === "summary" && (
        <div className="reveal">
          <div className="result-content">
            <div className="result-text">{summary}</div>
          </div>
          <div className="export-row">
            <button className="export-btn" onClick={exportTxt}>⬇ TXT</button>
            <button className="export-btn" onClick={exportPdf}>⬇ PDF</button>
            <button className="export-btn" onClick={copyText}>📋 Copy</button>
          </div>
        </div>
      )}

      {activeTab === "keywords" && (
        <div className="reveal">
          <div className="result-content">
            <p style={{ fontSize: "0.85rem", color: "var(--text2)", marginBottom: "0.75rem" }}>AI-extracted key concepts and themes:</p>
            <div className="keywords">
              {keywords.map((kw, i) => (
                <span key={kw} className="keyword" style={{ animationDelay: `${i * 0.06}s` }}>{kw}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "audio" && (
        <div className="reveal">
          {backendAudioUrl && !audioError ? (
            <div className="audio-player">
              <div className="audio-player-label">
                <span>🎙</span>
                AI-Generated Audio Narration
              </div>
              <audio
                key={backendAudioUrl}
                controls
                preload="auto"
                style={{ width: "100%", borderRadius: 8, outline: "none" }}
                src={backendAudioUrl}
                onError={() => setAudioError("Audio file could not be loaded. The server may have encountered an error generating the MP3.")}
              />
              <a
                href={backendAudioUrl}
                download="summary.mp3"
                className="export-btn"
                style={{ display: "block", marginTop: "0.75rem", textAlign: "center", textDecoration: "none" }}
              >
                ⬇ Download MP3
              </a>
            </div>
          ) : (
            <div className="audio-error-box">
              <span className="audio-error-icon">⚠️</span>
              <div className="audio-error-text">
                {audioError
                  ? audioError
                  : "Audio narration was not generated for this summary. Please re-upload your document and try again — make sure the backend server is running."}
              </div>
            </div>
          )}
        </div>
      )}

      <Footer />
    </div>
  );
}

/* ─────────────────────────── PRICING MODAL ─────────────────────────── */
function PricingModal({ modal, onClose }) {
  useEffect(() => {
    document.body.style.overflow = modal ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [modal]);

  if (!modal) return null;

  const configs = {
    pro: { icon: "💎", badge: "Pro Plan", badgeColor: "rgba(79,125,255,0.15)", badgeBorder: "rgba(79,125,255,0.35)", badgeText: "#7fa8ff", title: "Pro is on its way", subtitle: "Advanced AI processing & premium features", body: "The Pro version is currently under active development. Advanced AI processing, unlimited documents, audio narration, and all premium features will be available very soon.", accent: "linear-gradient(135deg, #4f7dff, #7c3aed)", glow: "rgba(79,125,255,0.2)" },
    enterprise: { icon: "🏢", badge: "Enterprise Plan", badgeColor: "rgba(6,214,160,0.1)", badgeBorder: "rgba(6,214,160,0.3)", badgeText: "#06d6a0", title: "Enterprise is being prepared", subtitle: "Dedicated infrastructure & custom deployment", body: "Enterprise infrastructure, private deployment solutions, SSO integration, and dedicated support systems are currently being prepared for organizations that need scale, security, and compliance.", accent: "linear-gradient(135deg, #06d6a0, #4f7dff)", glow: "rgba(6,214,160,0.15)" },
  };
  const cfg = configs[modal];

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(5,8,16,0.85)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", animation: "modalBgIn 0.25s ease" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "linear-gradient(145deg, #0a0f1e, #0f1628)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "2.5rem", position: "relative", boxShadow: `0 40px 80px rgba(0,0,0,0.6), 0 0 60px ${cfg.glow}`, animation: "modalIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "60%", height: 1, background: cfg.accent, borderRadius: 1 }} />
        <button onClick={onClose} style={{ position: "absolute", top: "1.25rem", right: "1.25rem", width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text2)", cursor: "pointer", fontSize: "0.9rem", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>✕</button>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: cfg.badgeColor, border: `1px solid ${cfg.badgeBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.75rem", marginBottom: "1.5rem", boxShadow: `0 0 30px ${cfg.glow}` }}>{cfg.icon}</div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", background: cfg.badgeColor, border: `1px solid ${cfg.badgeBorder}`, borderRadius: 100, padding: "0.25rem 0.85rem", fontSize: "0.75rem", color: cfg.badgeText, fontWeight: 600, marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>{cfg.badge}</div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.5rem", lineHeight: 1.2 }}>{cfg.title}</h2>
        <p style={{ fontSize: "0.82rem", color: "var(--accent)", marginBottom: "1.25rem", fontWeight: 500 }}>{cfg.subtitle}</p>
        <p style={{ fontSize: "0.88rem", color: "var(--text2)", lineHeight: 1.75, marginBottom: "2rem", padding: "1.25rem", borderRadius: "var(--radius2)", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>{cfg.body}</p>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.85rem 1.25rem", borderRadius: "var(--radius2)", background: "rgba(79,125,255,0.05)", border: "1px solid rgba(79,125,255,0.15)", marginBottom: "1.5rem" }}>
          <span style={{ fontSize: "1rem" }}>🔔</span>
          <span style={{ fontSize: "0.82rem", color: "var(--text2)" }}>We'll notify early access users when it launches. Stay tuned!</span>
        </div>
        <button onClick={onClose} style={{ width: "100%", padding: "0.9rem", background: cfg.accent, border: "none", borderRadius: "var(--radius2)", color: "#fff", fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: "0.9rem", cursor: "pointer", transition: "all 0.2s", boxShadow: `0 4px 20px ${cfg.glow}` }}>Got it, thanks!</button>
      </div>
    </div>
  );
}

/* ─────────────────────────── PRICING PAGE ─────────────────────────── */
function PricingPage() {
  useScrollReveal();
  const navigate = useNavigate();
  const [modal, setModal] = useState(null);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "3rem 2rem 5rem" }}>
      <PricingModal modal={modal} onClose={() => setModal(null)} />
      <div className="section-header reveal">
        <div className="section-tag">Pricing</div>
        <h2 className="section-title">Simple, Transparent Plans</h2>
        <p className="section-sub">Start free, scale as you grow</p>
      </div>
      <div className="pricing-grid reveal">
        <div className="price-card">
          <div className="price-name">Starter</div>
          <div className="price-amt">Free</div>
          <div className="price-period">forever</div>
          <ul className="price-features">
            {/* ── CHANGED: was "5 documents/month" ── */}
            <li>Unlimited documents</li>
            {/* ── CHANGED: was "Up to 50 pages/doc" ── */}
            <li>Up to 300 pages/doc</li>
            <li>Text summaries</li>
            <li>3 export formats</li>
            <li>Standard processing</li>
          </ul>
          <button className="price-btn" onClick={() => navigate("/upload")}>Get started free</button>
        </div>
        <div className="price-card featured">
          <div className="price-badge">Most Popular</div>
          <div className="price-name">Pro</div>
          <div className="price-amt">₹999</div>
          <div className="price-period">/month</div>
          <ul className="price-features">
            <li>Unlimited documents</li>
            <li>Up to 1500 pages/doc</li>
            <li>Text + Audio summaries</li>
            <li>All export formats</li>
            <li>Priority processing</li>
            <li>Advanced AI features</li>
          </ul>
          <button className="price-btn featured" onClick={() => setModal("pro")}>Start Pro trial</button>
        </div>
        <div className="price-card">
          <div className="price-name">Enterprise</div>
          <div className="price-amt">Custom</div>
          <div className="price-period">contact us</div>
          <ul className="price-features">
            <li>Unlimited everything</li>
            <li>Private deployment</li>
            <li>SSO & team management</li>
            <li>API access</li>
            <li>SLA & dedicated support</li>
            <li>Custom integrations</li>
          </ul>
          <button className="price-btn" onClick={() => setModal("enterprise")}>Contact sales →</button>
        </div>
      </div>
      <div style={{ marginTop: "4rem" }}>
        <div className="section-header reveal">
          <div className="section-tag">FAQ</div>
          <h2 className="section-title">Billing Questions</h2>
        </div>
        <div className="faq-list reveal">
          <FaqItem q="Can I cancel my subscription anytime?" a="Yes, you can cancel at any time. Your access continues until the end of the billing period." />
          {/* ── CHANGED: answer updated ── */}
          <FaqItem q="Is there a free trial for Pro?" a="No, we currently do not offer a free trial for the Pro plan." />
          <FaqItem q="Do you offer student or academic discounts?" a="Absolutely. Students and academic institutions get 40% off the Pro plan. Email us with a valid institution email to claim your discount." />
          <FaqItem q="What payment methods do you accept?" a="We accept all major credit/debit cards, UPI, Net Banking, and international cards via Razorpay. Enterprise invoicing is available on request." />
        </div>
      </div>
      <Footer />
    </div>
  );
}

/* ─────────────────────────── LOGIN PAGE ─────────────────────────── */
function LoginPage() {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { if (user) navigate("/"); }, [user]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("Please enter a username."); return; }
    if (!email.trim()) { setError("Please enter your email."); return; }
    if (!password) { setError("Please enter your password."); return; }
    if (isSignup && password.length < 6) { setError("Password must be at least 6 characters."); return; }
    login({ name: name.trim(), email: email.trim() });
    navigate("/");
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 2rem 5rem" }}>
      <div className="auth-card glass">
        <div className="auth-title">{isSignup ? "Create account" : "Welcome back"}</div>
        <div className="auth-sub">{isSignup ? "Start reading smarter with BookMind" : "Sign in to your BookMind account"}</div>
        {error && <div style={{ background: "rgba(255,100,100,0.08)", border: "1px solid rgba(255,100,100,0.25)", borderRadius: 8, padding: "0.75rem 1rem", fontSize: "0.83rem", color: "#ff8080", marginBottom: "1rem" }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input className="form-input" type="text" placeholder="e.g. sneha_reads" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary" style={{ width: "100%", padding: "0.85rem", fontSize: "0.9rem", borderRadius: "var(--radius3)", textAlign: "center" }}>
            {isSignup ? "Create account →" : "Sign in →"}
          </button>
        </form>
        <div className="auth-footer">
          {isSignup ? "Already have an account? " : "Don't have an account? "}
          <a className="auth-link" onClick={() => { setIsSignup(!isSignup); setError(""); }}>{isSignup ? "Sign in" : "Sign up free"}</a>
        </div>
      </div>
      <Footer />
    </div>
  );
}

/* ─────────────────────────── AUTH CONTEXT ─────────────────────────── */
const AuthContext = createContext(null);
function useAuth() { return useContext(AuthContext); }

/* ─────────────────────────── APP ROOT ─────────────────────────── */
export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bm_user")) || null; } catch { return null; }
  });
  const login = (userData) => { localStorage.setItem("bm_user", JSON.stringify(userData)); setUser(userData); };
  const logout = () => { localStorage.removeItem("bm_user"); setUser(null); };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <Router>
        <GlobalStyle />
        <div className="bg-mesh" />
        <Particles />
        <div className="app">
          <Navbar />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/result" element={<SummaryResultPage />} />
          </Routes>
        </div>
      </Router>
    </AuthContext.Provider>
  );
}