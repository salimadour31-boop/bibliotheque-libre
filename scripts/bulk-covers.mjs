#!/usr/bin/env node
// Copie locale des petites couvertures Project Gutenberg (évite toute requête tierce depuis l'application).
// Usage : node scripts/bulk-covers.mjs ../bibdata/selection.json ../bibdata
import fs from 'node:fs/promises';
import path from 'node:path';
const [sel, root] = process.argv.slice(2);
const S = JSON.parse(await fs.readFile(sel, 'utf8'));
const UA = 'bibliotheque-libre/2.0 (+https://github.com/salimadour31-boop/bibliotheque-libre)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [l, list] of Object.entries(S)) {
  const dir = path.join(root, `data-${l}`); await fs.mkdir(path.join(dir, 'covers'), { recursive: true });
  const metaF = path.join(dir, 'covers.json'); let meta = {}; try { meta = JSON.parse(await fs.readFile(metaF, 'utf8')); } catch {}
  const books = JSON.parse(await fs.readFile(path.join(dir, 'meta.json'), 'utf8'));
  const todo = list.filter((o) => books[o.id] && meta[o.id] === undefined); let i = 0;
  const w = async () => { while (i < todo.length) { const o = todo[i++];
    try { const r = await fetch(`https://www.gutenberg.org/cache/epub/${o.id}/pg${o.id}.cover.small.jpg`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
      if (r.ok && (r.headers.get('content-type') || '').includes('image')) { await fs.writeFile(path.join(dir, 'covers', `pg-${o.id}.jpg`), Buffer.from(await r.arrayBuffer())); meta[o.id] = 1; } else meta[o.id] = 0;
    } catch { } await sleep(300); } };
  await Promise.all([w(), w()]);
  await fs.writeFile(metaF, JSON.stringify(meta)); console.log(l, 'couvertures', Object.values(meta).filter(Boolean).length);
}
