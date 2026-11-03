import { wheelTarget, sectorAt, arrangeWheelTeams, readableAccent, plural } from './core.js';
import { campaign, teams, record } from './store.js';
import { $, html, announce, reducedMotion, showModal } from './dom.js';
import { icon } from './icons.js';
// Sorteio. The disc spins fast, then crawls for its last seconds past one or two crests; the pointer
// flicks and ticks on every sector, the club under the pointer is named, and the result is held back
// for a beat before it is revealed. A click, Enter or Space skips straight to the result.
let wheelTeams = [], rotation = 0, animation = null, spins = 0, frame = 0, current = -1, revealTimer = 0, skipped = false;
const dialog = $('#wheel-dialog'), disc = $('#wheel-disc');
const soundKey = 'liga-legacy-sound';
let audio = null;
const soundOn = () => { try { return localStorage.getItem(soundKey) !== 'off'; } catch { return true; } };
function renderSoundButton() {
 const on = soundOn(), button = $('#wheel-sound');
 button.innerHTML = icon(on ? 'sound' : 'mute');
 button.setAttribute('aria-pressed', String(on));
}
function tone(frequency, duration, volume, delay = 0) {
 if (!audio || !soundOn()) return;
 const start = audio.currentTime + delay, oscillator = audio.createOscillator(), gain = audio.createGain();
 oscillator.type = 'triangle';
 oscillator.frequency.value = frequency;
 gain.gain.setValueAtTime(volume, start);
 gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
 oscillator.connect(gain).connect(audio.destination);
 oscillator.start(start);
 oscillator.stop(start + duration);
}
const tick = () => tone(1400, .03, .05);
const fanfare = () => [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => tone(frequency, .4, .07, index * .09));
const discRotation = () => {
 const matrix = new DOMMatrixReadOnly(getComputedStyle(disc).transform);
 return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
};
// Follow the real disc position each frame: tick, flick the pointer and name the club under it.
function follow() {
 if (!animation) return;
 const index = sectorAt(discRotation(), wheelTeams.length);
 if (index !== current) {
  current = index;
  tick();
  $('.wheel-pointer').animate([{ transform: 'translateX(-50%) rotate(-22deg)' }, { transform: 'translateX(-50%) rotate(0deg)' }], { duration: 160, easing: 'cubic-bezier(.2,.8,.2,1)' });
  $('#wheel-passing').textContent = wheelTeams[index].name;
 }
 frame = requestAnimationFrame(follow);
}
export function openWheel() {
 wheelTeams = arrangeWheelTeams(teams().filter(team => !record(team.id) && team.id !== campaign().active));
 if (!wheelTeams.length) return announce('Não há clubes disponíveis para o sorteio.');
 // Created during the click so browsers allow the sound.
 try { audio ??= new AudioContext(); audio.resume(); } catch { audio = null; }
 rotation = 0; spins = 0;
 dialog.style.removeProperty('--accent-ink');
 const slice = 360 / wheelTeams.length;
 disc.style.transform = 'rotate(0deg)';
 disc.style.setProperty('--face-rotation', '0deg');
 disc.style.background = `conic-gradient(${wheelTeams.map((team, index) => `${team.primary} ${index * slice}deg ${(index + 1) * slice}deg`).join(',')})`;
 disc.innerHTML = wheelTeams.map((team, index) => `<span class="wheel-club" style="--angle:${(index + .5) * slice}deg" title="${html(team.name)}"><span class="wheel-club-face" style="--logo-wide:${Math.sqrt(team.logoFrame.ratio).toFixed(3)};--logo-tall:${(1 / Math.sqrt(team.logoFrame.ratio)).toFixed(3)}"><svg viewBox="${team.logoFrame.viewBox}" aria-hidden="true"><image href="${team.logo}" width="${team.logoFrame.width}" height="${team.logoFrame.height}"/></svg></span></span>`).join('');
 $('#wheel-footnote').textContent = `${plural(wheelTeams.length, 'clube', 'clubes')} no sorteio`;
 renderSoundButton();
 showModal(dialog);
 $('#wheel-title').focus();
 spin();
}
async function spin() {
 if (animation || !wheelTeams.length) return;
 clearTimeout(revealTimer);
 const index = Math.floor(Math.random() * wheelTeams.length), team = wheelTeams[index];
 // Land anywhere from 8% to 92% into the sector, so some draws stop a hair from the next club.
 const target = wheelTarget(rotation, index, wheelTeams.length, .08 + Math.random() * .84, spins ? 4 : 6);
 const reduced = reducedMotion();
 dialog.classList.remove('has-winner', 'is-landed'); dialog.classList.add('is-spinning');
 disc.querySelectorAll('.is-winner').forEach(node => node.classList.remove('is-winner'));
 $('#wheel-winner').hidden = true; $('#wheel-spin').disabled = true; $('#wheel-pick').disabled = true; $('#wheel-profile').disabled = true;
 $('#wheel-status').textContent = wheelTeams.length === 1 ? 'Só falta um clube…' : 'A sortear… clica na roda ou carrega em Enter para saltar.';
 $('#wheel-passing').textContent = '';
 // The disc rotates as one layer; crests counter-rotate once at rest instead of on every frame.
 animation = disc.animate([{ transform: `rotate(${rotation}deg)` }, { transform: `rotate(${target}deg)` }], { duration: reduced ? 0 : spins++ ? 4500 : 7000, easing: 'cubic-bezier(.1,.7,.05,1)', fill: 'forwards' });
 current = -1;
 if (!reduced) frame = requestAnimationFrame(follow);
 skipped = false;
 try { await animation.finished; } catch { return; } finally { cancelAnimationFrame(frame); }
 if (!dialog.open) return;
 disc.style.transform = `rotate(${target}deg)`; animation.cancel(); animation = null; rotation = target;
 disc.style.setProperty('--face-rotation', `${-target}deg`);
 $('#wheel-passing').textContent = team.name;
 // Hold the result: spotlight the winning crest, then reveal.
 dialog.classList.remove('is-spinning'); dialog.classList.add('is-landed');
 disc.children[index]?.classList.add('is-winner');
 const reveal = () => {
  if (!dialog.open) return;
  dialog.style.setProperty('--accent-ink', readableAccent(team.primary, team.secondary));
  dialog.classList.add('has-winner');
  $('#wheel-winner').innerHTML = `<span class="wheel-result-crest" style="--winner-colour:${team.primary}"><img src="${team.logo}" alt="" width="68" height="72"></span><strong>${html(team.name)}</strong>`;
  $('#wheel-winner').hidden = false; $('#wheel-status').textContent = `Clube sorteado: ${team.name}.`;
  $('#wheel-spin').disabled = false; $('#wheel-pick').disabled = false; $('#wheel-profile').disabled = false; $('#wheel-pick').dataset.id = team.id; $('#wheel-profile').dataset.id = team.id;
  fanfare();
  $('#wheel-pick').focus();
 };
 if (reduced || skipped) reveal(); else revealTimer = setTimeout(reveal, 900);
}
function skip() { if (!animation) return; skipped = true; animation.finish(); }
$('#wheel-spin').addEventListener('click', spin);
$('.wheel-stage').addEventListener('click', skip);
dialog.addEventListener('keydown', event => { if (animation && (event.key === 'Enter' || event.key === ' ') && event.target.id !== 'wheel-sound') { event.preventDefault(); skip(); } });
$('#wheel-sound').addEventListener('click', () => {
 try { localStorage.setItem(soundKey, soundOn() ? 'off' : 'on'); } catch {}
 renderSoundButton();
});
dialog.addEventListener('close', () => { clearTimeout(revealTimer); cancelAnimationFrame(frame); animation?.cancel(); animation = null; dialog.classList.remove('is-spinning', 'is-landed', 'has-winner'); });
