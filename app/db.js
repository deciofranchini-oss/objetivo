// app/db.js
// IndexedDB wrapper (v3) — stores: txs, cats, cfg, parties
export const DB_NAME = 'school-ledger';
export const DB_VERSION = 3;

export let db = null;

export function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const d = e.target.result;

      if (!d.objectStoreNames.contains('txs')) {
        d.createObjectStore('txs', { keyPath: 'id', autoIncrement: true });
      }
      if (!d.objectStoreNames.contains('cats')) {
        d.createObjectStore('cats', { keyPath: 'key' });
      }
      if (!d.objectStoreNames.contains('cfg')) {
        d.createObjectStore('cfg', { keyPath: 'k' });
      }
      if (!d.objectStoreNames.contains('parties')) {
        d.createObjectStore('parties', { keyPath: 'key' });
      }
    };

    req.onsuccess = (e) => { db = e.target.result; resolve(); };
    req.onerror = (e) => reject(e.target.error);
  });
}

function store(name, mode) {
  return db.transaction(name, mode).objectStore(name);
}

export const all = (s) => new Promise((ok, fail) => {
  const r = store(s, 'readonly').getAll();
  r.onsuccess = () => ok(r.result || []);
  r.onerror = () => fail(r.error);
});

export const getOne = (s, k) => new Promise((ok, fail) => {
  const r = store(s, 'readonly').get(k);
  r.onsuccess = () => ok(r.result);
  r.onerror = () => fail(r.error);
});

export const put = (s, v) => new Promise((ok, fail) => {
  const r = store(s, 'readwrite').put(v);
  r.onsuccess = () => ok(r.result);
  r.onerror = () => fail(r.error);
});

export const del = (s, k) => new Promise((ok, fail) => {
  const r = store(s, 'readwrite').delete(k);
  r.onsuccess = () => ok();
  r.onerror = () => fail(r.error);
});

export const clr = (s) => new Promise((ok, fail) => {
  const r = store(s, 'readwrite').clear();
  r.onsuccess = () => ok();
  r.onerror = () => fail(r.error);
});
