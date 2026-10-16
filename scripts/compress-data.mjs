#!/usr/bin/env node
// Compresse les textes des dossiers de données (books/*.txt → books/*.txt.gz, gzip -9) pour tenir sous les limites GitHub.
// L'application décompresse dans le navigateur (DecompressionStream). Usage : node scripts/compress-data.mjs ../bibdata/data-fr
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
for (const dir of process.argv.slice(2)) {
  const b = path.join(dir, 'books'); let n = 0;
  for (const f of await fs.readdir(b)) {
    if (!f.endsWith('.txt')) continue;
    const src = path.join(b, f); await fs.writeFile(src + '.gz', zlib.gzipSync(await fs.readFile(src), { level: 9 })); await fs.unlink(src); n++;
  }
  console.log(dir, n, 'fichiers compressés');
}
