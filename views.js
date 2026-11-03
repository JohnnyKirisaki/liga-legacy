import { readableAccent, plural } from './core.js';
import { trophies } from './trophies.js';
import { campaign, club, teams, record, photoUrl } from './store.js';
import { html, newTab } from './dom.js';
import { icon } from './icons.js';
import { countries } from './countries.js';
// HTML templates. Every user-typed value goes through html() before it reaches markup.
export const positionNames = { goalkeeper: 'Guarda-redes', defender: 'Defesa', midfielder: 'Médio', attacker: 'Avançado' };
const placeholderTeam = { name: 'Liga Legacy', primary: '#027f56', secondary: '#ffffff', logo: 'brand-mark.svg' };
const epochs = count => plural(count, 'época', 'épocas');
const silhouette = '<svg viewBox="0 0 180 210" aria-hidden="true"><circle cx="90" cy="58" r="32"/><path d="M20 210v-48c0-37 25-62 70-62s70 25 70 62v48z"/></svg>';
export function trophyImage(trophy) {
 const frame = trophy.frame;
 return `<svg class="trophy-art" viewBox="${frame.viewBox}" style="--trophy-ratio:${frame.ratio}" aria-hidden="true"><image href="${trophy.image}" width="${frame.width}" height="${frame.height}"/></svg>`;
}
// One trophy image per title won, grouped by competition. Past 10 of the same trophy the rest
// shows as "+N", so an unrealistic 999 cannot flood the card with images.
const trophyCap = 10;
function trophyCollection(item) {
 const counts = item.trophies || { liga: 1 };
 const won = trophies.filter(trophy => Number.isInteger(counts[trophy.id]) && counts[trophy.id] > 0).map(trophy => {
  const count = counts[trophy.id], shown = Math.min(count, trophyCap);
  return `<li class="card-trophy" title="${trophy.name}: ${count}">${trophyImage(trophy).repeat(shown)}${count > shown ? `<span class="trophy-count" aria-hidden="true">+${count - shown}</span>` : ''}<span class="sr-only">${trophy.name}: ${count}</span></li>`;
 });
 return won.length ? `<ul class="card-trophies" aria-label="Troféus conquistados">${won.join('')}</ul>` : '';
}
export function mvpCard(team, item, id = '') {
 const src = photoUrl(item.photo);
 return `<div ${id ? `id="${id}" ` : ''}class="mvp-card" style="--card-color:${readableAccent(team.primary, team.secondary)};--card-accent:${team.primary};--card-secondary:${team.secondary}"><div class="card-window">${src ? `<img class="mvp-photo" src="${html(src)}" alt="${html(item.name || 'MVP')}" loading="lazy" decoding="async">` : `<div class="mvp-placeholder">${silhouette}</div>`}<div class="mvp-card-top"><div class="card-shirt"><span class="card-title-count">${html(item.seasons || '—')}</span><span class="shirt-caption">${Number(item.seasons) === 1 ? 'época' : 'épocas'}</span></div><img src="${team.logo}" alt="${html(team.name)}" width="38" height="42"></div><div class="mvp-card-bottom"><div class="card-player-details">${positionNames[item.position] ? `<span class="mvp-position" data-position="${item.position}">${positionNames[item.position]}</span>` : ''}<span class="card-shirt-number">N.º ${html(item.number || '—')}</span></div><h3>${html(item.name || 'O teu MVP')}${Object.hasOwn(countries, item.nationality ?? '') ? `<img class="mvp-flag" src="assets/flags/${item.nationality}.svg" alt="${countries[item.nationality]}" title="${countries[item.nationality]}" width="28" height="21">` : ''}</h3>${trophyCollection(item)}</div></div></div>`;
}
export function heroView(summary) {
 const current = club(campaign().active), done = summary.remaining === 0;
 const title = done ? 'Parabéns, campeão!' : current ? html(current.name) : summary.completed ? 'Escolhe o próximo clube.' : 'Escolhe o teu primeiro clube.';
 const text = done ? `Venceste a Liga Portugal com os ${summary.total} clubes, em ${epochs(summary.seasons)}.` : current ? 'Quando fores campeão no Football Manager, regista o título.' : '';
 const actions = done ? `<button class="primary-button" data-action="hall">Ver o mural ${icon('arrow')}</button>`
  : current ? `<button class="primary-button" data-action="win" data-id="${current.id}">${icon('trophy')}Fui campeão</button><button class="quiet-button" data-action="explore">Mudar de clube ${icon('arrow')}</button>`
  : `<button class="primary-button" data-action="explore">Escolher clube ${icon('arrow')}</button><button class="quiet-button" data-action="random">${icon('shuffle')}Sortear</button>`;
 const latest = campaign().records.at(-1);
 const art = done ? `<img class="hero-trophy" src="${trophies[0].image}" alt="" height="250">`
  : current ? `<img class="hero-crest-watermark" src="${current.logo}" alt="" width="220" height="220"><img class="hero-kit ${current.kit ? '' : 'crest-only'}" src="${current.kit || current.logo}" alt="" width="275" height="275">`
  : latest ? mvpCard(club(latest.clubId), latest)
  : '<svg class="hero-mark" viewBox="0 0 64 64"><g fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"><path d="M29 9 51 22v13L39 42"/><path d="M29 9 51 22v13L39 42" transform="rotate(120 32 32)"/><path d="M29 9 51 22v13L39 42" transform="rotate(240 32 32)"/></g></svg>';
 return `<div class="hero-copy"><h2>${title}</h2>${text ? `<p>${text}</p>` : ''}<div class="hero-actions">${actions}</div></div><div class="hero-art" aria-hidden="true"><div class="hero-orbit"></div>${art}</div>`;
}
export function statsView(summary) {
 if (!summary.completed) return '';
 return [['clock', 'Épocas no total', summary.seasons], ['chart', 'Média por título', `${summary.average}<small>épocas</small>`]]
  .map(([symbol, label, value]) => `<div class="stat"><div class="stat-label">${icon(symbol)}${label}</div><strong class="big-value">${value}</strong></div>`).join('');
}
export function clubCard(team) {
 const won = record(team.id), active = campaign().active === team.id;
 const status = won ? 'Campeão' : active ? 'A treinar' : '';
 return `<article class="club-card ${active ? 'current' : won ? 'complete' : ''}" style="--club:${readableAccent(team.primary, team.secondary)};--club-2:${team.secondary}"><button data-action="club" data-id="${team.id}">${status ? `<span class="club-tag">${icon(won ? 'trophy' : 'check')}${status}</span>` : ''}<img src="${team.logo}" alt="" loading="lazy" width="60" height="60"><h3>${html(team.name)}</h3>${won ? `<small>${epochs(won.seasons)}</small>` : ''}</button></article>`;
}
export function hallView() {
 const records = campaign().records;
 if (!records.length) {
  const active = campaign().active;
  return `<div class="hall-empty"><div aria-hidden="true">${mvpCard(club(active) ?? placeholderTeam, {})}</div><h2>Ainda não há títulos.</h2><p>Quando fores campeão, regista o título aqui.</p><button class="primary-button" data-action="${active ? 'win' : 'explore'}" ${active ? `data-id="${active}"` : ''}>${active ? 'Registar título' : 'Escolher clube'}${icon('arrow')}</button></div>`;
 }
 return `<div class="hall-grid">${records.map((item, index) => ({ item, index })).reverse().map(({ item, index }) => {
  const team = club(item.clubId);
  return `<article class="hall-entry">${mvpCard(team, item)}<div class="hall-entry-meta"><div><h2>${html(team.name)}</h2><p>${epochs(item.seasons)} · ${index + 1}.º título</p></div><button class="quiet-button" data-action="edit" data-id="${team.id}" aria-label="Editar título do ${html(team.name)}">Editar ${icon('arrow')}</button></div></article>`;
 }).join('')}</div>`;
}
export function clubDetail(team) {
 const won = record(team.id), active = campaign().active === team.id, history = team.history, current = club(campaign().active);
 const description = won ? `Campeão em ${epochs(won.seasons)}. MVP: ${html(won.name)}.` : active ? 'Estás a treinar este clube. Regista o título quando fores campeão.' : current ? `Ao escolheres este clube, deixas de treinar o ${html(current.name)}. Os títulos registados mantêm-se.` : '';
 const actions = won ? `<button class="primary-button" data-action="edit" data-id="${team.id}">${icon('trophy')}Editar título</button>`
  : active ? `<button class="primary-button" data-action="win" data-id="${team.id}">${icon('trophy')}Fui campeão</button><button class="quiet-button" data-action="leave">Deixar de treinar</button>`
  : `<button class="primary-button" data-action="manage" data-id="${team.id}">${icon('flag')}Treinar este clube</button>`;
 const link = (url, label) => `<a href="${html(url)}" target="_blank" rel="noopener noreferrer">${html(label)} ${icon('external')}${newTab}</a>`;
 return `<div class="club-profile-head"><img class="detail-crest" src="${team.logo}" alt="" width="76" height="80"><div><h2 id="club-dialog-title">${html(team.name)}</h2><p class="detail-subtitle">Fundado em ${team.founded || '—'} · ${html(history.city)}</p><div class="detail-colours" aria-hidden="true"><span style="background:${team.primary}"></span><span style="background:${team.secondary}"></span></div></div></div><section class="club-history" aria-label="História do clube"><div class="history-best"><div><span>Melhor na I Liga</span><strong>${html(history.bestFinish)}</strong></div><p>${html(history.bestSeasons)}</p></div><p class="history-summary">${html(history.summary)}</p><div class="history-milestone"><h3>Momento marcante</h3><p>${html(history.milestone)}</p></div><p class="history-note">Dados históricos até 2024/25.${history.note ? ' ' + html(history.note) : ''}</p><div class="history-sources">${history.sources.map(source => link(source.url, source.label)).join('')}${link(team.source, 'Liga Portugal')}</div></section><div class="profile-challenge">${description ? `<p class="detail-description">${description}</p>` : ''}<div class="profile-actions">${actions}</div></div>`;
}
export const clubCounts = () => {
 const done = campaign().records.length, total = teams().length;
 return { all: total, available: total - done, completed: done };
};
