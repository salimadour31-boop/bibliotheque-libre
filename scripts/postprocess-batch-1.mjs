// Corrections manuelles du lot 1 (auteurs, résumés en français) et rapatriement local des couvertures (pas de requêtes tierces à l'affichage).
import fs from 'node:fs/promises';
const CAT = 'public/catalogue.json';
const cat = JSON.parse(await fs.readFile(CAT, 'utf8'));
const fix = {
  'pg-15434': { author: 'Joseph Vilbort', year: 1875, summary: 'Récit de voyage : une Parisienne traverse la Grande Kabylie et le Djurdjura au XIXe siècle (regard colonial de l’époque).' },
  'pg-10085': { author: 'René Basset (éd.)', year: 1901, summary: 'Anthologie en anglais : ballades mauresques, contes berbères et kabyles, traditions populaires d’Afrique du Nord.' },
  'pg-4650': { summary: 'Conte philosophique de Voltaire : Candide parcourt le monde et met à l’épreuve l’optimisme de son maître Pangloss.' },
  'pg-6099': { summary: 'Le recueil de poèmes de Baudelaire (1857), entre spleen et idéal.' },
  'pg-800': { summary: 'Phileas Fogg parie qu’il fera le tour du monde en 80 jours.' },
  'pg-13846': { summary: 'Descartes expose sa méthode pour bien conduire sa raison et chercher la vérité dans les sciences.' },
  'pg-20972': { summary: 'Les contes de Perrault : Cendrillon, le Petit Chaperon rouge, la Barbe bleue, le Chat botté…' },
  'pg-11': { summary: 'Alice suit un lapin blanc et tombe dans un monde absurde et merveilleux (en anglais).' },
  'pg-84': { summary: 'Victor Frankenstein donne vie à une créature et doit affronter les conséquences (en anglais).' },
  'pg-1041': { summary: 'Les 154 sonnets de Shakespeare (en anglais).' },
  'pg-1342': { summary: 'Elizabeth Bennet et Mr Darcy, orgueil et préjugés dans l’Angleterre rurale (en anglais).' },
  'pg-1524': { summary: 'La tragédie du prince Hamlet (en anglais).' },
};
await fs.mkdir('public/covers', { recursive: true });
for (const b of cat) {
  Object.assign(b, fix[b.id] || {}); delete b.yearNote;
  if (b.cover && b.cover.startsWith('http')) {
    try {
      const r = await fetch(b.cover.replace('.cover.medium.jpg', '.cover.small.jpg'), { signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(r.status);
      const f = `covers/${b.id}.jpg`; await fs.writeFile('public/' + f, Buffer.from(await r.arrayBuffer())); b.cover = f;
    } catch (e) { console.warn('couverture ignorée', b.id, e.message); b.cover = null; }
  }
}
await fs.writeFile(CAT, JSON.stringify(cat, null, 1));
console.log(cat.map((b) => `${b.language}\t${b.id}\t${b.author}\t${b.cover || '-'}`).join('\n'));
