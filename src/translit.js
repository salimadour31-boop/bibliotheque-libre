// Translittération approximative du kabyle (alphabet latin berbère) vers tifinagh (néo-tifinagh) et graphie arabe.
const TIF = { a: 'ⴰ', b: 'ⴱ', c: 'ⵛ', č: 'ⵞ', d: 'ⴷ', ḍ: 'ⴹ', e: 'ⴻ', ɛ: 'ⵄ', f: 'ⴼ', g: 'ⴳ', ǧ: 'ⴵ', ɣ: 'ⵖ', γ: 'ⵖ', h: 'ⵀ', ḥ: 'ⵃ', i: 'ⵉ', j: 'ⵊ', k: 'ⴽ', l: 'ⵍ', m: 'ⵎ', n: 'ⵏ', o: 'ⵓ', p: 'ⴱ', q: 'ⵇ', r: 'ⵔ', ṛ: 'ⵕ', s: 'ⵙ', ṣ: 'ⵚ', t: 'ⵜ', ṭ: 'ⵟ', u: 'ⵓ', v: 'ⴼ', w: 'ⵡ', x: 'ⵅ', y: 'ⵢ', z: 'ⵣ', ẓ: 'ⵥ', ʷ: 'ⵯ', ţ: 'ⵜⵙ' };
const AR = { a: 'ا', b: 'ب', c: 'ش', č: 'تش', d: 'د', ḍ: 'ض', e: '', ɛ: 'ع', f: 'ف', g: 'ڭ', ǧ: 'ج', ɣ: 'غ', γ: 'غ', h: 'ه', ḥ: 'ح', i: 'ي', j: 'ج', k: 'ك', l: 'ل', m: 'م', n: 'ن', o: 'و', p: 'ب', q: 'ق', r: 'ر', ṛ: 'ر', s: 'س', ṣ: 'ص', t: 'ت', ṭ: 'ط', u: 'و', v: 'ف', w: 'و', x: 'خ', y: 'ي', z: 'ز', ẓ: 'ژ', ʷ: 'ۥ', ',': '،', '?': '؟', ';': '؛', ţ: 'ت' };
function conv(text, map) {
  let out = '';
  for (const ch of text.normalize('NFC')) { const l = ch.toLowerCase(); out += l in map ? map[l] : ch; }
  return out;
}
export const toTifinagh = (s) => conv(s, TIF);
export const toArabicScript = (s) => conv(s.replace(/(^|[\s'’-])a/gi, '$1ءa'), AR).replace(/ءا/g, 'أ').replace(/ء/g, 'أ');
