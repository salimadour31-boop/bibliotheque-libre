// Web Worker : traduction locale avec Transformers.js (NLLB-200 ou Marian). Aucun envoi de texte à un serveur.
import { pipeline, env } from '@huggingface/transformers';
env.allowLocalModels = false;
// Fichiers WebAssembly d'onnxruntime auto-hébergés (copiés dans /ort par scripts/copy-ort.mjs) : pas de CDN tiers.
const ROOT = self.location.href.split(/\/(assets|src)\//)[0] + '/';
env.backends.onnx.wasm.wasmPaths = ROOT + 'ort/';
let pipe = null, pipeKey = '';
self.onmessage = async ({ data }) => {
  const { id, type } = data;
  try {
    if (type === 'load') {
      if (pipeKey !== data.model) {
        pipe = null;
        const device = data.webgpu && 'gpu' in navigator ? 'webgpu' : 'wasm';
        pipe = await pipeline('translation', data.model, {
          dtype: device === 'webgpu' ? 'fp32' : 'q8', device,
          progress_callback: (p) => self.postMessage({ id, type: 'progress', p }),
        });
        pipeKey = data.model;
      }
      self.postMessage({ id, type: 'ready' });
    } else if (type === 'translate') {
      const opts = { max_new_tokens: 400 };
      if (data.src) { opts.src_lang = data.src; opts.tgt_lang = data.tgt; }
      const out = await pipe(data.texts, opts);
      self.postMessage({ id, type: 'result', texts: out.map((o) => o.translation_text) });
    }
  } catch (e) { self.postMessage({ id, type: 'error', error: String(e?.message || e) + (e?.stack ? ' | ' + e.stack.split('\n').slice(0, 4).join(' < ') : '') }); }
};
