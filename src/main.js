import '@fontsource/noto-serif/400.css';
import '@fontsource/noto-serif/700.css';
import '@fontsource/noto-sans/400.css';
import '@fontsource/noto-sans/700.css';
import '@fontsource/noto-naskh-arabic/400.css';
import '@fontsource/noto-naskh-arabic/700.css';
import '@fontsource/noto-sans-tifinagh/400.css';
import './style.css';
import { t, setLang, getLang, applyDir, UI_LANGS, themeName } from './i18n.js';
import { toTifinagh, toArabicScript } from './translit.js';
import { ttsSupported, splitSentences, pickVoices, Speaker } from './tts.js';
import { idbGet, idbSet, idbDel } from './db.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = $('#app');
const LS = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => localStorage.setItem(k, JSON.stringify(v)) };
const LANG_LABEL = { fr: 'FR', ar: 'AR', kab: 'KAB', en: 'EN' };
const NLLB = { fr: 'fra_Latn', ar: 'arb_Arab', kab: 'kab_Latn', en: 'eng_Latn' };
const BOOK_CACHE = 'books-v1';
let catalogue = [];
let deferredInstall = null;
const state = LS.get('libState', { q: '', lang: 'all', theme: 'all', sort: 'title', byAuthor: false });
const prefs = LS.get('readerPrefs', { size: 19, font: 'serif', theme: 'light', lh: 1.7, kabScript: 'latn', rate: 1, pitch: 1, volume: 1, voice: '' });
const saveState = () => LS.set('libState', state);
const savePrefs = () => LS.set('readerPrefs', prefs);

applyDir();
document.body.dataset.theme = prefs.theme;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; $('#install')?.removeAttribute('hidden'); });
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});

async function loadCatalogue() {
  const r = await fetch('./catalogue.json'); catalogue = await r.json();
  catalogue.forEach((b) => { delete b.key; });
}
async function isOffline(b) { try { const c = await caches.open(BOOK_CACHE); return !!(await c.match(new URL(b.file, location.href).href)); } catch { return false; } }

function header(extra = '') {
  return `<header class="top"><a href="#/" class="brand"><img src="icon.svg" alt="" width="32" height="32"><span>${t('app')}</span></a>
  <div class="top-actions">${extra}<button id="install" class="btn" hidden>${t('install')}</button>
  <select id="uiLang" aria-label="${t('uiLang')}">${Object.entries(UI_LANGS).map(([k, v]) => `<option value="${k}" ${k === getLang() ? 'selected' : ''}>${v}</option>`).join('')}</select></div></header>`;
}
function bindHeader() {
  $('#uiLang').onchange = (e) => { setLang(e.target.value); route(); };
  const ib = $('#install'); if (deferredInstall) ib.hidden = false;
  ib.onclick = async () => { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; ib.hidden = true; };
}

// ---------- Bibliothèque ----------
function filtered() {
  const q = state.q.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let list = catalogue.filter((b) => (state.lang === 'all' || b.language === state.lang) && (state.theme === 'all' || b.theme === state.theme)
    && (!q || norm(b.title + ' ' + b.author + ' ' + b.summary).includes(q)));
  const k = { title: (b) => b.title, author: (b) => b.author, year: (b) => b.year ?? 9999, lang: (b) => b.language }[state.sort];
  list.sort((a, b) => { const x = k(a), y = k(b); return typeof x === 'number' ? x - y : String(x).localeCompare(String(y), getLang()); });
  return list;
}
function card(b) {
  const rtl = b.language === 'ar';
  const cover = b.cover ? `<img class="cover" src="${esc(b.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'cover ph',textContent:this.dataset.l}))" data-l="${esc(b.title[0])}">` : `<div class="cover ph l-${b.language}">${esc(b.title.trim()[0])}</div>`;
  return `<article class="card"><a href="#/book/${encodeURIComponent(b.id)}" class="card-link">${cover}
  <div class="card-body"><h3 dir="${rtl ? 'rtl' : 'auto'}" lang="${b.language}">${esc(b.title)}</h3><p class="author" dir="auto">${esc(b.author)}${b.year ? ` · ${b.year < 0 ? -b.year + ' av. J.-C.' : b.year}` : ''}</p>
  <p class="tags"><span class="badge l-${b.language}">${LANG_LABEL[b.language]}</span><span class="badge">${esc(themeName(b.theme))}</span>${b.note ? `<span class="badge warn">${esc(t('ocr'))}</span>` : ''}<span class="badge ok off-${esc(b.id)}" hidden>⤓ ${t('offline')}</span></p>
  <p class="summary" dir="auto">${esc(b.summary).slice(0, 220)}${b.summary?.length > 220 ? '…' : ''}</p></div></a></article>`;
}
function renderLibrary() {
  const themes = [...new Set(catalogue.map((b) => b.theme))];
  const counts = Object.fromEntries(Object.keys(LANG_LABEL).map((l) => [l, catalogue.filter((b) => b.language === l).length]));
  app.innerHTML = header() + `<main class="lib"><p class="tagline">${t('tagline')}</p>
  <div class="filters"><input id="q" type="search" placeholder="${t('search')}" value="${esc(state.q)}" aria-label="${t('search')}">
  <div class="chips" role="group">${['all', 'kab', 'ar', 'fr', 'en'].map((l) => `<button class="chip ${state.lang === l ? 'on' : ''}" data-lang="${l}">${l === 'all' ? t('all') : LANG_LABEL[l]}${l !== 'all' ? ` <small>${counts[l]}</small>` : ''}</button>`).join('')}</div>
  <div class="row"><select id="theme" aria-label="theme"><option value="all">${t('allThemes')}</option>${themes.map((th) => `<option value="${esc(th)}" ${state.theme === th ? 'selected' : ''}>${esc(themeName(th))}</option>`).join('')}</select>
  <select id="sort" aria-label="${t('sort')}">${['title', 'author', 'year', 'lang'].map((s) => `<option value="${s}" ${state.sort === s ? 'selected' : ''}>${t('sort')} : ${t('sort' + s[0].toUpperCase() + s.slice(1))}</option>`).join('')}</select>
  <button id="byAuthor" class="btn ${state.byAuthor ? 'on' : ''}">${state.byAuthor ? t('grid') : t('byAuthor')}</button></div></div>
  <div id="results"></div><footer class="foot"><details><summary>${t('about')}</summary><p>${t('aboutText')}</p></details></footer></main>`;
  bindHeader();
  const draw = async () => {
    const list = filtered(); const el = $('#results');
    if (!list.length) { el.innerHTML = `<p class="empty">${t('none')}</p>`; return; }
    if (state.byAuthor) {
      const g = {}; list.forEach((b) => (g[b.author] ??= []).push(b));
      el.innerHTML = Object.keys(g).sort((a, b) => a.localeCompare(b)).map((a) => `<section class="author-group"><h2 dir="auto">${esc(a)} <small>(${g[a].length})</small></h2><div class="grid">${g[a].map(card).join('')}</div></section>`).join('');
    } else el.innerHTML = `<p class="count">${list.length} ${t('books')}</p><div class="grid">${list.map(card).join('')}</div>`;
    for (const b of list) if (await isOffline(b)) document.querySelectorAll('.off-' + CSS.escape(b.id)).forEach((x) => (x.hidden = false));
  };
  $('#q').oninput = (e) => { state.q = e.target.value; saveState(); draw(); };
  app.querySelectorAll('.chip').forEach((c) => (c.onclick = () => { state.lang = c.dataset.lang; saveState(); renderLibrary(); }));
  $('#theme').onchange = (e) => { state.theme = e.target.value; saveState(); draw(); };
  $('#sort').onchange = (e) => { state.sort = e.target.value; saveState(); draw(); };
  $('#byAuthor').onclick = () => { state.byAuthor = !state.byAuthor; saveState(); renderLibrary(); };
  draw();
}

// ---------- Lecteur ----------
let reader = null;
function splitParas(text) {
  // Paragraphes séparés par une ligne vide ; les lignes simples d'un même paragraphe sont jointes (sauf poésie : on garde les retours).
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => {
    const lines = p.split('\n'); if (lines.length < 2) return p;
    const avg = p.length / lines.length; // prose à retours durs (Gutenberg, OCR) : on rejoint ; vers courts : on garde
    return avg > 50 ? p.replace(/-\n(?=\p{Ll})/gu, '').replace(/\s*\n\s*/g, ' ') : p;
  });
}
function displayText(s, lang) {
  if (lang === 'kab' && prefs.kabScript === 'tfng') return toTifinagh(s);
  if (lang === 'kab' && prefs.kabScript === 'arab') return toArabicScript(s);
  return s;
}
function scriptDir(lang) { return lang === 'ar' || (lang === 'kab' && prefs.kabScript === 'arab') ? 'rtl' : 'ltr'; }

async function renderReader(id) {
  const b = catalogue.find((x) => x.id === id); if (!b) { location.hash = '#/'; return; }
  speaker?.stop();
  app.innerHTML = header() + `<main class="reader-wrap"><p class="loading">${t('loading')}</p></main>`; bindHeader();
  let text;
  try { const r = await fetch(b.file); if (!r.ok) throw new Error(r.status); text = await r.text(); }
  catch (e) { app.querySelector('.loading').textContent = '⚠ ' + e.message; return; }
  const paras = splitParas(text);
  const trKey = (tgt, model) => `${b.id}|${tgt}|${model}`;
  reader = { b, paras, view: 'orig', tr: null, trLang: null };
  const pos = LS.get('pos:' + b.id, 0);
  app.innerHTML = header(`<a class="btn" href="#/">← ${t('back')}</a>`) + `
  <div class="toolbar" role="toolbar">
   <button class="btn" data-panel="p-settings" title="${t('settings')}">Aa</button>
   <button class="btn" data-panel="p-tts" title="${t('tts')}">🔊</button>
   <button class="btn" data-panel="p-bm" title="${t('bookmarks')}">🔖</button>
   <button class="btn" data-panel="p-tr" title="${t('translate')}">🌐 <span class="hide-sm">${t('translate')}</span></button>
   <button class="btn" data-panel="p-info" title="${t('source')}">ℹ</button>
   <div id="viewSel" class="seg" hidden><button data-v="orig">${t('original')}</button><button data-v="tr">${t('translation')}</button><button data-v="bi">${t('bilingual')}</button></div>
  </div>
  <section id="p-settings" class="panel" hidden>
   <label>${t('fontSize')} <input id="fs" type="range" min="13" max="34" value="${prefs.size}"></label>
   <label>${t('font')} <select id="ff"><option value="serif">Noto Serif</option><option value="sans">Noto Sans</option><option value="naskh">Noto Naskh Arabic</option><option value="tfng">Noto Sans Tifinagh</option><option value="system">Système</option></select></label>
   <label>${t('lineHeight')} <input id="lh" type="range" min="1.2" max="2.4" step="0.1" value="${prefs.lh}"></label>
   <div class="seg" id="themeSel">${['light', 'sepia', 'dark'].map((th) => `<button data-th="${th}" class="${prefs.theme === th ? 'on' : ''}">${t(th)}</button>`).join('')}</div>
   ${b.language === 'kab' ? `<label>${t('script')} <select id="ks"><option value="latn">${t('latin')}</option><option value="tfng">${t('tifinagh')} ⵜⵉⴼⵉⵏⴰⵖ</option><option value="arab">${t('arabicScript')}</option></select></label><p class="hint">Tifinagh / arabe : translittération automatique approximative.</p>` : ''}
  </section>
  <section id="p-tts" class="panel" hidden></section>
  <section id="p-bm" class="panel" hidden></section>
  <section id="p-tr" class="panel" hidden></section>
  <section id="p-info" class="panel" hidden>
   <h2 dir="auto">${esc(b.title)}</h2><p dir="auto">${esc(b.author)}${b.year ? ' · ' + b.year : ''}</p><p dir="auto">${esc(b.summary)}</p>
   <p><b>${t('source')} :</b> ${esc(b.source)}<br><b>${t('license')} :</b> ${esc(b.license)}<br><a href="${esc(b.url)}" target="_blank" rel="noopener noreferrer">${t('origin')} ↗</a></p>
   <button id="dl" class="btn">${t('download')}</button>
  </section>
  <div id="trBanner" class="banner" hidden>⚠ ${t('mtWarn')}</div>
  <article id="text" class="reader" lang="${b.language}"></article>`;
  bindHeader();
  app.querySelectorAll('[data-panel]').forEach((btn) => (btn.onclick = () => { const p = $('#' + btn.dataset.panel); const was = p.hidden; app.querySelectorAll('.panel').forEach((x) => (x.hidden = true)); p.hidden = !was; }));
  $('#ff').value = prefs.font; if ($('#ks')) $('#ks').value = prefs.kabScript;
  const applyPrefs = () => { const el = $('#text'); el.style.fontSize = prefs.size + 'px'; el.style.lineHeight = prefs.lh; el.dataset.font = prefs.font; document.body.dataset.theme = prefs.theme; savePrefs(); };
  $('#fs').oninput = (e) => { prefs.size = +e.target.value; applyPrefs(); };
  $('#lh').oninput = (e) => { prefs.lh = +e.target.value; applyPrefs(); };
  $('#ff').onchange = (e) => { prefs.font = e.target.value; applyPrefs(); };
  $('#themeSel').onclick = (e) => { const th = e.target.dataset.th; if (!th) return; prefs.theme = th; $('#themeSel').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.th === th)); applyPrefs(); };
  if ($('#ks')) $('#ks').onchange = (e) => { prefs.kabScript = e.target.value; if (e.target.value === 'tfng') prefs.font = 'tfng'; else if (prefs.font === 'tfng') prefs.font = 'serif'; $('#ff').value = prefs.font; applyPrefs(); drawText(); };
  if (b.language === 'ar' && prefs.font !== 'naskh' && !LS.get('fontChosen:ar')) { prefs.font = 'naskh'; }
  $('#ff').onchange = (e) => { prefs.font = e.target.value; if (b.language === 'ar') LS.set('fontChosen:ar', 1); applyPrefs(); };
  applyPrefs();

  $('#dl').onclick = async () => { try { const c = await caches.open(BOOK_CACHE); await c.add(new URL(b.file, location.href).href); $('#dl').textContent = '✓ ' + t('downloaded'); } catch (e) { $('#dl').textContent = '⚠ ' + e.message; } };
  if (await isOffline(b)) $('#dl').textContent = '✓ ' + t('downloaded');

  // Rendu du texte (paragraphes)
  function drawText() {
    const el = $('#text'); const v = reader.view; const tr = reader.tr || []; const hasTr = !!reader.tr;
    const ol = b.language, tl = reader.trLang;
    el.className = 'reader' + (v === 'bi' ? ' bi' : '');
    el.innerHTML = paras.map((p, i) => {
      const orig = `<p class="para" data-i="${i}" dir="${scriptDir(ol) === 'rtl' && ol !== 'ar' ? 'rtl' : 'auto'}" lang="${ol}">${esc(displayText(p, ol))}</p>`;
      const trp = tr[i] != null ? `<p class="para tr" data-i="${i}" dir="auto" lang="${tl}">${esc(displayText(tr[i], tl))}</p>` : '';
      if (v === 'orig' || !hasTr) return orig;
      if (v === 'tr') return trp || orig.replace('class="para"', 'class="para untr"');
      return `<div class="pair" data-i="${i}">${orig}${trp || '<p class="para tr pending">…</p>'}</div>`;
    }).join('');
    $('#trBanner').hidden = !(hasTr && v !== 'orig');
  }
  reader.drawText = drawText;
  drawText();
  // reprise de lecture
  const target = app.querySelector(`.para[data-i="${pos}"]`);
  if (pos > 0 && target) { target.scrollIntoView({ block: 'start' }); toast(t('resumed')); }
  let st; window.onscroll = () => { clearTimeout(st); st = setTimeout(() => { const i = currentPara(); if (reader?.b === b) LS.set('pos:' + b.id, i); }, 300); };

  setupBookmarks(b); setupTTS(b); setupTranslate(b, trKey);
  $('#viewSel').onclick = (e) => { const v = e.target.dataset.v; if (!v) return; reader.view = v; segOn(); drawText(); };
  const segOn = () => $('#viewSel').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.v === reader.view));
  reader.segOn = segOn;
}
function currentPara() {
  const ps = app.querySelectorAll('#text .para:not(.tr)'); const y = 90;
  let lo = 0, hi = ps.length - 1, ans = 0;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (ps[m].getBoundingClientRect().top < y) { ans = m; lo = m + 1; } else hi = m - 1; }
  return ps.length ? +ps[ans].dataset.i : 0;
}
function toast(msg) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; document.body.append(d); setTimeout(() => d.remove(), 2500); }

function setupBookmarks(b) {
  const el = $('#p-bm'); const key = 'bm:' + b.id;
  const draw = () => {
    const bms = LS.get(key, []);
    el.innerHTML = `<button class="btn" id="addBm">＋ ${t('addBookmark')}</button>` + (bms.length ? `<ul class="bms">${bms.map((m, j) => `<li><a href="#" data-i="${m.i}" dir="auto">§${m.i + 1} — ${esc(m.ex)}</a> <button data-del="${j}" aria-label="×">×</button></li>`).join('')}</ul>` : `<p>${t('noBookmarks')}</p>`);
    $('#addBm').onclick = () => { const i = currentPara(); const bm = LS.get(key, []); if (!bm.some((m) => m.i === i)) bm.push({ i, ex: reader.paras[i].slice(0, 60), d: Date.now() }); bm.sort((a, c) => a.i - c.i); LS.set(key, bm); draw(); };
    el.querySelectorAll('a[data-i]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); app.querySelector(`.para[data-i="${a.dataset.i}"]`)?.scrollIntoView({ block: 'start' }); el.hidden = true; }));
    el.querySelectorAll('[data-del]').forEach((x) => (x.onclick = () => { const bm = LS.get(key, []); bm.splice(+x.dataset.del, 1); LS.set(key, bm); draw(); }));
  };
  draw();
}

// ---------- Lecture à voix haute ----------
let speaker = null;
function setupTTS(b) {
  const el = $('#p-tts');
  if (!ttsSupported()) { el.innerHTML = `<p>${t('noTTS')}</p>`; return; }
  const tts = { para: 0, sent: 0, sents: [], lang: b.language, src: 'orig' };
  speaker = new Speaker({ onEnd: () => step(1, true), onError: (e) => toast('TTS : ' + e) });
  el.innerHTML = `<div class="tts-ctrl"><button class="btn" id="tPrev" title="${t('prev')}">⏮</button><button class="btn big" id="tPlay">▶ ${t('play')}</button><button class="btn" id="tStop" title="${t('stop')}">⏹</button><button class="btn" id="tNext" title="${t('next')}">⏭</button></div>
   <p id="tWarn" class="warn-txt" hidden></p>
   <label>${t('voice')} <select id="tVoice"></select></label>
   <label>${t('rate')} <input id="tRate" type="range" min="0.5" max="2" step="0.1" value="${prefs.rate}"></label>
   <label>${t('pitch')} <input id="tPitch" type="range" min="0.5" max="2" step="0.1" value="${prefs.pitch}"></label>
   <label>${t('volume')} <input id="tVol" type="range" min="0" max="1" step="0.1" value="${prefs.volume}"></label>
   <label>${t('sleep')} <select id="tSleep"><option value="0">${t('sleepOff')}</option>${[5, 10, 15, 30, 45, 60].map((m) => `<option value="${m}">${m} ${t('min')}</option>`).join('')}</select></label>`;
  const fillVoices = () => {
    const readLang = reader.view === 'tr' && reader.trLang ? reader.trLang : b.language; tts.lang = readLang;
    const { list, fallback } = pickVoices(readLang); const sel = $('#tVoice'); if (!sel) return;
    sel.innerHTML = list.map((v) => `<option value="${esc(v.name)}">${esc(v.name)} (${esc(v.lang)})</option>`).join('');
    if (list.some((v) => v.name === prefs.voice)) sel.value = prefs.voice;
    speaker.opts.voice = list.find((v) => v.name === sel.value) || null; speaker.opts.lang = readLang;
    const w = $('#tWarn'); w.hidden = !(fallback || !list.length); w.textContent = !list.length ? t('noVoices') : t('kabWarn');
  };
  speechSynthesis.onvoiceschanged = fillVoices; fillVoices(); reader.fillVoices = fillVoices;
  Object.assign(speaker.opts, { rate: prefs.rate, pitch: prefs.pitch, volume: prefs.volume });
  $('#tVoice').onchange = (e) => { prefs.voice = e.target.value; savePrefs(); fillVoices(); };
  for (const [id, k] of [['tRate', 'rate'], ['tPitch', 'pitch'], ['tVol', 'volume']]) $('#' + id).oninput = (e) => { prefs[k] = speaker.opts[k] = +e.target.value; savePrefs(); };
  $('#tSleep').onchange = (e) => speaker.sleep(+e.target.value, () => { setPlayBtn(false); clearHi(); });
  const paraText = (i) => (reader.view !== 'orig' && reader.tr?.[i] != null && reader.view === 'tr') ? reader.tr[i] : reader.paras[i];
  const paraEl = (i) => app.querySelector(reader.view === 'tr' && reader.tr?.[i] != null ? `.para.tr[data-i="${i}"]` : `.para:not(.tr)[data-i="${i}"]`);
  function clearHi() { app.querySelectorAll('.para.speaking').forEach((p) => { p.classList.remove('speaking'); if (p.dataset.orig) { p.innerHTML = p.dataset.orig; delete p.dataset.orig; } }); }
  function highlight() {
    clearHi(); const p = paraEl(tts.para); if (!p) return;
    p.classList.add('speaking'); p.dataset.orig = p.innerHTML;
    const lang = p.lang;
    p.innerHTML = tts.sents.map((s, j) => `<span class="${j === tts.sent ? 'hl' : ''}">${esc(displayText(s, lang))}</span>`).join('');
    p.querySelector('.hl')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function load(i) { tts.para = i; tts.sents = splitSentences(paraText(i)); tts.sent = 0; }
  function sayCurrent() { highlight(); speaker.speak(tts.sents[tts.sent] || ' '); }
  function step(d, auto = false) {
    tts.sent += d;
    if (tts.sent >= tts.sents.length) { if (tts.para + 1 >= reader.paras.length) { stop(); return; } load(tts.para + 1); }
    else if (tts.sent < 0) { if (tts.para === 0) tts.sent = 0; else { load(tts.para - 1); tts.sent = tts.sents.length - 1; } }
    if (auto && !speaker.playing) return;
    if (speaker.playing) sayCurrent(); else highlight();
  }
  function setPlayBtn(on) { $('#tPlay').textContent = on ? '⏸ ' + t('pause') : '▶ ' + t('play'); }
  function stop() { speaker.stop(); clearHi(); setPlayBtn(false); tts.started = false; }
  $('#tPlay').onclick = () => {
    if (speaker.playing) { speaker.pause(); setPlayBtn(false); return; }
    if (tts.started && speechSynthesis.paused) { speaker.resume(); setPlayBtn(true); return; }
    fillVoices(); if (!tts.started) { load(currentPara()); tts.started = true; }
    speaker.playing = true; setPlayBtn(true); sayCurrent();
  };
  $('#tStop').onclick = stop;
  $('#tPrev').onclick = () => { if (!tts.started) { load(currentPara()); tts.started = true; } step(-1); };
  $('#tNext').onclick = () => { if (!tts.started) { load(currentPara()); tts.started = true; } step(1); };
}

// ---------- Traduction ----------
let worker = null, reqId = 0;
const pending = new Map();
function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./translate-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => { const h = pending.get(data.id); if (!h) return; if (data.type === 'progress') h.onProgress?.(data.p); else { pending.delete(data.id); data.type === 'error' ? h.rej(new Error(data.error)) : h.res(data); } };
  return worker;
}
const call = (msg, onProgress) => new Promise((res, rej) => { const id = ++reqId; pending.set(id, { res, rej, onProgress }); getWorker().postMessage({ ...msg, id }); });
function chunkPara(p, max = 450) {
  if (p.length <= max) return [p];
  const out = []; let cur = '';
  for (const s of splitSentences(p)) { if ((cur + s).length > max && cur) { out.push(cur); cur = ''; } cur += s; }
  if (cur) out.push(cur);
  return out.flatMap((c) => c.length > max * 2 ? c.match(new RegExp(`[\\s\\S]{1,${max}}(\\s|$)`, 'g')) : [c]);
}
function setupTranslate(b, trKey) {
  const el = $('#p-tr'); const langs = ['fr', 'ar', 'kab', 'en'].filter((l) => l !== b.language);
  el.innerHTML = `<p class="banner">⚠ ${t('mtWarn')}</p>
   <label>${t('translateTo')} <select id="trTgt">${langs.map((l) => `<option value="${l}">${LANG_LABEL[l]}</option>`).join('')}</select></label>
   <fieldset><legend>${t('model')}</legend><label class="radio"><input type="radio" name="m" value="nllb" checked> ${t('nllb')}</label>
   <label class="radio" id="marianOpt"><input type="radio" name="m" value="marian"> ${t('marian')}</label></fieldset>
   <p class="hint">${t('sizeWarn')}</p>
   <label class="radio"><input type="checkbox" id="trFrom" checked> ${t('trFrom')}</label>
   <div class="row"><button class="btn big" id="trStart">${t('start')}</button><button class="btn" id="trStop" disabled>${t('stopTr')}</button><button class="btn" id="trClear">${t('clearTr')}</button></div>
   <progress id="trProg" max="100" value="0" hidden></progress><p id="trStatus" class="hint"></p>`;
  let running = false;
  const modelId = () => { const m = el.querySelector('input[name=m]:checked').value; const tgt = $('#trTgt').value;
    return m === 'marian' ? { key: 'marian', id: `Xenova/opus-mt-${b.language}-${tgt}`, src: null } : { key: 'nllb', id: 'Xenova/nllb-200-distilled-600M', src: NLLB[b.language], tgt: NLLB[tgt] }; };
  const marianOk = () => { const tgt = $('#trTgt').value; const ok = (b.language === 'fr' && tgt === 'en') || (b.language === 'en' && tgt === 'fr'); $('#marianOpt').hidden = !ok; if (!ok) el.querySelector('input[value=nllb]').checked = true; };
  const loadExisting = async () => {
    const m = modelId(); const saved = await idbGet(trKey($('#trTgt').value, m.key)).catch(() => null);
    reader.tr = saved?.paras || null; reader.trLang = $('#trTgt').value;
    const n = reader.tr ? reader.tr.filter((x) => x != null).length : 0;
    $('#trStatus').textContent = n ? `${t('progress')} : ${n}/${reader.paras.length} ${t('paragraphs')}` : '';
    $('#viewSel').hidden = !n; if (n && reader.view === 'orig') reader.view = 'bi';
    if (!n) reader.view = 'orig'; reader.segOn(); reader.drawText(); reader.fillVoices?.();
  };
  const remember = () => LS.set('trSel:' + b.id, { tgt: $('#trTgt').value, m: el.querySelector('input[name=m]:checked').value });
  $('#trTgt').onchange = () => { marianOk(); remember(); loadExisting(); };
  el.querySelectorAll('input[name=m]').forEach((r) => (r.onchange = () => { remember(); loadExisting(); }));
  const sel = LS.get('trSel:' + b.id, null);
  if (sel && langs.includes(sel.tgt)) { $('#trTgt').value = sel.tgt; marianOk(); const r = el.querySelector(`input[value=${sel.m}]`); if (r && !(sel.m === 'marian' && $('#marianOpt').hidden)) r.checked = true; }
  marianOk(); loadExisting();
  $('#trClear').onclick = async () => { await idbDel(trKey($('#trTgt').value, modelId().key)); loadExisting(); };
  $('#trStop').onclick = () => { running = false; };
  $('#trStart').onclick = async () => {
    if (running) return; running = true; remember(); $('#trStart').disabled = true; $('#trStop').disabled = false;
    const tgt = $('#trTgt').value; const m = modelId(); const key = trKey(tgt, m.key);
    const prog = $('#trProg'); prog.hidden = false; const status = $('#trStatus');
    try {
      status.textContent = t('loadingModel');
      const files = {};
      await call({ type: 'load', model: m.id }, (p) => {
        if (p.status === 'progress' && p.file) { files[p.file] = [p.loaded, p.total]; const L = Object.values(files).reduce((a, x) => a + x[0], 0), T = Object.values(files).reduce((a, x) => a + x[1], 0); prog.value = T ? (100 * L) / T : 0; status.textContent = `${t('loadingModel')} ${(L / 1e6).toFixed(0)} / ${(T / 1e6).toFixed(0)} Mo`; }
      });
      const saved = (await idbGet(key)) || { paras: [] }; const out = saved.paras; reader.tr = out; reader.trLang = tgt;
      $('#viewSel').hidden = false; if (reader.view === 'orig') reader.view = 'bi'; reader.segOn(); reader.drawText();
      const start = $('#trFrom').checked ? currentPara() : 0;
      const order = [...Array(reader.paras.length).keys()].slice(start).concat([...Array(start).keys()]);
      const todo = order.filter((i) => out[i] == null); let done = reader.paras.length - todo.length;
      const BATCH = 4;
      for (let k = 0; k < todo.length && running; k += BATCH) {
        const idx = todo.slice(k, k + BATCH);
        const chunks = idx.map((i) => chunkPara(reader.paras[i]));
        const flat = chunks.flat();
        const res = await call({ type: 'translate', texts: flat, src: m.src, tgt: m.tgt });
        let p = 0; idx.forEach((i, j) => { const n = chunks[j].length; out[i] = res.texts.slice(p, p + n).join(' '); p += n; });
        await idbSet(key, { paras: out, model: m.id, updated: Date.now() });
        done += idx.length; prog.value = (100 * done) / reader.paras.length;
        status.textContent = `${t('translating')} : ${done}/${reader.paras.length} ${t('paragraphs')}`;
        idx.forEach((i) => updatePara(i, out[i], tgt));
      }
      status.textContent = running ? t('done') : status.textContent;
    } catch (e) { console.error(e); status.textContent = `${t("trError")} : ${e.message}`; }
    running = false; $('#trStart').disabled = false; $('#trStop').disabled = true;
  };
}
function updatePara(i, txt, tl) {
  const v = reader.view; if (v === 'orig') return;
  const html = `<p class="para tr" data-i="${i}" dir="${tl === 'ar' ? 'rtl' : 'ltr'}" lang="${tl}">${esc(displayText(txt, tl))}</p>`;
  if (v === 'bi') { const pr = app.querySelector(`.pair[data-i="${i}"] .tr`); if (pr) pr.outerHTML = html; }
  else { const pr = app.querySelector(`.para[data-i="${i}"]`); if (pr) pr.outerHTML = html; }
}

// ---------- Routeur ----------
function route() {
  window.onscroll = null;
  const m = location.hash.match(/^#\/book\/(.+)$/);
  if (m) renderReader(decodeURIComponent(m[1])); else { speaker?.stop(); document.body.dataset.theme = prefs.theme; renderLibrary(); }
}
window.addEventListener('hashchange', route);
loadCatalogue().then(route).catch((e) => { app.innerHTML = `<p class="loading">⚠ ${esc(e.message)}</p>`; });
