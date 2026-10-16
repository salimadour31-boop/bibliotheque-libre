#!/usr/bin/env node
// Récupération en masse d'œuvres Wikisource à partir de works-<lang>.json (scripts/wikisource-authors.mjs).
// Règles : auteur mort ≤ 1955 (Wikidata) ; on ÉCARTE toute page dont l'en-tête mentionne un traducteur
// (une traduction moderne peut être protégée), les redirections, homonymies et pages inexistantes.
// Usage : node scripts/bulk-wikisource.mjs ar ../bibdata/works-ar.json ../bibdata [max]
import fs from 'node:fs/promises';
import path from 'node:path';
import { clean, htmlToText } from './lib-text.mjs';
const [lang, worksFile, outRoot, maxN = '2000'] = process.argv.slice(2);
const UA = 'bibliotheque-libre/2.0 (+https://github.com/salimadour31-boop/bibliotheque-libre)';
const API = `https://${lang}.wikisource.org/w/api.php?format=json&formatversion=2`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const J = async (u) => { for (let i = 0; i < 4; i++) { try { const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) }); if (r.ok) return r.json(); } catch {} await sleep(2000 * (i + 1)); } throw new Error('échec réseau'); };
const MAX_PARTS = 40, MAX_BYTES = 4 * 1024 * 1024;
const works = JSON.parse(await fs.readFile(worksFile, 'utf8'));
const dir = path.join(outRoot, `data-${lang}`, 'books'); await fs.mkdir(dir, { recursive: true });
const metaFile = path.join(outRoot, `data-${lang}`, 'meta-ws.json');
let meta = {}; try { meta = JSON.parse(await fs.readFile(metaFile, 'utf8')); } catch {}
// 1) Filtre par lots de 50 via le wikitexte
const cand = [];
for (let i = 0; i < works.length; i += 15) {
  const b = works.slice(i, i + 15); // lots de 15 : URL < 8 Ko avec des titres arabes
  const d = await J(`${API}&action=query&prop=revisions|pageprops|categories&cllimit=max&rvprop=content&rvslots=main&titles=${encodeURIComponent(b.map((w) => w.title).join('|'))}`);
  for (const p of d.query?.pages || []) {
    if (p.missing || p.invalid) continue;
    const w = b.find((x) => x.title === p.title); if (!w) continue;
    const txt = p.revisions?.[0]?.slots?.main?.content || '';
    if (/^#(redirect|تحويل)/i.test(txt) || p.pageprops?.disambiguation !== undefined) continue;
    if (/\|\s*(مترجم|ترجمة|المترجم|translator|traducteur)\s*=\s*[^|}\s]/i.test(txt)) continue;
    if ((p.categories || []).some((c) => /ترجم|مترجم|translat|traduct/i.test(c.title))) continue;
    cand.push({ ...w, pageid: p.pageid, cats: (p.categories || []).map((c) => c.title.replace(/^[^:]+:/, '')) });
  }
  await sleep(250);
}
console.log('candidats après filtre', cand.length);
async function parse(page) { const d = await J(`${API}&action=parse&prop=text&redirects=1&disableeditsection=1&page=${encodeURIComponent(page)}`); if (d.error) throw new Error(d.error.info); return d.parse.text; }
let idx = 0, ok = Object.keys(meta).length, fail = 0; const LIMIT = +maxN;
async function worker() {
  while (idx < cand.length && ok < LIMIT) {
    const w = cand[idx++]; const id = `ws-${lang}-${w.pageid}`;
    if (meta[id]) continue;
    try {
      const html = await parse(w.title); await sleep(300);
      const re = /href="\/wiki\/([^"#?]+)"/g; const seen = new Set(); const subs = []; let m;
      const prefix = encodeURIComponent(w.title.replace(/ /g, '_')).toLowerCase() + '/';
      while ((m = re.exec(html))) { const h = m[1]; if (h.toLowerCase().startsWith(prefix) && !seen.has(h)) { seen.add(h); subs.push(decodeURIComponent(h).replace(/_/g, ' ')); } }
      let text = htmlToText(html);
      for (const s of subs.slice(0, MAX_PARTS)) {
        if (text.length > MAX_BYTES / 2) break;
        try { text += `\n\n## ${s.split('/').slice(1).join(' / ')}\n\n` + htmlToText(await parse(s)); } catch {}
        await sleep(300);
      }
      const url = `https://${lang}.wikisource.org/wiki/${encodeURIComponent(w.title.replace(/ /g, '_'))}`;
      const body = clean(`Source : Wikisource (${lang}) — ${decodeURI(url)}\nŒuvre dans le domaine public (auteur mort en ${w.death}) ; transcription Wikisource sous licence CC BY-SA 4.0.\n\n` + text);
      const plain = body.replace(/\s+/g, '');
      if (plain.length < 1500) { fail++; continue; } // trop court (page de sommaire vide, etc.)
      await fs.writeFile(path.join(dir, id + '.txt'), body);
      meta[id] = { title: w.title, author: w.author, death: w.death, url, cats: w.cats.filter((c) => !/صفحات|قالب|Pages|بوصلة/.test(c)).slice(0, 6), parts: Math.min(subs.length, MAX_PARTS), partial: subs.length > MAX_PARTS, size: Buffer.byteLength(body) };
      ok++; if (ok % 25 === 0) { await fs.writeFile(metaFile, JSON.stringify(meta)); console.log(lang, ok, 'idx', idx, '/', cand.length, 'écartés', fail); }
    } catch (e) { fail++; }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
await fs.writeFile(metaFile, JSON.stringify(meta)); console.log('terminé', ok, 'écartés', fail);
