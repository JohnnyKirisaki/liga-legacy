const icons = {
 grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/>',
 trophy: '<path d="M7 3h10v6a5 5 0 0 1-10 0zM7 5H3v3a4 4 0 0 0 5 4m9-7h4v3a4 4 0 0 1-5 4M12 14v5m-4 2h8m-8-2h8"/>',
 download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
 upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
 help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-1 .4-1 1.2-1 2M12 17h.01"/>',
 arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
 clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 chart: '<path d="M4 20V4m0 16h17M8 15l4-5 4 3 5-7"/>',
 flag: '<path d="M5 21V3m0 1c5-4 9 4 15 0v10c-6 4-10-4-15 0"/>',
 search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
 shuffle: '<path d="M3 6h3c4 0 8 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 6-6m2-3c2-2 3-3 4-3h3m-4-4 4 4-4 4"/>',
 close: '<path d="m6 6 12 12M6 18 18 6"/>',
 external: '<path d="M14 3h7v7m0-7L10 14M11 4H4v16h16v-7"/>',
 check: '<path d="m5 12 4 4L19 6"/>',
 sound: '<path d="M4 9v6h4l5 4V5L8 9zm12 0a4 4 0 0 1 0 6m2.5-8.5a7.5 7.5 0 0 1 0 11"/>',
 mute: '<path d="M4 9v6h4l5 4V5L8 9zm12 1 5 5m0-5-5 5"/>',
 trash:'<path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13"/>',
 star: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.8L6.6 20l1-6L3.2 9.4l6.1-.9z"/>'
};
const svg = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.star}</svg>`;
export const icon = name => `<i aria-hidden="true">${svg(name)}</i>`;
// Static markup in index.html uses <i data-icon="name">; rendered templates call icon() directly.
export function hydrateIcons() { document.querySelectorAll('i[data-icon]').forEach(node => { node.innerHTML = svg(node.dataset.icon); node.setAttribute('aria-hidden', 'true'); node.removeAttribute('data-icon'); }); }
