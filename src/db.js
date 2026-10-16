// Petit wrapper IndexedDB : magasin clé/valeur "tr" pour les traductions par paragraphe.
let dbp;
function db() {
  return (dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open('bibliotheque', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('tr');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
}
const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('tr', mode); const s = t.objectStore('tr'); const out = fn(s); t.oncomplete = () => res(out instanceof IDBRequest ? out.result : undefined); t.onerror = () => rej(t.error); }); };
export const idbGet = (k) => tx('readonly', (s) => s.get(k));
export const idbSet = (k, v) => tx('readwrite', (s) => { s.put(v, k); });
export const idbDel = (k) => tx('readwrite', (s) => { s.delete(k); });
