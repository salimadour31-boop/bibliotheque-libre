// Web Worker : traduction locale avec Transformers.js (NLLB-200 ou Marian). Aucun envoi de texte à un serveur.
import { pipeline, env } from '@huggingface/transformers';
env.allowLocalModels = false;
// Fichiers WebAssembly d'onnxruntime auto-hébergés : une seule copie, émise par Vite dans assets/ (pas de CDN tiers).
import ortWasm from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url';
import ortMjs from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url';
env.backends.onnx.wasm.wasmPaths = { wasm: new URL(ortWasm, self.location.href).href, mjs: new URL(ortMjs, self.location.href).href };
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
      // Limites anti-répétition : pénalité, n-grammes non répétés, longueur de sortie proportionnelle à l'entrée.
      const opts = { max_new_tokens: Math.min(400, Math.ceil((data.maxLen || 400) / 2.2) + 16), repetition_penalty: 1.25, no_repeat_ngram_size: 3, num_beams: 1 };
      if (data.src) { opts.src_lang = data.src; opts.tgt_lang = data.tgt; }
      const out = await pipe(data.texts, opts);
      self.postMessage({ id, type: 'result', texts: out.map((o) => o.translation_text) });
    }
  } catch (e) { self.postMessage({ id, type: 'error', error: String(e?.message || e) + (e?.stack ? ' | ' + e.stack.split('\n').slice(0, 4).join(' < ') : '') }); }
};
