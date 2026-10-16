#!/usr/bin/env node
// Construit le catalogue découpé (public/catalogue/index.json + <langue>-<page>.json) à partir des dossiers de données
// (../bibdata/data-<langue> = contenu des dépôts bibliotheque-libre-data-<langue>) et génère SOURCES-<langue>.csv + résumé.
// Usage : node scripts/build-catalogue.mjs ../bibdata
import fs from 'node:fs/promises';
import path from 'node:path';
const root = process.argv[2] || '../bibdata';
const BASE = (l) => (process.env.DATA_BASE ? process.env.DATA_BASE.replace('{l}', l) : `https://salimadour31-boop.github.io/bibliotheque-libre-data-${l}/`);
const PAGE = 1000;
const rd = async (f, d) => { try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch { return d; } };
const name = (n) => { if (!n) return 'Anonyme'; n = n.replace(/\s*\([^)]*\)/g, '').trim(); const p = n.split(', '); return p.length === 2 ? `${p[1]} ${p[0]}` : n; };
const cut = (s, n = 280) => (s && s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s || '');
const AR_THEMES = [[/شعر|ديوان|قصائد|معلق/, 'poésie'], [/رواي|قصص|قصة/, 'roman'], [/حكاي|أساطير|خراف/, 'contes'], [/فلسف|منطق|أخلاق/, 'philosophie'], [/تاريخ|سير|رحل|تراجم|جغراف/, 'histoire'], [/قرآن|تفسير|حديث|فقه|عقيد|دين|إسلام|تصوف|إنجيل|توراة|كتاب مقدس/, 'religion'], [/علوم|طب|رياضي|فلك|كيمياء/, 'sciences'], [/مسرح/, 'théâtre'], [/أطفال/, 'jeunesse'], [/لغة|نحو|بلاغة|أدب/, 'langue et littérature']];
const out = {};
// 1) Project Gutenberg en masse
const sel = await rd(path.join(root, 'selection.json'), {});
for (const [l, list] of Object.entries(sel)) {
  const meta = await rd(path.join(root, `data-${l}`, 'meta.json'), {});
  const covers = await rd(path.join(root, `data-${l}`, 'covers.json'), {});
  for (const o of list) {
    if (!meta[o.id]) continue;
    (out[l] ??= []).push({ id: `pg-${o.id}`, t: o.title.replace(/\s+/g, ' ').trim(), a: o.authors.map((a) => name(a.name)).join(', '), s: cut(o.summary?.replace(/\s*\(This is an automatically generated summary\.\)/, '')), th: o.theme, src: 'pg', lic: 'pg', u: `https://www.gutenberg.org/ebooks/${o.id}`, f: `books/pg-${o.id}.txt.gz`, c: covers[o.id] ? `covers/pg-${o.id}.jpg` : undefined, z: meta[o.id], dl: o.downloads });
  }
}
// 2) Wikisource en masse
for (const l of ['ar', 'fr', 'en']) {
  const meta = await rd(path.join(root, `data-${l}`, 'meta-ws.json'), {});
  for (const [id, m] of Object.entries(meta)) {
    const cats = (m.cats || []).join(' ');
    const th = (AR_THEMES.find(([re]) => re.test(cats + ' ' + m.title)) || [0, 'langue et littérature'])[1];
    (out[l] ??= []).push({ id, t: m.title, a: m.author, s: m.partial ? 'Extrait : les 40 premières parties seulement (œuvre longue).' : '', th, src: `ws-${l}`, lic: 'ws', u: m.url, f: `books/${id}.txt.gz`, z: m.size, n: m.partial ? 'partiel' : undefined, death: m.death });
  }
}
// 3) Lot manuel (scripts/batch-*.json) : entrées détaillées
const manual = await rd(path.join(root, 'manual.json'), []);
for (const b of manual) {
  const lic = b.source === 'Project Gutenberg' ? 'pg' : b.source.startsWith('Wikisource') ? 'ws' : /NOT_IN_COPYRIGHT/.test(b.license) ? 'ia-nic' : /publicdomain/.test(b.license) ? 'ia-pdm' : b.license;
  const src = b.source === 'Project Gutenberg' ? 'pg' : b.source.startsWith('Wikisource') ? `ws-${b.source.match(/\((\w+)\)/)?.[1] || b.language}` : 'ia';
  const e = { id: b.id, t: b.title, a: b.author, y: b.year, s: b.summary, th: b.theme, src, lic, u: b.url, f: `books/${b.id}.txt.gz`, c: b.cover ? b.cover : undefined, n: b.note, z: b.size, dl: 1e9 };
  const L = (out[b.language] ??= []); const i = L.findIndex((x) => x.id === e.id); if (i >= 0) L[i] = e; else L.push(e);
}
await fs.rm('public/catalogue', { recursive: true, force: true }); await fs.mkdir('public/catalogue', { recursive: true });
const index = { generated: new Date().toISOString().slice(0, 10), langs: {}, themes: [] };
const themes = new Set(); let csvAll = 'langue,id,titre,auteur,source,licence,lien,fichier\n';
for (const l of ['kab', 'ar', 'fr', 'en']) {
  const L = (out[l] || []).sort((a, b) => (b.dl || 0) - (a.dl || 0));
  { const seen = new Set();
    const keep = []; for (const e of L) { const k = (e.t + '|' + e.a).toLowerCase(); if (seen.has(k)) continue; seen.add(k); keep.push(e); } L.length = 0; L.push(...keep); } // doublons (éditions multiples) : on garde la plus téléchargée
  L.forEach((e) => { themes.add(e.th); delete e.dl; delete e.death; Object.keys(e).forEach((k) => (e[k] === undefined || e[k] === '') && delete e[k]); });
  const pages = Math.max(1, Math.ceil(L.length / PAGE));
  for (let p = 0; p < pages; p++) await fs.writeFile(`public/catalogue/${l}-${p}.json`, JSON.stringify(L.slice(p * PAGE, (p + 1) * PAGE)));
  index.langs[l] = { count: L.length, pages, base: BASE(l) };
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const csv = 'id,titre,auteur,source,licence,lien,fichier\n' + L.map((e) => [e.id, e.t, e.a, e.src, e.lic, e.u, BASE(l) + e.f].map(q).join(',')).join('\n') + '\n';
  await fs.writeFile(`SOURCES-${l}.csv`, csv);
  csvAll += L.map((e) => [l, e.id, e.t, e.a, e.src, e.lic, e.u, BASE(l) + e.f].map(q).join(',')).join('\n') + '\n';
  console.log(l, L.length, 'livres,', pages, 'page(s)');
}
index.themes = [...themes];
await fs.writeFile('public/catalogue/index.json', JSON.stringify(index, null, 1));
