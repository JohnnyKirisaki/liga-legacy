export const $ = selector => document.querySelector(selector);
export const html = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
// Dialogs can stack (a club profile over the draw); the most recently opened one is on top.
export const openDialogs = () => [...document.querySelectorAll('dialog[open]')].sort((a, b) => a.dataset.openedAt - b.dataset.openedAt);
export const openDialog = () => openDialogs().at(-1);
export function showModal(dialog) {
 dialog.dataset.openedAt = String(performance.now());
 dialog.showModal();
}
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const newTab = '<span class="sr-only"> (abre num novo separador)</span>';
let toastTimer;
// The visual toast moves into the top dialog to stay visible; screen readers hear the message
// from a live region that never moves (one per dialog, one in the page), since moved live regions are often skipped.
export function announce(message) {
 const host = openDialog(), toast = $('#toast');
 (host ?? document.body).append(toast);
 clearTimeout(toastTimer);
 toast.textContent = message;
 toast.classList.add('show');
 toastTimer = setTimeout(() => toast.classList.remove('show'), 5000);
 const live = host?.querySelector('.live-region') ?? $('#live');
 live.textContent = '';
 requestAnimationFrame(() => { live.textContent = message; });
}
export function downloadBlob(blob, name) {
 const link = document.createElement('a');
 link.href = URL.createObjectURL(blob);
 link.download = name;
 link.click();
 setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
// Local calendar date (YYYY-MM-DD), so a backup made just after midnight is not dated yesterday.
export const localDate = () => new Intl.DateTimeFormat('sv-SE').format(new Date());
