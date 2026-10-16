#!/usr/bin/env node
// Téléchargement en masse depuis le cache CDN de gutenberg.org (miroir pglaf en secours), poliment (3 requêtes en parallèle max, pause entre requêtes).
// Entrée : selection.json produit par scripts/gutenberg-select.py (catalogue RDF officiel, filtré : "Public domain in the USA"
// ET tous les auteurs morts au plus tard en 1955 → domaine public aussi en France/Algérie).
// Usage : node scripts/bulk-gutenberg.mjs <selection.json> <dossier-sortie-par-langue>   (ex. ../bibdata)
import fs from 'node:fs/promises';
import path from 'node:path';
const [sel, outRoot] = process.argv.slice(2);
const S = JSON.parse(await fs.readFile(sel, 'utf8'));
const UA = 'bibliotheque-libre/2.0 (+https://github.com/salimadour31-boop/bibliotheque-libre)';
const MIRRORS = ['https://www.gutenberg.org/cache/epub/', 'https://gutenberg.pglaf.org/cache/epub/']; // cache CDN de gutenberg.org (rapide), miroir pglaf en secours
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX = 6 * 1024 * 1024;
async function get(id) {
  for (const m of MIRRORS) for (let i = 0; i < 2; i++) {
    try { const r = await fetch(`${m}${id}/pg${id}.txt`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) }); if (r.status === 404) break; if (!r.ok) throw new Error(r.status);
      const buf = new Uint8Array(await r.arrayBuffer());
      try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return new TextDecoder('windows-1252').decode(buf); } }
    catch { await sleep(2000 * (i + 1)); }
  }
  return null;
}
const clean = (t) => t.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').normalize('NFC').trim() + '\n';
for (const [lang, list] of Object.entries(S)) {
  const dir = path.join(outRoot, `data-${lang}`, 'books'); await fs.mkdir(dir, { recursive: true });
  const metaFile = path.join(outRoot, `data-${lang}`, 'meta.json');
  let meta = {}; try { meta = JSON.parse(await fs.readFile(metaFile, 'utf8')); } catch {}
  let idx = 0, ok = 0, fail = 0;
  const worker = async () => {
    while (idx < list.length) {
      const o = list[idx++]; const f = path.join(dir, `pg-${o.id}.txt`);
      if (meta[o.id]) { ok++; continue; }
      try { const st = await fs.stat(f); meta[o.id] = st.size; ok++; continue; } catch {}
      const t = await get(o.id); await sleep(400);
      if (!t) { fail++; continue; }
      const c = clean(t); if (Buffer.byteLength(c) > MAX || (c.match(/\uFFFD/g) || []).length > 5) { fail++; continue; }
      await fs.writeFile(f, c); meta[o.id] = Buffer.byteLength(c); ok++;
      if (ok % 50 === 0) { await fs.writeFile(metaFile, JSON.stringify(meta)); console.log(lang, ok, '/', list.length, 'échecs', fail); }
    }
  };
  await Promise.all(Array.from({ length: 3 }, worker));
  await fs.writeFile(metaFile, JSON.stringify(meta)); console.log(lang, 'terminé', ok, 'échecs', fail);
}
