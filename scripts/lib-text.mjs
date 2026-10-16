// Fonctions de nettoyage partagées (HTML → texte, normalisation UTF-8 NFC).
export const clean = (t) => t.replace(/\r\n?/g, '\n').replace(/\u00ad/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').normalize('NFC').trim() + '\n';
export function htmlToText(html) {
  return html
    .replace(/<(style|script|sup)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<span class="mw-editsection[\s\S]*?<\/span>\s*<\/span>/gi, '')
    .replace(/<div[^>]*class="[^"]*(noprint|ws-noexport|navbox|licenseContainer|reference)[^"]*"[\s\S]*?<\/div>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h\d|li|tr|dd|dt|blockquote|poem)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/\[\d+\]/g, '').replace(/^.*\[\[.*\]\].*$/gm, '').replace(/^نزل نسخة مطبوعة$/gm, '').replace(/[\u200b\u200e\u200f]/g, '').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n');
}
