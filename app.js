import { emptyState, validateState, recordTitle, removeTitle, stats, readableAccent, fold, plural, fieldErrors, photoRef, isPhotoData, maxPhotoBytes } from './core.js';
import { trophies } from './trophies.js';
import { readProgress } from './storage.js';
import { store, campaign, club, teams, record } from './store.js';
import { $, html, announce, openDialogs, showModal, downloadBlob, reducedMotion } from './dom.js';
import { icon, hydrateIcons } from './icons.js';
import { commit, loadPhotos, newPhotoId, watchRemoteChanges } from './persist.js';
import { exportBackup, readBackup, extractPhotos, lastBackup } from './backup.js';
import { heroView, statsView, clubCard, hallView, clubDetail, mvpCard, trophyImage, clubCounts } from './views.js';
import { openWheel } from './wheel.js';
import { countries } from './countries.js';
const views = { journey: 'O meu desafio', clubs: 'Clubes', hall: 'Mural de campeões' };
const percent = new Intl.NumberFormat('pt-PT', { style: 'percent' });
const day = new Intl.DateTimeFormat('pt-PT');
let filter = 'all', formDirty = false, editingClub = null, photo = '', photoFile = null, previewUrl = '', uploadToken = 0, unreadableRaw = null;
const goldTheme = { primary: '#d9a82e', secondary: '#7d5a0c' };
const setCampaign = (next, photos) => commit({ ...store.state, campaigns: { ...store.state.campaigns, [store.state.season]: next } }, photos);
function theme(team) {
 const root = document.documentElement.style;
 if (!team) {
  ['--accent', '--accent-ink', '--secondary', '--tint'].forEach(name => root.removeProperty(name));
  $('meta[name="theme-color"]').content = '#027f56';
  return;
 }
 const accent = readableAccent(team.primary, team.secondary);
 root.setProperty('--accent', team.primary);
 root.setProperty('--accent-ink', accent);
 root.setProperty('--secondary', team.secondary);
 root.setProperty('--tint', `${accent}0c`);
 $('meta[name="theme-color"]').content = accent;
}
function dialogAccent(dialog, team) {
 const accent = readableAccent(team.primary, team.secondary);
 dialog.style.setProperty('--accent-ink', accent);
 dialog.style.setProperty('--tint', `${accent}0c`);
}
const backupAge = () => lastBackup() ? `Última cópia: ${day.format(new Date(lastBackup()))}` : 'Ainda sem cópia de segurança';
function renderSaveStatus() {
 // Flag the backup button when titles exist that no backup contains yet.
 const newest = Math.max(0, ...Object.values(store.state.campaigns).flatMap(item => item.records.map(entry => Date.parse(entry.date))));
 const stale = newest > 0 && !(Date.parse(lastBackup()) >= newest);
 document.querySelectorAll('[data-action="backup"]').forEach(button => button.toggleAttribute('data-stale', stale));
}
function render() {
 const summary = stats(campaign(), teams().length);
 const done = summary.remaining === 0;
 // Gold once every club is a champion; otherwise the active club, or the last champion until a new club is chosen.
 theme(done ? goldTheme : club(campaign().active) ?? club(campaign().records.at(-1)?.clubId));
 document.body.classList.toggle('is-complete', done);
 // Clubs still without a title: drops as each club becomes champion.
 $('#nav-club-count').textContent = summary.remaining;
 $('#nav-club-count').title = `${plural(summary.remaining, 'clube', 'clubes')} por conquistar`;
 $('#nav-hall-count').textContent = summary.completed;
 $('#side-count').textContent = `${summary.completed} de ${summary.total} títulos`;
 $('#side-percent').textContent = percent.format(summary.completed / summary.total);
 $('#side-progress').style.width = `${summary.percent}%`;
 $('#journey-lead').textContent = done ? 'Desafio concluído.' : `Sê campeão com os ${summary.total} clubes da Liga Portugal.`;
 $('#hero').innerHTML = heroView(summary);
 $('#stats').innerHTML = statsView(summary);
 $('#stats').hidden = !summary.completed;
 // Champion clubs first, most recent title first; then the current club, then clubs still to win.
 const rank = team => record(team.id) ? -Date.parse(record(team.id).date) : campaign().active === team.id ? 1 : 2;
 $('#club-preview').innerHTML = [...teams()].sort((a, b) => rank(a) - rank(b)).slice(0, 8).map(clubCard).join('');
 renderClubList();
 $('#hall-content').innerHTML = hallView();
 $('#hall-count').textContent = plural(summary.completed, 'título', 'títulos');
 renderSaveStatus();
}
function renderClubList(announceResults = false) {
 const search = fold($('#club-search').value);
 const visible = teams().filter(team => (!search || fold(team.name).includes(search) || fold(team.history.city).includes(search)) && (filter === 'all' || (filter === 'completed') === Boolean(record(team.id))));
 $('#all-clubs').innerHTML = visible.map(clubCard).join('');
 $('#no-clubs').hidden = visible.length > 0;
 $('#no-clubs').textContent = !search && filter === 'completed' ? 'Ainda não tens títulos. Quando fores campeão, o clube aparece aqui.' : 'Nenhum clube encontrado. Altera a pesquisa ou o filtro.';
 const counts = clubCounts();
 document.querySelectorAll('[data-filter]').forEach(button => {
  button.querySelector('span').textContent = counts[button.dataset.filter];
  button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
 });
 if (announceResults) $('#club-results').textContent = visible.length ? plural(visible.length, 'clube encontrado', 'clubes encontrados') : 'Nenhum clube encontrado';
}
const currentView = () => Object.hasOwn(views, location.hash.slice(1)) ? location.hash.slice(1) : 'journey';
const closeDialogs = () => openDialogs().reverse().forEach(dialog => dialog.close());
// After an action re-renders the page, the button that opened the dialog is gone; land on the view heading.
const focusView = () => $(`#${currentView()}-view h1`).focus();
function goTo(view) { if (currentView() === view) focusView(); else location.hash = view; }
function navigate(event) {
 const view = currentView();
 closeDialogs();
 document.querySelectorAll('.view').forEach(node => node.hidden = node.id !== `${view}-view`);
 document.querySelectorAll('[data-nav]').forEach(node => {
  if (node.dataset.nav === view) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current');
 });
 document.title = view === 'journey' ? 'Liga Legacy — Desafio Portugal' : `${views[view]} — Liga Legacy`;
 window.scrollTo(0, 0);
 if (event) focusView();
}
function showDialog(dialog, focusTarget, stack = false) {
 if (!stack) closeDialogs();
 showModal(dialog);
 (focusTarget ?? dialog.querySelector('h2')).focus();
}
// From the draw, the profile opens on top so closing it returns to the drawn club.
function showClub(id, stack = false) {
 const team = club(id);
 if (!team) return;
 dialogAccent($('#club-dialog'), team);
 $('#club-detail').innerHTML = clubDetail(team);
 showDialog($('#club-dialog'), undefined, stack);
}
const selectedTrophies = () => Object.fromEntries([...document.querySelectorAll('[data-trophy]')].map(input => [input.dataset.trophy, Number(input.value)]));
const fieldInputs = { seasons: '#seasons-input', name: '#mvp-name', number: '#mvp-number', position: '#mvp-position', nationality: '#mvp-nationality', photo: '#mvp-photo' };
function clearErrors() {
 $('#form-error').textContent = '';
 document.querySelectorAll('#win-form .field-error').forEach(node => node.remove());
 document.querySelectorAll('#win-form [aria-invalid]').forEach(node => { node.removeAttribute('aria-invalid'); node.removeAttribute('aria-describedby'); });
}
function fieldInput(field) {
 if (field !== 'trophies') return $(fieldInputs[field] ?? 'x-none');
 const inputs = [...document.querySelectorAll('[data-trophy]')];
 return inputs.find(node => !Number.isInteger(Number(node.value)) || Number(node.value) < Number(node.min) || Number(node.value) > 999) ?? inputs[0];
}
// Mark every invalid field with its own message, then focus the first one.
function setErrors(errors) {
 clearErrors();
 if (!errors.length) return;
 $('#form-error').textContent = errors.length === 1 ? errors[0].message : `Corrige os ${errors.length} campos assinalados.`;
 const marked = errors.map(({ field, message }) => {
  const input = fieldInput(field);
  if (!input) return null;
  if (field === 'trophies') $('.trophy-picker').open = true;
  const note = document.createElement('span');
  note.className = 'field-error';
  note.id = `error-${field}`;
  note.textContent = message;
  (field === 'trophies' ? $('#trophy-options') : field === 'photo' ? input.closest('label') : input).after(note);
  input.setAttribute('aria-invalid', 'true');
  input.setAttribute('aria-describedby', note.id);
  return input;
 }).filter(Boolean);
 marked[0]?.focus();
}
const setError = (message, field) => setErrors([{ field, message }]);
function openWin(id) {
 const team = club(id), saved = record(id);
 if (!team || (!saved && campaign().active !== id)) return;
 dialogAccent($('#win-dialog'), team);
 editingClub = id; photo = saved?.photo || ''; photoFile = null; uploadToken++;
 if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = ''; }
 $('#win-form').reset();
 clearErrors();
 $('#win-title').textContent = saved ? 'Editar título' : 'Campeão!';
 $('#win-subtitle').textContent = team.name;
 $('#seasons-input').value = saved?.seasons || '';
 $('#mvp-name').value = saved?.name || '';
 $('#mvp-number').value = saved?.number || '';
 $('#mvp-position').value = saved?.position || '';
 $('#mvp-nationality').value = saved?.nationality || '';
 $('#trophy-options').innerHTML = trophies.map(trophy => `<label class="trophy-option">${trophyImage(trophy)}<span>${trophy.name}</span><input type="number" inputmode="numeric" min="${trophy.id === 'liga' ? 1 : 0}" max="999" step="1" data-trophy="${trophy.id}" value="${saved?.trophies?.[trophy.id] ?? (trophy.id === 'liga' ? 1 : 0)}"></label>`).join('');
 $('.trophy-picker').open = true;
 $('#upload-caption').innerHTML = saved ? 'Alterar fotografia<small>Fotografia guardada</small>' : 'Carregar fotografia<small>Obrigatória · PNG, JPG ou WebP até 10 MB</small>';
 $('#save-win').innerHTML = `${icon('trophy')}${saved ? 'Guardar alterações' : 'Guardar título'}`;
 $('#save-win').disabled = false;
 $('#delete-win').hidden = !saved;
 formDirty = false;
 renderPreview();
 showDialog($('#win-dialog'), $('#seasons-input'));
}
function renderPreview() {
 const counts = selectedTrophies();
 const total = Object.values(counts).reduce((sum, count) => sum + (Number.isInteger(count) && count > 0 ? count : 0), 0);
 $('#trophy-summary').textContent = plural(total, 'troféu', 'troféus');
 const team = club(editingClub);
 if (!team) return;
 $('#mvp-preview').innerHTML = mvpCard(team, { name: $('#mvp-name').value.trim(), number: $('#mvp-number').value, position: $('#mvp-position').value, nationality: $('#mvp-nationality').value, trophies: counts, seasons: $('#seasons-input').value, photo: previewUrl || photo });
}
async function uploadPhoto() {
 const file = $('#mvp-photo').files[0];
 if (!file) return;
 clearErrors();
 if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > maxPhotoBytes) return setError('Escolhe uma fotografia PNG, JPG ou WebP até 10 MB.', 'photo');
 const token = ++uploadToken;
 $('#save-win').disabled = true;
 try {
  // Decode once to reject broken files; the original file is stored untouched, at full quality.
  const bitmap = await createImageBitmap(file);
  bitmap.close();
  if (token !== uploadToken) return;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  photoFile = file; previewUrl = URL.createObjectURL(file);
  $('#upload-caption').innerHTML = `${html(file.name)}<small>Fotografia pronta · clica para alterar</small>`;
  renderPreview();
 } catch (error) {
  console.error(error);
  if (token === uploadToken) setError('Não foi possível abrir esta fotografia. Experimenta outro ficheiro PNG, JPG ou WebP.', 'photo');
 } finally { if (token === uploadToken) $('#save-win').disabled = false; }
}
async function saveWin(event) {
 event.preventDefault();
 if ($('#save-win').disabled) return;
 const existing = record(editingClub), put = [], remove = [];
 const photoId = photoFile ? newPhotoId() : photo;
 if (photoFile) put.push([photoId, photoFile]);
 if (photoFile && photoRef.test(existing?.photo ?? '')) remove.push(existing.photo);
 const value = selector => $(selector).value.trim() === '' ? NaN : Number($(selector).value);
 const item = { clubId: editingClub, seasons: value('#seasons-input'), name: $('#mvp-name').value.trim(), number: value('#mvp-number'), position: $('#mvp-position').value, nationality: $('#mvp-nationality').value, trophies: selectedTrophies(), photo: photoId, date: existing?.date || new Date().toISOString() };
 const ids = store.data.seasons[store.state.season], errors = fieldErrors(item, ids);
 if (errors.length) return setErrors(errors);
 let next;
 try { next = recordTitle(campaign(), item, ids); } catch (error) { return setError(error.message, error.field); }
 $('#save-win').disabled = true;
 const saved = await setCampaign(next, { put, remove });
 $('#save-win').disabled = false;
 if (!saved) return;
 formDirty = false; $('#win-dialog').close(); render(); goTo('hall');
 const stale = !lastBackup() || Date.now() - Date.parse(lastBackup()) > 7 * 864e5;
 const finished = !existing && campaign().records.length === teams().length;
 announce(finished ? `Parabéns! Foste campeão com os ${teams().length} clubes.` : existing ? 'Título atualizado.' : `Título registado: ${club(item.clubId).name}.${stale ? ' Exporta uma cópia de segurança para não o perderes.' : ''}`);
 if (!existing) celebrate(finished);
}
async function deleteWin() {
 const team = club(editingClub), existing = record(editingClub);
 if (!existing || !confirm(`Remover o título do ${team.name}? O MVP e a fotografia também são removidos.`)) return;
 if (!await setCampaign(removeTitle(campaign(), editingClub), { remove: photoRef.test(existing.photo) ? [existing.photo] : [] })) return;
 formDirty = false; $('#win-dialog').close(); render(); focusView();
 announce(`Título do ${team.name} removido.`);
}
function celebrate(grand = false) {
 if (reducedMotion()) return;
 const container = $('#confetti'), accent = getComputedStyle(document.documentElement).getPropertyValue('--accent');
 container.replaceChildren(...Array.from({ length: grand ? 140 : 44 }, (_, index) => {
  const piece = document.createElement('span');
  piece.className = 'confetti-piece';
  piece.style.cssText = `left:${Math.random() * 100}%;background:${(grand ? ['#e2bf55', '#c2952a', '#fff3c4'] : ['#c2ac62', accent, '#a8c6b6'])[index % 3]};animation-delay:${Math.random() * .6}s;animation-duration:${1.7 + Math.random()}s`;
  return piece;
 }));
 setTimeout(() => container.replaceChildren(), 3500);
}
function showInfo() {
 $('#info-content').innerHTML = `${icon('download')}<h2 id="info-title" tabindex="-1">Cópia de segurança</h2><p>Os títulos e as fotografias ficam só neste navegador. Exporta uma cópia para não os perderes ou para mudares de dispositivo.</p><p class="backup-last">${backupAge()}</p><button class="primary-button" data-action="export">${icon('download')}Exportar cópia</button><button class="secondary-button" data-action="import">${icon('upload')}Importar cópia</button><input id="import-backup" type="file" accept="application/json,.json" hidden>${unreadableRaw ? '<button class="secondary-button" data-action="recover">Descarregar dados para recuperação</button>' : ''}<p id="backup-error" class="form-error" role="alert"></p>`;
 showDialog($('#info-dialog'));
}
async function runExport() {
 try {
  await exportBackup();
  renderSaveStatus();
  const last = $('.backup-last');
  if (last) last.textContent = backupAge();
  announce('Cópia de segurança exportada.');
 } catch (error) { console.error(error); announce('Não foi possível exportar a cópia de segurança.'); }
}
async function importBackup(input) {
 const file = input.files[0];
 input.value = '';
 if (!file) return;
 $('#backup-error').textContent = '';
 try {
  const { state, put } = await readBackup(file);
  const count = Object.values(state.campaigns).reduce((sum, item) => sum + item.records.length, 0);
  if (!confirm(`Substituir os dados deste navegador (${plural(campaign().records.length, 'título', 'títulos')}) pela cópia (${plural(count, 'título', 'títulos')})?`)) return;
  if (!await commit(state, { clear: true, put })) return;
  $('#info-dialog').close(); render(); navigate();
  announce('Cópia de segurança importada.');
 } catch (error) { console.error(error); $('#backup-error').textContent = error.message; }
}
async function setActive(id, message) {
 if (!await setCampaign({ ...campaign(), active: id })) return;
 closeDialogs(); render();
 if (id) goTo('journey'); else focusView();
 announce(message);
}
document.addEventListener('click', event => {
 if (!store.state) return;
 const close = event.target.closest('[data-close]');
 if (close) { requestClose(close.closest('dialog')); return; }
 const action = event.target.closest('[data-action]');
 if (!action) return;
 const id = action.dataset.id;
 switch (action.dataset.action) {
  case 'club': showClub(id); break;
  case 'explore': closeDialogs(); goTo('clubs'); break;
  case 'hall': location.hash = 'hall'; break;
  case 'random': closeDialogs(); openWheel(); break;
  case 'profile': showClub(id, true); break;
  case 'manage': setActive(id, `Estás a treinar: ${club(id).name}.`); break;
  case 'leave': setActive(null, `Deixaste de treinar: ${club(campaign().active).name}.`); break;
  case 'win': case 'edit': openWin(id); break;
  case 'delete': deleteWin(); break;
  case 'backup': showInfo(); break;
  case 'export': runExport(); break;
  case 'import': $('#import-backup').click(); break;
  case 'recover': downloadBlob(new Blob([unreadableRaw], { type: 'application/json' }), 'liga-legacy-recovery.json'); break;
 }
});
// Close on a backdrop click only when the press also started on the backdrop (not a text-selection drag).
const outside = (dialog, event) => {
 const box = dialog.getBoundingClientRect();
 return event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom);
};
// A changed title form asks before Cancelar, Escape or a backdrop click throws it away.
const keepEditing = dialog => dialog.id === 'win-dialog' && formDirty && !confirm('Descartar as alterações a este título?');
function requestClose(dialog) { if (!keepEditing(dialog)) dialog.close(); }
document.querySelectorAll('dialog').forEach(dialog => {
 let pressedOutside = false;
 dialog.addEventListener('pointerdown', event => { pressedOutside = outside(dialog, event); });
 dialog.addEventListener('click', event => { if (pressedOutside && outside(dialog, event)) requestClose(dialog); pressedOutside = false; });
 dialog.addEventListener('cancel', event => { if (keepEditing(dialog)) event.preventDefault(); });
});
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; renderClubList(true); }));
$('#club-search').addEventListener('input', () => renderClubList(true));
$('#win-form').addEventListener('input', event => {
 formDirty = true;
 if (event.target.id === 'mvp-photo') return;
 const note = event.target.getAttribute('aria-describedby');
 if (note) document.getElementById(note)?.remove();
 event.target.removeAttribute('aria-invalid');
 event.target.removeAttribute('aria-describedby');
 if (!document.querySelector('#win-form [aria-invalid]')) $('#form-error').textContent = '';
 renderPreview();
});
$('#mvp-photo').addEventListener('change', uploadPhoto);
$('#win-form').addEventListener('submit', saveWin);
document.addEventListener('change', event => { if (event.target.id === 'import-backup') importBackup(event.target); });
document.addEventListener('progress-recovered', () => { unreadableRaw = null; renderSaveStatus(); });
window.addEventListener('hashchange', navigate);
async function loadProgress() {
 let stored;
 try { stored = await readProgress(); }
 catch (error) {
  console.error(error);
  announce('Este navegador não permite guardar dados aqui. O progresso não vai ficar guardado.');
  return emptyState(store.data.seasons);
 }
 store.snapshot = stored;
 if (!stored) return emptyState(store.data.seasons);
 try {
  const state = validateState(JSON.parse(stored), store.data.seasons);
  await loadPhotos(state);
  return state;
 } catch (error) {
  // Keep unreadable data for recovery instead of overwriting it.
  console.error(error);
  store.unreadable = true; unreadableRaw = stored;
  announce('Não foi possível ler os dados guardados. Abre a cópia de segurança para os descarregares antes de continuares.');
  return emptyState(store.data.seasons);
 }
}
async function init() {
 hydrateIcons();
 // Portugal on top, since most MVPs in a Liga Portugal save will be Portuguese.
 const option = ([code, name]) => `<option value="${code}">${name}</option>`;
 $('#mvp-nationality').innerHTML = `<option value="">Escolher</option>${option(['pt', countries.pt])}<option disabled>──────────</option>${Object.entries(countries).filter(([code]) => code !== 'pt').map(option).join('')}`;
 try {
  const response = await fetch('clubs.json');
  if (!response.ok) throw new Error(`clubs.json ${response.status}`);
  store.data = await response.json();
 } catch (error) {
  console.error(error);
  $('#journey-view').innerHTML = '<div class="hall-empty"><h1>Não foi possível carregar os clubes.</h1><p>Verifica a ligação e tenta outra vez.</p><button class="primary-button" id="retry-load">Tentar outra vez</button></div>';
  $('#retry-load').addEventListener('click', () => location.reload());
  return;
 }
 store.state = await loadProgress();
 $('#data-date').textContent = day.format(new Date(store.data.retrieved));
 $('#data-date').dateTime = store.data.retrieved;
 render(); navigate();
 document.body.removeAttribute('aria-busy');
 watchRemoteChanges(() => { render(); announce('Progresso atualizado a partir de outro separador.'); });
 // Saves from before version 2 kept photos inline; move them to the photo store once.
 const inline = Object.values(store.state.campaigns).some(item => item.records.some(entry => isPhotoData(entry.photo)));
 if (inline && !store.unreadable) {
  const { state, put } = await extractPhotos(store.state);
  if (await commit(state, { put })) render();
 }
}
init();
