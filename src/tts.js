// Lecture à voix haute (Web Speech API) : découpage en phrases courtes, choix de voix, pause/reprise fiable.
export const ttsSupported = () => 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
export const BCP = { fr: 'fr-FR', en: 'en-US', ar: 'ar-SA', kab: 'kab' };
const MAX = 200; // Chrome coupe les énoncés longs (~15 s) : on garde des morceaux courts

// Découpe en phrases : Intl.Segmenter si disponible (gère l'arabe), sinon ponctuation latine + arabe (. ! ? ؟ … ، ؛ et sauts de ligne).
export function splitSentences(text, lang = 'fr') {
  let parts = [];
  try {
    if ('Segmenter' in Intl) parts = [...new Intl.Segmenter(lang === 'kab' ? 'fr' : lang, { granularity: 'sentence' }).segment(text)].map((s) => s.segment);
  } catch {}
  if (!parts.length) {
    const re = /[.!?؟…]+["»”’)\]]*(?=\s)|[\n۔]/g; let last = 0, m;
    while ((m = re.exec(text))) { const end = m.index + m[0].length; parts.push(text.slice(last, end)); last = end; }
    parts.push(text.slice(last));
  }
  // découpe supplémentaire des segments trop longs (virgules latines/arabes, points-virgules, puis espaces)
  const out = [];
  for (const p of parts.flatMap((s) => s.split(/(?<=\n)/))) {
    if (!p.trim()) { if (out.length) out[out.length - 1] += p; continue; }
    if (p.length <= MAX) { out.push(p); continue; }
    let cur = '';
    for (const piece of p.split(/(?<=[,،;؛:])\s+/)) {
      if ((cur + piece).length > MAX && cur) { out.push(cur + ' '); cur = ''; }
      if (piece.length > MAX) { for (const w of piece.split(/(?<=\s)/)) { if ((cur + w).length > MAX && cur) { out.push(cur); cur = ''; } cur += w; } }
      else cur += (cur ? ' ' : '') + piece;
    }
    if (cur) out.push(cur);
  }
  return out.length ? out : [text];
}

// Texte envoyé au moteur : sans tatweel, sans signes de pause coraniques, sans caractères invisibles ni appels de notes.
export function speakable(s) {
  return s.replace(/\u0640/g, '').replace(/[\u06D6-\u06ED\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
    .replace(/\[\d+\]|\(\d+\)/g, '').replace(/[_*#]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Les voix arrivent de façon asynchrone (voiceschanged) : on attend jusqu'à 3 s.
export function loadVoices() {
  return new Promise((res) => {
    const v = speechSynthesis.getVoices(); if (v.length) return res(v);
    const done = () => res(speechSynthesis.getVoices());
    speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 3000);
  });
}
const langOf = (v) => (v.lang || '').toLowerCase().replace('_', '-');
const QUALITY = /natural|neural|online|premium|enhanced|google|siri|wavenet|microsoft .* online/i;
export function rankVoices(list, lang) {
  const pref = BCP[lang]?.toLowerCase();
  const score = (v) => (QUALITY.test(v.name) ? 4 : 0) + (langOf(v) === pref ? 2 : 0) + (v.localService === false ? 1 : 0) + (v.default ? 0.5 : 0);
  return [...list].sort((a, b) => score(b) - score(a));
}
export function pickVoices(lang, all = speechSynthesis.getVoices()) {
  const m = (p) => all.filter((v) => { const l = langOf(v); return l === p || l.startsWith(p + '-') || (p === 'ar' && l.startsWith('ara')); });
  let list = m(lang), fallback = false;
  if (lang === 'kab' && !list.length) { list = [...m('fr'), ...m('ar')]; fallback = true; }
  return { list: rankVoices(list, lang), all, fallback, missing: !list.length };
}

// Lecteur : une phrase par énoncé. La pause est un « cancel + mémorisation », ce qui marche aussi sur Android/iOS
// (speechSynthesis.pause() y est peu fiable). Un minuteur de secours relance si « onend » n'arrive jamais (bug Chrome).
export class Speaker {
  constructor(cb) { this.cb = cb; this.opts = { rate: 1, pitch: 1, volume: 1, voice: null, lang: 'fr' }; this.playing = false; this.timer = null; this.guard = null; this.gen = 0; }
  speak(text) {
    const gen = ++this.gen; clearTimeout(this.guard);
    speechSynthesis.cancel();
    const clean = speakable(text);
    if (!clean) { setTimeout(() => this.playing && gen === this.gen && this.cb.onEnd(), 50); return; }
    const u = new SpeechSynthesisUtterance(clean);
    const o = this.opts; u.rate = o.rate; u.pitch = o.pitch; u.volume = o.volume;
    u.lang = o.voice ? o.voice.lang : BCP[o.lang] || o.lang; if (o.voice) u.voice = o.voice;
    const finish = () => { clearTimeout(this.guard); if (this.playing && gen === this.gen) { this.gen++; this.cb.onEnd(); } };
    u.onend = finish;
    u.onerror = (e) => { if (e.error === 'interrupted' || e.error === 'canceled') return; this.pause(); this.cb.onError?.(e.error); };
    u.onstart = () => { clearTimeout(this.guard); this.guard = setTimeout(finish, (clean.length * 120) / o.rate + 8000); };
    // certains navigateurs ignorent speak() juste après cancel() : petit délai
    setTimeout(() => { if (gen === this.gen) { speechSynthesis.speak(u); this.guard = setTimeout(finish, (clean.length * 120) / o.rate + 12000); } }, 60);
  }
  pause() { this.playing = false; this.gen++; clearTimeout(this.guard); speechSynthesis.cancel(); }
  stop() { this.pause(); }
  sleep(min, onFire) { clearTimeout(this.timer); if (min > 0) this.timer = setTimeout(() => { this.stop(); onFire(); }, min * 60000); }
}
export function installHelp() {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Android : Paramètres › Accessibilité (ou Système › Langues) › Synthèse vocale › moteur « Services vocaux Google » › Installer les données vocales › العربية. Redémarrez ensuite le navigateur.';
  if (/iPhone|iPad|Macintosh/i.test(ua) && 'ontouchend' in document) return 'iPhone/iPad : Réglages › Accessibilité › Contenu énoncé › Voix › Arabe › télécharger une voix (ex. Majed). Rechargez ensuite la page.';
  if (/Mac/i.test(ua)) return 'macOS : Réglages Système › Accessibilité › Contenu énoncé › Voix du système › Gérer les voix › Arabe.';
  if (/Windows/i.test(ua)) return 'Windows : Paramètres › Heure et langue › Voix (Speech) › Ajouter des voix › Arabe. Ou utilisez Microsoft Edge, qui propose des voix arabes en ligne (« Online (Natural) »).';
  return 'Linux : installez une voix arabe (ex. paquet espeak-ng ou speech-dispatcher avec une voix arabe) ; Chrome et Edge proposent parfois des voix en ligne.';
}
