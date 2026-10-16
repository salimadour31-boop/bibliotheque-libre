#!/usr/bin/env node
// Liste les auteurs d'une Wikisource (espace "Auteur"), récupère leur date de décès sur Wikidata (P570)
// et garde ceux morts au plus tard en 1955 (domaine public en France et en Algérie), puis liste leurs œuvres (pages racines liées).
// Usage : node scripts/wikisource-authors.mjs ar 102 > works-ar.json
const [lang = 'ar', ns = '102', maxYear = '1955'] = process.argv.slice(2);
const UA = 'bibliotheque-libre/2.0 (+https://github.com/salimadour31-boop/bibliotheque-libre)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const J = async (u) => { for (let i = 0; i < 4; i++) { try { const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) }); if (r.ok) return r.json(); } catch {} await sleep(2000 * (i + 1)); } throw new Error('échec ' + u); };
const API = `https://${lang}.wikisource.org/w/api.php?format=json&formatversion=2`;
const authors = []; let cont = '';
do {
  const d = await J(`${API}&action=query&generator=allpages&gapnamespace=${ns}&gaplimit=500&prop=pageprops&ppprop=wikibase_item${cont}`);
  for (const p of d.query?.pages || []) authors.push({ title: p.title, qid: p.pageprops?.wikibase_item });
  cont = d.continue ? `&gapcontinue=${encodeURIComponent(d.continue.gapcontinue)}&continue=${encodeURIComponent(d.continue.continue)}` : '';
  await sleep(300);
} while (cont);
console.error('auteurs', authors.length, 'avec Wikidata', authors.filter((a) => a.qid).length);
const withQ = authors.filter((a) => a.qid);
for (let i = 0; i < withQ.length; i += 50) {
  const b = withQ.slice(i, i + 50);
  const d = await J(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=${b.map((a) => a.qid).join('|')}`);
  for (const a of b) {
    const c = d.entities?.[a.qid]?.claims?.P570?.[0]?.mainsnak?.datavalue?.value?.time;
    if (c) a.death = parseInt(c.slice(0, c.indexOf('-', 1)), 10);
  }
  await sleep(300);
}
const ok = withQ.filter((a) => a.death != null && a.death <= +maxYear);
console.error('auteurs morts ≤', maxYear, ':', ok.length);
const works = [];
for (let i = 0; i < ok.length; i += 50) {
  const b = ok.slice(i, i + 50); let c2 = '';
  do {
    const d = await J(`${API}&action=query&prop=links&plnamespace=0&pllimit=max&titles=${encodeURIComponent(b.map((a) => a.title).join('|'))}${c2}`);
    for (const p of d.query?.pages || []) { const a = b.find((x) => x.title === p.title); for (const l of p.links || []) if (!l.title.includes('/')) works.push({ title: l.title, author: a.title.replace(/^[^:]+:/, ''), death: a.death, qid: a.qid }); }
    c2 = d.continue ? `&plcontinue=${encodeURIComponent(d.continue.plcontinue)}&continue=${encodeURIComponent(d.continue.continue)}` : '';
    await sleep(300);
  } while (c2);
}
const seen = new Set(); const uniq = works.filter((w) => !seen.has(w.title) && seen.add(w.title));
console.error('œuvres', uniq.length);
console.log(JSON.stringify(uniq));
