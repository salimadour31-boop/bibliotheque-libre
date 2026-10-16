// Copie les fichiers WASM d'onnxruntime-web dans public/ort (auto-hébergement, évite le CDN jsDelivr).
import fs from 'node:fs';
const src = 'node_modules/onnxruntime-web/dist/'; const dst = 'public/ort/';
fs.mkdirSync(dst, { recursive: true });
for (const f of ['ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm', 'ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm']) if (fs.existsSync(src + f)) fs.copyFileSync(src + f, dst + f);
console.log('ort copié');
