// Test hors navigateur (Node) de la traduction NLLB-200 / Marian avec Transformers.js.
// Usage : node scripts/test-translation.mjs   (télécharge ~900 Mo de modèles la première fois)
import { pipeline, env } from '@huggingface/transformers';
env.cacheDir = process.env.HF_CACHE || '/tmp/hf-cache';
const S = {
  fra_Latn: "Le renard dit au corbeau : « Monsieur, que vous êtes joli ! »",
  arb_Arab: 'قال الملك للفيلسوف: اضرب لي مثلا للرجلين المتحابين.',
  kab_Latn: 'Yiwen wass, yella yiwen urgaz d tmeṭṭut-is, zedɣen deg yiwet n taddart.',
  eng_Latn: 'Alice was beginning to get very tired of sitting by her sister on the bank.',
};
const t0 = Date.now();
const tr = await pipeline('translation', 'Xenova/nllb-200-distilled-600M', { dtype: 'q8' });
console.log('NLLB chargé en', ((Date.now() - t0) / 1000).toFixed(0), 's');
for (const [src, text] of Object.entries(S)) for (const tgt of Object.keys(S)) {
  if (src === tgt) continue;
  const t = Date.now();
  const [o] = await tr(text, { src_lang: src, tgt_lang: tgt, max_new_tokens: 128 });
  console.log(`${src} -> ${tgt} (${Date.now() - t} ms): ${o.translation_text}`);
}
for (const m of ['Xenova/opus-mt-fr-en', 'Xenova/opus-mt-en-fr']) {
  const p = await pipeline('translation', m, { dtype: 'q8' });
  const [o] = await p(m.endsWith('fr-en') ? S.fra_Latn : S.eng_Latn);
  console.log(m, ':', o.translation_text);
}
