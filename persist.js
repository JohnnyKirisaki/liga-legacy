import { validateState, photoRef } from './core.js';
import { readProgress, writeProgress, readPhotos, ConflictError } from './storage.js';
import { store } from './store.js';
import { announce, openDialog } from './dom.js';
// Progress lives only in this browser; add cloud sync if the challenge needs to follow multiple devices.
const updates = 'BroadcastChannel' in self ? new BroadcastChannel('liga-legacy-progress') : null;
let saving = false, pendingRemote = false;
export const newPhotoId = () => `photo-${crypto.randomUUID()}`;
const photoIds = state => Object.values(state.campaigns).flatMap(campaign => campaign.records.map(item => item.photo)).filter(photo => photoRef.test(photo));
// Keep one object URL per stored photo blob, and drop the ones no record uses any more.
export async function loadPhotos(state) {
 const ids = photoIds(state), wanted = new Set(ids);
 for (const [id, url] of store.photoUrls) if (!wanted.has(id)) { URL.revokeObjectURL(url); store.photoUrls.delete(id); }
 const missing = ids.filter(id => !store.photoUrls.has(id));
 if (!missing.length) return;
 for (const [id, blob] of await readPhotos(missing)) store.photoUrls.set(id, URL.createObjectURL(blob));
}
const saveError = error => error.name === 'QuotaExceededError' ? 'O armazenamento do navegador está cheio. Exporta uma cópia de segurança e remove títulos antigos.'
 : error instanceof ConflictError ? 'Os dados mudaram noutro separador. Fecha esta janela para carregar a versão mais recente e tenta outra vez.'
 : 'Não foi possível guardar. Exporta uma cópia de segurança e tenta outra vez.';
export async function commit(next, photos = {}) {
 if (saving) return false;
 let state;
 try { state = validateState(next, store.data.seasons); } catch (error) { announce(error.message); return false; }
 if (store.unreadable && !confirm('Não foi possível ler os dados guardados. Descarrega a cópia de recuperação antes de os substituíres. Substituir os dados?')) return false;
 saving = true;
 try {
  const raw = JSON.stringify(state);
  await writeProgress(raw, store.snapshot, photos);
  if (photos.clear) { store.photoUrls.forEach(url => URL.revokeObjectURL(url)); store.photoUrls.clear(); }
  (photos.put ?? []).forEach(([id, blob]) => store.photoUrls.set(id, URL.createObjectURL(blob)));
  await loadPhotos(state);
  store.snapshot = raw; store.state = state;
  if (store.unreadable) { store.unreadable = false; document.dispatchEvent(new Event('progress-recovered')); }
  updates?.postMessage(null);
  // Ask the browser not to evict the only copy of the user's titles.
  navigator.storage?.persist?.().catch(() => {});
  return true;
 } catch (error) {
  console.error(error);
  if (error instanceof ConflictError) pendingRemote = true;
  announce(saveError(error));
  return false;
 } finally { saving = false; }
}
// Reload progress written by another tab. Returns true when the state changed.
export async function syncFromStorage() {
 pendingRemote = false;
 const raw = await readProgress();
 if (raw === store.snapshot) return false;
 const state = validateState(JSON.parse(raw), store.data.seasons);
 await loadPhotos(state);
 store.state = state; store.snapshot = raw;
 return true;
}
export function watchRemoteChanges(onChange) {
 const handle = async () => {
  if (openDialog()) { pendingRemote = true; announce('Os dados mudaram noutro separador. A versão mais recente é carregada quando fechares esta janela.'); return; }
  try { if (await syncFromStorage()) onChange(); } catch (error) { console.error(error); announce('Não foi possível carregar a alteração feita noutro separador. Os dados atuais foram mantidos.'); }
 };
 if (updates) updates.onmessage = handle;
 document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('close', () => { if (pendingRemote && !openDialog()) handle(); }));
}
