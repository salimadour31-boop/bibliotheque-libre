#!/usr/bin/env node
// Récupère des livres libres de droits depuis des API ouvertes et met à jour public/catalogue.json.
// Usage : node scripts/fetch-books.mjs scripts/batch-1.json [--force]  puis  node scripts/compress-data.mjs ../bibdata/data-<langue>
// Sources gérées : gutenberg (via Gutendex), wikisource (API MediaWiki), ia (Internet Archive, texte OCR).
// Gutenberg : seuls les livres marqués copyright:false sont acceptés.
import fs from 'node:fs/promises';
import path from 'node:path';
import { clean, htmlToText } from './lib-text.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
// Sortie : dossiers des dépôts de données (DATA_ROOT, par défaut ../bibdata) ; les métadonnées détaillées vont dans manual.json,
// puis `node scripts/build-catalogue.mjs ../bibdata` régénère le catalogue découpé.
const DATA = process.env.DATA_ROOT || path.join(ROOT, '..', 'bibdata');
const CAT = path.join(DATA, 'manual.json');
const UA = 'bibliotheque-libre/1.0 (open-source PWA; https://github.com/salimadour31-boop/bibliotheque-libre)';
const MAX_BYTES = 8 * 1024 * 1024;
const LANGS = { fr: ['fr', 'Latn'], en: ['en', 'Latn'], ar: ['ar', 'Arab'], kab: ['kab', 'Latn'] };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, json = false, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(90000) });
      if (!r.ok) throw new Error(r.status + ' ' + url);
      return json ? r.json() : r.text();
    } catch (e) { if (i === tries - 1) throw e; await sleep(1500 * (i + 1)); }
  }
}
const slug = (s) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

async function gutenberg(it) {
  let b;
  try { b = await get(`https://gutendex.com/books/${it.id}`, true, 2); }
  catch (e) {
    // Repli si Gutendex est indisponible : uniquement si le lot fournit les métadonnées ET une vérification préalable du statut "domaine public".
    if (!it.pdVerified || !it.title) throw e;
    console.warn('  Gutendex indisponible, repli sur gutenberg.org pour', it.id);
    b = { id: it.id, title: it.title, authors: [{ name: it.author }], languages: [it.language], copyright: false, summaries: [],
      formats: { 'text/plain; charset=utf-8': `https://www.gutenberg.org/cache/epub/${it.id}/pg${it.id}.txt`, 'image/jpeg': `https://www.gutenberg.org/cache/epub/${it.id}/pg${it.id}.cover.medium.jpg` } };
  }
  if (b.copyright !== false) throw new Error('copyright non libre, ignoré');
  const lang = b.languages[0]; if (!LANGS[lang]) throw new Error('langue non gérée ' + lang);
  const f = b.formats; const url = f['text/plain; charset=utf-8'] || f['text/plain; charset=us-ascii'] || f['text/plain'];
  if (!url) throw new Error('pas de TXT');
  let text; try { text = await get(`https://www.gutenberg.org/cache/epub/${b.id}/pg${b.id}.txt`); } catch { text = await get(url); }
  const a = b.authors[0];
  let author = a ? a.name : 'Anonyme'; if (author.includes(', ')) { const [l, f2] = author.split(', '); author = `${f2.replace(/\s*\(.*\)/, '')} ${l}`; }
  return { id: `pg-${b.id}`, title: it.title || b.title, author: it.author || author, language: lang, script: LANGS[lang][1], year: it.year ?? (a?.death_year ?? null), yearNote: it.year ? undefined : 'année de décès de l’auteur',
    cover: f['image/jpeg'] || null, summary: it.summary || (b.summaries?.[0] || '').replace(/\s*\(This is an automatically generated summary\.\)/, ''),
    theme: it.theme || 'roman', source: 'Project Gutenberg', license: 'Domaine public (États-Unis) — Licence Project Gutenberg, en-tête conservé', url: `https://www.gutenberg.org/ebooks/${b.id}`, text };
}
async function wsParse(lang, page) {
  const u = `https://${lang}.wikisource.org/w/api.php?action=parse&format=json&prop=text|revid&redirects=1&disableeditsection=1&page=${encodeURIComponent(page)}`;
  const j = await get(u, true); if (j.error) throw new Error(j.error.info); return j.parse;
}
async function wikisource(it) {
  const main = await wsParse(it.lang, it.title);
  const html = main.text['*'];
  // sous-pages dans l'ordre d'apparition sur la page principale
  const re = /href="\/wiki\/([^"#?]+)"/g; const seen = new Set(); const subs = []; let m;
  const prefix = encodeURIComponent(it.title.replace(/ /g, '_')).toLowerCase() + '/';
  while ((m = re.exec(html))) { const h = m[1]; if (h.toLowerCase().startsWith(prefix) && !seen.has(h)) { seen.add(h); subs.push(decodeURIComponent(h).replace(/_/g, ' ')); } }
  let text = htmlToText(html);
  for (const s of subs.slice(0, it.maxParts || 60)) {
    await sleep(300);
    try { const p = await wsParse(it.lang, s); text += `\n\n## ${s.split('/').slice(1).join(' / ')}\n\n` + htmlToText(p.text['*']); } catch (e) { console.warn('  sous-page ignorée', s, e.message); }
  }
  const url = `https://${it.lang}.wikisource.org/wiki/${encodeURIComponent(it.title.replace(/ /g, '_'))}`;
  const header = `Source : Wikisource (${it.lang}) — ${decodeURI(url)}\nŒuvre dans le domaine public ; transcription Wikisource sous licence CC BY-SA 4.0.\n\n`;
  return { id: `ws-${it.lang}-${/^[a-z0-9-]+$/.test(slug(it.title)) ? slug(it.title) : main.pageid}`, ...meta(it), source: `Wikisource (${it.lang})`, license: 'Domaine public (œuvre) ; transcription CC BY-SA 4.0 (Wikisource)', url, text: header + text, parts: subs.length };
}
async function ia(it) {
  const md = await get(`https://archive.org/metadata/${it.id}`, true);
  const f = md.files.find((x) => x.name.endsWith('_djvu.txt')); if (!f) throw new Error('pas de texte OCR');
  const text = await get(`https://archive.org/download/${it.id}/${encodeURIComponent(f.name)}`);
  const url = `https://archive.org/details/${it.id}`;
  const lic = md.metadata.licenseurl ? `Domaine public — marque indiquée par Internet Archive : ${md.metadata.licenseurl} (publication ${it.year})` : md.metadata['possible-copyright-status'] === 'NOT_IN_COPYRIGHT' ? `Domaine public — statut Internet Archive : NOT_IN_COPYRIGHT (publication ${it.year}, auteur mort avant 1956)` : `Domaine public (auteur mort il y a plus de 100 ans, publication ${it.year})`;
  const header = `Source : Internet Archive — ${url}\n${lic}\nTexte issu de la reconnaissance optique (OCR) d'Internet Archive, non corrigé.\n\n`;
  return { id: `ia-${it.id}`, ...meta(it), source: 'Internet Archive', license: lic, url, text: header + text };
}
const meta = (it) => ({ title: it.title, author: it.author, language: it.language, script: it.script || LANGS[it.language][1], year: it.year, cover: it.cover || null, summary: it.summary || '', theme: it.theme, note: it.note });

const file = process.argv[2]; if (!file) { console.error('Usage: node scripts/fetch-books.mjs <batch.json> [--force]'); process.exit(1); }
const force = process.argv.includes('--force');
const items = JSON.parse(await fs.readFile(file, 'utf8'));
let cat = []; try { cat = JSON.parse(await fs.readFile(CAT, 'utf8')); } catch {}
for (const it of items) {
  const key = it.type + ':' + (it.id ?? it.title);
  try {
    const ex = cat.find((c) => c.key === key); if (ex && !force) { console.log('déjà présent', key); continue; }
    const b = await ({ gutenberg, wikisource, ia })[it.type](it);
    let text = clean(b.text); delete b.text;
    if (Buffer.byteLength(text) > MAX_BYTES) throw new Error('trop volumineux');
    if (text.length < 500) throw new Error('texte trop court');
    const fname = `${b.id}.txt`; const BOOKS = path.join(DATA, `data-${b.language}`, 'books'); await fs.mkdir(BOOKS, { recursive: true }); await fs.writeFile(path.join(BOOKS, fname), text);
    const entry = { key, ...b, file: `books/${fname}`, size: Buffer.byteLength(text), added: new Date().toISOString().slice(0, 10) };
    Object.keys(entry).forEach((k) => entry[k] === undefined && delete entry[k]);
    cat = cat.filter((c) => c.key !== key); cat.push(entry);
    await fs.writeFile(CAT, JSON.stringify(cat, null, 1));
    console.log('OK', b.language, b.title, Math.round(entry.size / 1024) + ' Ko');
  } catch (e) { console.error('ÉCHEC', key, e.message); }
  await sleep(500);
}
await fs.writeFile(CAT, JSON.stringify(cat, null, 1));
console.log('Catalogue :', cat.length, 'livres');
