export const progressKey = 'liga-legacy-v1';
export class ConflictError extends Error {}
let database;
// Version 2 adds a photos store so original-quality photos live outside the progress JSON.
const openDatabase = () => database ??= new Promise((resolve, reject) => {
 const request = indexedDB.open('liga-legacy', 2);
 request.onupgradeneeded = () => {
  const db = request.result;
  if (!db.objectStoreNames.contains('progress')) db.createObjectStore('progress');
  if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos');
 };
 request.onsuccess = () => {
  const db = request.result;
  db.onversionchange = () => { db.close(); database = undefined; };
  resolve(db);
 };
 request.onerror = () => reject(request.error);
 request.onblocked = () => reject(new Error('Fecha os outros separadores do Liga Legacy e atualiza esta página.'));
}).catch(error => { database = undefined; throw error; });
const legacyProgress = () => { try { return localStorage.getItem(progressKey); } catch { return null; } };
export async function readProgress() {
 const db = await openDatabase();
 return new Promise((resolve, reject) => {
  const request = db.transaction('progress').objectStore('progress').get(progressKey);
  request.onsuccess = () => resolve(request.result ?? legacyProgress());
  request.onerror = () => reject(request.error);
 });
}
export async function readPhotos(ids) {
 const db = await openDatabase();
 const store = db.transaction('photos').objectStore('photos');
 const entries = await Promise.all(ids.map(id => new Promise((resolve, reject) => {
  const request = store.get(id);
  request.onsuccess = () => resolve([id, request.result]);
  request.onerror = () => reject(request.error);
 })));
 return new Map(entries.filter(([, blob]) => blob));
}
// Compare and write in one transaction so another tab cannot overwrite an open form.
export async function writeProgress(raw, expected, { put = [], remove = [], clear = false } = {}) {
 const db = await openDatabase();
 return new Promise((resolve, reject) => {
  const transaction = db.transaction(['progress', 'photos'], 'readwrite');
  const progress = transaction.objectStore('progress'), photos = transaction.objectStore('photos');
  const request = progress.get(progressKey);
  let conflict = false;
  request.onsuccess = () => {
   if ((request.result ?? legacyProgress()) !== expected) { conflict = true; transaction.abort(); return; }
   if (clear) photos.clear();
   remove.forEach(id => photos.delete(id));
   put.forEach(([id, blob]) => photos.put(blob, id));
   progress.put(raw, progressKey);
  };
  transaction.oncomplete = () => resolve();
  transaction.onabort = () => reject(conflict ? new ConflictError('Os dados mudaram noutro separador.') : transaction.error || new Error('Não foi possível guardar.'));
 });
}
