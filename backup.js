import { validateState, photoRef, isPhotoData } from './core.js';
import { readPhotos } from './storage.js';
import { store } from './store.js';
import { downloadBlob, localDate } from './dom.js';
import { newPhotoId } from './persist.js';
const lastBackupKey = 'liga-legacy-last-backup';
export const lastBackup = () => { try { return localStorage.getItem(lastBackupKey); } catch { return null; } };
const blobToDataUrl = blob => new Promise((resolve, reject) => {
 const reader = new FileReader();
 reader.onload = () => resolve(reader.result);
 reader.onerror = () => reject(reader.error);
 reader.readAsDataURL(blob);
});
export function dataUrlToBlob(dataUrl) {
 const [header, base64] = dataUrl.split(',');
 const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
 return new Blob([bytes], { type: header.slice(5, header.indexOf(';')) });
}
const mapRecords = async (state, change) => ({ ...state, campaigns: Object.fromEntries(await Promise.all(Object.entries(state.campaigns).map(async ([season, campaign]) => [season, { ...campaign, records: await Promise.all(campaign.records.map(change)) }]))) });
// Backups are one self-contained JSON file, so photos travel inline at their original quality.
export async function exportBackup() {
 const blobs = await readPhotos([...store.photoUrls.keys()]);
 const portable = await mapRecords(store.state, async item => photoRef.test(item.photo) && blobs.has(item.photo) ? { ...item, photo: await blobToDataUrl(blobs.get(item.photo)) } : item);
 downloadBlob(new Blob([JSON.stringify(portable, null, 2)], { type: 'application/json' }), `liga-legacy-${localDate()}.json`);
 try { localStorage.setItem(lastBackupKey, new Date().toISOString()); } catch {}
}
// Older saves kept photos inline in the progress JSON; move them into the photo store.
export async function extractPhotos(state) {
 const put = [];
 const next = await mapRecords(state, async item => {
  if (!isPhotoData(item.photo)) return item;
  const id = newPhotoId();
  put.push([id, dataUrlToBlob(item.photo)]);
  return { ...item, photo: id };
 });
 return { state: next, put };
}
export async function readBackup(file) {
 if (file.size > 600 * 1024 * 1024) throw new Error('O ficheiro é demasiado grande para ser uma cópia do Liga Legacy.');
 let parsed;
 try { parsed = JSON.parse(await file.text()); } catch { throw new Error('Não foi possível ler a cópia. Escolhe um ficheiro JSON exportado pelo Liga Legacy.'); }
 const state = validateState(parsed, store.data.seasons);
 if (Object.values(state.campaigns).some(campaign => campaign.records.some(item => photoRef.test(item.photo)))) throw new Error('Esta cópia não inclui as fotografias. Exporta-a outra vez a partir do Liga Legacy.');
 return extractPhotos(state);
}
