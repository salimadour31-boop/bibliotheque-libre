// Lecture à voix haute avec Web Speech API (speechSynthesis), phrase par phrase.
export const ttsSupported = () => 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
export function splitSentences(text) {
  // Coupe après . ! ? ؟ … suivis d'un espace (évite les URL, nombres décimaux) ou après un saut de ligne.
  const out = []; const re = /[.!?؟…]+["»”’)\]]*(?=\s)|\n/g; let last = 0, m;
  while ((m = re.exec(text))) { const end = m.index + m[0].length; const s = text.slice(last, end); if (s.trim()) out.push(s); last = end; }
  if (last < text.length && text.slice(last).trim()) out.push(text.slice(last));
  return out.length ? out : [text];
}
const BCP = { fr: 'fr', en: 'en', ar: 'ar', kab: 'kab' };
export function pickVoices(lang) {
  const vs = speechSynthesis.getVoices();
  const m = (p) => vs.filter((v) => v.lang.toLowerCase().startsWith(p));
  let list = m(BCP[lang] || lang), fallback = false;
  if (lang === 'kab' && !list.length) { list = [...m('fr'), ...m('ar')]; fallback = true; }
  return { list: list.length ? list : vs, all: vs, fallback };
}
export class Speaker {
  constructor(cb) { this.cb = cb; this.opts = { rate: 1, pitch: 1, volume: 1, voice: null, lang: 'fr' }; this.playing = false; this.timer = null; }
  speak(text) {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const o = this.opts; u.rate = o.rate; u.pitch = o.pitch; u.volume = o.volume;
    if (o.voice) { u.voice = o.voice; u.lang = o.voice.lang; } else u.lang = o.lang;
    u.onend = () => { if (this.playing && this.cur === u) this.cb.onEnd(); };
    u.onerror = (e) => { if (e.error !== 'interrupted' && e.error !== 'canceled') this.cb.onError?.(e.error); };
    this.cur = u; speechSynthesis.speak(u);
  }
  pause() { this.playing = false; speechSynthesis.pause(); }
  resume() { this.playing = true; speechSynthesis.resume(); }
  stop() { this.playing = false; this.cur = null; speechSynthesis.cancel(); }
  sleep(min, onFire) { clearTimeout(this.timer); if (min > 0) this.timer = setTimeout(() => { this.stop(); onFire(); }, min * 60000); }
}
