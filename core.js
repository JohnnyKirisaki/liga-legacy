import { trophies } from './trophies.js';
import { countries } from './countries.js';
// Pure challenge logic: no DOM, no storage. Covered by tests/core.test.js.
export const currentSeason = seasons => Object.keys(seasons).sort().at(-1);
export const emptyCampaign = () => ({ active: null, records: [] });
export const emptyState = seasons => ({ version: 1, season: currentSeason(seasons), campaigns: Object.fromEntries(Object.keys(seasons).map(season => [season, emptyCampaign()])) });
export const positions = ['goalkeeper', 'defender', 'midfielder', 'attacker'];
export const maxPhotoBytes = 10 * 1024 * 1024;
// Saved records point at a photo blob in IndexedDB; backups carry the photo inline as a data URL.
export const photoRef = /^photo-[0-9a-f-]{36}$/;
const photoData = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
export const isPhotoData = photo => typeof photo === 'string' && photo.length <= 4 * Math.ceil(maxPhotoBytes / 3) + 32 && photoData.test(photo);
export class FieldError extends Error {
 constructor(field, message) { super(message); this.field = field; }
}
const fail = (field, message) => { throw new FieldError(field, message); };
const isCount = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
export function validateRecord(record, ids) {
 if (!record || typeof record !== 'object' || !ids.includes(record.clubId)) fail('club', 'Este título pertence a um clube desconhecido.');
 if (!isCount(record.seasons, 1, 999)) fail('seasons', 'Indica o número de épocas: um número inteiro entre 1 e 999.');
 if (typeof record.name !== 'string' || !record.name.trim() || record.name.length > 60) fail('name', 'Indica o nome do jogador (até 60 caracteres).');
 if (!isCount(record.number, 1, 99)) fail('number', 'Indica um número de camisola entre 1 e 99.');
 if (record.position !== undefined && record.position !== '' && !positions.includes(record.position)) fail('position', 'Escolhe a posição do jogador.');
 if (record.nationality !== undefined && record.nationality !== '' && !Object.hasOwn(countries, record.nationality)) fail('nationality', 'Escolhe a nacionalidade do jogador.');
 if (typeof record.photo !== 'string' || !(photoRef.test(record.photo) || isPhotoData(record.photo))) fail('photo', 'Adiciona uma fotografia do jogador.');
 let counts;
 if (record.trophies !== undefined) {
  if (!record.trophies || typeof record.trophies !== 'object' || Array.isArray(record.trophies) || Object.keys(record.trophies).some(id => !trophies.some(trophy => trophy.id === id))) fail('trophies', 'A lista de troféus é inválida.');
  counts = Object.fromEntries(trophies.map(trophy => [trophy.id, record.trophies[trophy.id] ?? 0]));
  if (Object.values(counts).some(count => !isCount(count, 0, 999))) fail('trophies', 'Indica um número inteiro de troféus (0 a 999) em cada competição.');
  if (counts.liga < 1) fail('trophies', 'Indica pelo menos 1 título da Liga Portugal.');
 }
 if (typeof record.date !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(record.date) || Number.isNaN(Date.parse(record.date))) fail('date', 'Este título tem uma data inválida.');
 // Rebuild from known fields so imported files cannot smuggle extra data into storage.
 return { clubId: record.clubId, seasons: record.seasons, name: record.name, number: record.number, position: record.position || '', nationality: record.nationality || '', ...(counts && { trophies: counts }), photo: record.photo, date: record.date };
}
export function validateState(state, seasons) {
 if (!state || typeof state !== 'object' || state.version !== 1 || !state.campaigns || typeof state.campaigns !== 'object') throw new Error('Este ficheiro não é uma cópia de segurança do Liga Legacy.');
 const campaigns = {};
 for (const [season, ids] of Object.entries(seasons)) {
  // A season added to clubs.json after this save was made starts empty.
  const campaign = state.campaigns[season] ?? emptyCampaign();
  const active = campaign.active ?? null;
  if (!Array.isArray(campaign.records) || campaign.records.length > ids.length || (active !== null && !ids.includes(active))) throw new Error('Esta cópia de segurança tem dados de clubes inválidos.');
  const records = campaign.records.map(record => validateRecord(record, ids));
  const completed = records.map(record => record.clubId);
  if (new Set(completed).size !== completed.length || completed.includes(active)) throw new Error('Um clube aparece mais do que uma vez nesta cópia de segurança.');
  campaigns[season] = { active, records };
 }
 return { version: 1, season: currentSeason(seasons), campaigns };
}
// Every problem with a title form at once, in field order, so the form can mark them all.
export function fieldErrors(record, ids) {
 const errors = [];
 const check = (field, ok, message) => { if (!ok && !errors.some(error => error.field === field)) errors.push({ field, message }); };
 check('seasons', isCount(record.seasons, 1, 999), 'Indica o número de épocas: um número inteiro entre 1 e 999.');
 check('name', typeof record.name === 'string' && record.name.trim() && record.name.length <= 60, 'Indica o nome do jogador (até 60 caracteres).');
 check('number', isCount(record.number, 1, 99), 'Indica um número de camisola entre 1 e 99.');
 check('position', positions.includes(record.position), 'Escolhe a posição do jogador.');
 check('photo', typeof record.photo === 'string' && (photoRef.test(record.photo) || isPhotoData(record.photo)), 'Adiciona uma fotografia do jogador.');
 const counts = record.trophies ?? {};
 check('trophies', Object.values(counts).every(count => isCount(count, 0, 999)), 'Indica um número inteiro de troféus (0 a 999) em cada competição.');
 check('trophies', (counts.liga ?? 1) >= 1, 'Indica pelo menos 1 título da Liga Portugal.');
 check('trophies', !isCount(record.seasons, 1, 999) || (counts.liga ?? 1) <= record.seasons, 'Não podes ter mais títulos da Liga Portugal do que épocas.');
 if (!errors.length) { try { validateRecord(record, ids); } catch (error) { errors.push({ field: error.field, message: error.message }); } }
 return errors;
}
export function recordTitle(campaign, record, ids) {
 const item = validateRecord(record, ids);
 if (!item.position) fail('position', 'Escolhe a posição do jogador.');
 if (item.trophies && item.trophies.liga > item.seasons) fail('trophies', 'Não podes ter mais títulos da Liga Portugal do que épocas.');
 const exists = campaign.records.some(entry => entry.clubId === item.clubId);
 if (!exists && campaign.active !== item.clubId) fail('club', 'Escolhe este clube antes de registares um título.');
 return { active: campaign.active === item.clubId ? null : campaign.active, records: exists ? campaign.records.map(entry => entry.clubId === item.clubId ? item : entry) : [...campaign.records, item] };
}
export const removeTitle = (campaign, clubId) => ({ ...campaign, records: campaign.records.filter(entry => entry.clubId !== clubId) });
const decimal = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export function stats(campaign, total) {
 const seasons = campaign.records.reduce((sum, record) => sum + record.seasons, 0);
 const completed = campaign.records.length;
 return { completed, total, seasons, average: completed ? decimal.format(seasons / completed) : '—', remaining: total - completed, percent: Math.round(completed / total * 100) };
}
const pluralRules = new Intl.PluralRules('pt-PT');
export const plural = (count, one, other) => `${count} ${pluralRules.select(count) === 'one' ? one : other}`;
// Lower-case and strip accents so "guimaraes" finds "Guimarães".
export const fold = text => text.trim().toLocaleLowerCase('pt-PT').normalize('NFD').replace(/[̀-ͯ]/g, '');
export const hexToRgb = hex => hex.replace('#', '').match(/.{2}/g).map(part => parseInt(part, 16) / 255);
const luminance = hex => {
 const [r, g, b] = hexToRgb(hex).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
 return .2126 * r + .7152 * g + .0722 * b;
};
// Pick a club colour dark enough for white text: the primary, else a dark secondary, else a darkened primary.
export function readableAccent(primary, secondary) {
 if (luminance(primary) <= .18) return primary;
 if (secondary && luminance(secondary) <= .18) return secondary;
 return '#' + primary.slice(1).match(/.{2}/g).map(part => Math.round(parseInt(part, 16) * .53).toString(16).padStart(2, '0')).join('');
}
// Rotation that stops sector `index` under the pointer. `fraction` (0–1) is where inside the sector it
// lands: off-centre stops near a boundary are what make the last moments tense.
export function wheelTarget(rotation, index, count, fraction = .5, turns = 5) {
 if (!Number.isFinite(rotation) || !Number.isInteger(count) || count < 1 || !Number.isInteger(index) || index < 0 || index >= count || !(fraction > 0 && fraction < 1)) throw new Error('Sorteio inválido.');
 return Math.floor(rotation / 360) * 360 + turns * 360 + 360 - (index + fraction) * 360 / count;
}
// Which sector sits under the pointer for a given disc rotation (sectors run clockwise from the top).
export const sectorAt = (rotation, count) => Math.floor((((-rotation % 360) + 360) % 360) / (360 / count)) % count;
export function arrangeWheelTeams(teams) {
 const groups = new Map();
 for (const team of teams) {
  const [r, g, b] = hexToRgb(team.primary);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let family = 'neutral';
  if (max >= .2 && delta / max >= .2) {
   const hue = ((max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60 + 360) % 360;
   family = hue < 30 || hue >= 330 ? 'red' : hue < 80 ? 'yellow' : hue < 180 ? 'green' : hue < 275 ? 'blue' : 'purple';
  }
  if (!groups.has(family)) groups.set(family, []);
  groups.get(family).push(team);
 }
 const ordered = new Array(teams.length);
 let position = 0;
 // A colour occupying over half the wheel must have adjacent sectors.
 for (const group of [...groups.values()].sort((a, b) => b.length - a.length)) {
  for (const team of group) {
   if (position >= teams.length) position = 1;
   ordered[position] = team;
   position += 2;
  }
 }
 return ordered;
}
