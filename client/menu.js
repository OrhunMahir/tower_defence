// The main menu: choose a lord, a siege level and abilities, spend renown on new things,
// and look at achievements, the codex and the settings.
import { S, $ } from './state.js';
import { portrait } from './models.js';
import { profile, prefs, saveProfile, savedRun, setSavedRun, has, price, unlock, unlockProgress, UNLOCKS, dailyRun, today, ACH_KEYS, CODEX, codexProgress, resetProfile, title } from './profile.js';
import { sfx, initAudio } from './audio.js';
import {
  esc, fmt, plural, star, modsLine, statTip, MON, CHIPS, UNIT_TXT, FAM_TXT, SPEC_TXT, RAR_TXT, ITEM_TXT, LORD_TXT, ABIL_TXT, SIEGE_TXT, siegeName, siegeWords, siegeLines,
  AGE_TXT, ageName, PATH_TXT, WEATHER_TXT, MUT_TXT, roman, titleName, ACH_TXT, ICON, PIC,
} from './text.js';
import { itemDesc, titleBar } from './hud.js';

const L = () => S.layout;
const tip = (html) => `data-tip="${esc(html)}"`;
const TABS = [['play', 'Play'], ['unlocks', 'Unlocks'], ['ach', 'Achievements'], ['codex', 'Codex'], ['settings', 'Settings']];
let tab = 'play', ask = null, hooks = null;   // ask: the thing a second click will confirm

// The age a class belongs to: one of the four ages, or an age on one of the three paths.
const classAge = (d) => AGE_TXT[d.path ? L().paths[d.path].ages[d.age - L().ages.length - 1] : L().ages[d.age - 1].key][0];
// A locked thing: the first click asks, the second one pays.
function lockLabel(kind, key) {
  const id = `${kind}:${key}`, p = price(kind, key);
  if (ask === id) return `Unlock for ${star}${p}?`;
  return profile.renown >= p ? `${ICON.lock}${star}${p}` : `${ICON.lock}${star}${p} <small>(${p - profile.renown} more)</small>`;
}
function tryUnlock(kind, key) {
  const id = `${kind}:${key}`;
  if (profile.renown < price(kind, key)) { sfx('deny'); return; }
  if (ask !== id) { ask = id; render(); return; }
  ask = null;
  if (unlock(kind, key)) sfx('unlock');
  render();
}

function lordCard(k) {
  const [name, icon, desc, rule] = LORD_TXT[k], d = L().lords[k], own = has('lords', k), on = own && k === prefs.lord, deep = profile.lordBest[k];
  const mods = modsLine(d.mods) + (d.gold ? `, +${d.gold} gold` : '');
  return `<button data-lord="${k}" class="lord ${on ? 'on' : ''} ${own ? '' : 'lockd'}" ${tip(statTip(Object.keys(d.mods)))}><span class="li">${icon}</span>${deep ? `<i class="deep">wave ${deep}</i>` : ''}<b>${name}</b><span>${desc}</span><em>${mods}${rule ? `<br>${rule}` : ''}</em>${own ? '' : `<i class="lk">${lockLabel('lords', k)}</i>`}</button>`;
}

function playHtml() {
  const save = savedRun(), sieges = L().siege, top = sieges.length - 1, s = prefs.siege, d = dailyRun(), dl = profile.daily[d.date];
  // The named levels each add one rule; above them the ladder goes on without a top.
  const named = sieges.slice(2, Math.min(s, top) + 1).map((k) => `<span class="chip" ${tip(SIEGE_TXT[k][1])}>${SIEGE_TXT[k][0]}</span>`).join('');
  const beyond = s > top ? siegeLines(s, sieges).slice(0, -(top - 1)).reverse().map((x) => `<span class="chip mod">${x}</span>`).join('') : '';
  const rules = s <= 1 ? `<span class="chip">${SIEGE_TXT[sieges[s]][1]}</span>` : beyond + named;
  const mult = s === 0 ? '×0.5' : `×${(1 + 0.2 * (s - 1)).toFixed(1)}`;
  const far = profile.siege > 6, step = (by, label, off) => `<button class="btn alt" data-siege="${by}" ${off ? 'disabled' : ''}>${label}</button>`;
  const abils = Object.keys(L().abilities).map((k) => {
    const [icon, name, desc] = ABIL_TXT[k], own = has('abilities', k), on = own && prefs.abilities.includes(k);
    return `<button class="tile abt ${on ? 'on' : ''} ${own ? '' : 'lockd'}" data-abil="${k}" ${tip(`<b>${name}</b><br>${desc}<br>Ready again after ${L().abilities[k].cd} s.`)}><span class="ti">${icon}</span><b>${name}</b>${own ? '' : `<i class="lk">${lockLabel('abilities', k)}</i>`}</button>`;
  }).join('');
  // The deepest runs, from the highest siege level down.
  const best = Object.entries(profile.best).map(([k, b]) => [Number(k), b]).filter(([, b]) => b.wave > 0).sort((a, b) => b[0] - a[0]).slice(0, 4)
    .map(([k, b]) => `${siegeName(k, sieges)}: wave <b>${b.wave}</b>`);
  const contTxt = save ? `Wave ${save.wave + 1} is next. ${LORD_TXT[save.lord]?.[0] || ''}, ${siegeWords(save.siege | 0, sieges)}${save.daily ? ', daily run' : ''}.` : '';
  const sure = (id, text, normal) => (ask === id ? `<span style="color:#ffb0b3">${text}</span>` : normal);
  return `<div class="mlabel">Choose your lord</div><div id="lords">${Object.keys(L().lords).map(lordCard).join('')}</div>
    <div class="mrow">
      <div class="mcol"><div class="mlabel">Siege level</div>
        <div class="siege">${far ? step(-5, '«', s <= 0) : ''}${step(-1, ICON.left, s <= 0)}<div><b>${s < sieges.length ? `${siegeName(s, sieges)} (${s})` : siegeName(s, sieges)}</b><span>Renown ${mult}</span></div>${step(1, ICON.right, s >= profile.siege)}${far ? step(5, '»', s >= profile.siege) : ''}</div>
        <div class="rules">${rules}</div>
        <div class="hint">Outlast the first year (the fourth boss, wave ${L().yearLen}) at level ${profile.siege} to open level ${profile.siege + 1}: ${siegeName(profile.siege + 1, sieges)}. Every boss slain after that opens one more. The ladder has no top.</div></div>
      <div class="mcol"><div class="mlabel">Take three abilities</div><div class="abts">${abils}</div></div>
    </div>
    <div id="menu">
      ${save ? `<button data-go="continue" class="main"><b>Continue</b><span>${contTxt}</span></button>` : ''}
      <button data-go="new" class="${save ? '' : 'main'}"><b>New run</b><span>${sure('new', 'Click again to replace the saved run.', 'A siege without end, with the lord, siege level and abilities above.')}</span></button>
      <button data-go="daily"><b>Daily challenge</b><span>${sure('daily', 'Click again to replace the saved run.', `${LORD_TXT[d.opts.lord][0]} at siege ${d.opts.siege}, with everything unlocked. ${dl ? `You reached wave <b>${dl.wave}</b> today.` : 'The same run for everyone today.'}`)}</span></button>
    </div>
    <div id="records">${best.length ? `Deepest runs: ${best.join(', ')}` : 'There is no last wave. Hold the castle for as long as you can. Every run earns renown, which unlocks new lords, classes, items, relics and abilities.'}</div>`;
}

function unlocksHtml() {
  const [have, all] = unlockProgress();
  const tile = (kind, key, icon, name, sub, info) => {
    const own = has(kind, key), can = profile.renown >= price(kind, key);
    return `<button class="tile ${own ? 'own' : can ? 'can' : 'lockd'}" data-unlock="${kind}:${key}" ${tip(info)}>${icon}<b>${name}</b><span>${sub}</span><i class="lk">${own ? `${ICON.check}Unlocked` : lockLabel(kind, key)}</i></button>`;
  };
  const pic = (src) => `<img class="tp" src="${src}" alt="">`, emo = (e) => `<span class="ti">${e}</span>`;
  const lords = UNLOCKS.lords[1].filter((k) => price('lords', k)).map((k) => tile('lords', k, emo(LORD_TXT[k][1]), LORD_TXT[k][0], LORD_TXT[k][2], `${modsLine(L().lords[k].mods)}${LORD_TXT[k][3] ? `<br>${LORD_TXT[k][3]}` : ''}`));
  const classes = UNLOCKS.classes[1].filter((k) => price('classes', k)).map((k) => { const d = L().unitStats[k]; return tile('classes', k, pic(portrait('unit', k)), UNIT_TXT[k][0], `${FAM_TXT[d.fam][0]}, ${classAge(d)}`, `${UNIT_TXT[k][1]}<br>Recruits appear from the ${classAge(d)}.`); });
  const relics = UNLOCKS.relics[1].filter((k) => price('relics', k)).map((k) => tile('relics', k, emo(ITEM_TXT[k][0]), ITEM_TXT[k][1], 'Boss relic', `${itemDesc(k)}<br>A slain boss may leave it among its relics.`));
  const abils = UNLOCKS.abilities[1].filter((k) => price('abilities', k)).map((k) => tile('abilities', k, emo(ABIL_TXT[k][0]), ABIL_TXT[k][1], 'Castle ability', ABIL_TXT[k][2]));
  const items = UNLOCKS.items[1].filter((k) => price('items', k)).map((k) => tile('items', k, emo(ITEM_TXT[k][0]), ITEM_TXT[k][1], `${RAR_TXT[L().items[k].r]} item`, itemDesc(k)));
  const sec = (title, tiles) => `<div class="mlabel">${title}</div><div class="tiles">${tiles.join('')}</div>`;
  return `<div class="hint big">${star}<b>${profile.renown}</b> renown to spend. <b>${have}</b> of ${all} unlocked.<br>Every run earns renown for waves cleared, seasons outlasted and ages reached, and more of it at higher siege levels. It only buys variety, never raw strength.</div>
    ${sec('Lords', lords)}${sec('Defender classes', classes)}${sec('Abilities', abils)}${sec('Relics', relics)}${sec('Items', items)}`;
}

function achHtml() {
  const got = ACH_KEYS.filter((k) => profile.ach[k]).length, t = profile.totals, sieges = L().siege;
  const deepest = Math.max(0, ...Object.values(profile.best).map((b) => b.wave || 0));
  const paths = Object.keys(L().paths).map((p) => `<span class="trait ${profile.paths.includes(p) ? 'spec' : 'off'}" ${tip(`<b>${PATH_TXT[p][1]}</b><br>${profile.paths.includes(p) ? 'Followed to its last age.' : 'Not yet followed to its last age.'}`)}>${PATH_TXT[p][0]} ${PATH_TXT[p][1]}</span>`).join('');
  // What a past run was: one that outlasted its first year, one that was given up, or one that fell before.
  const run = (r) => {
    const age = r.ageKey && AGE_TXT[r.ageKey] ? ageName(r.ageKey, Math.max(0, (r.age || 0) - L().lastAge)) : AGE_TXT[L().ages[Math.min(L().ages.length - 1, r.age || 0)].key][0];
    return `<div><b>${r.held || r.victory ? PIC.held : r.retired ? PIC.retired : PIC.fell} Wave ${r.wave}</b><span>${LORD_TXT[r.lord]?.[0] || ''}, ${siegeWords(r.siege | 0, sieges)}${r.daily ? ', daily run' : ''}, ${age}</span><em>${star}+${r.renown}</em></div>`;
  };
  return `${titleBar()}<div class="hint big"><b>${got}</b> of ${ACH_KEYS.length} achievements. ${plural(t.runs, 'run', 'runs')}, <b>${t.wins}</b> past the first year, the deepest to wave <b>${deepest}</b>.<br>${fmt(t.waves || 0)} waves cleared, ${fmt(t.kills)} monsters slain, ${Math.round(t.time / 60)} minutes of battle.<div class="perkList" style="justify-content:center">${paths}</div></div>
    <div class="tiles wide">${ACH_KEYS.map((k) => { const [icon, name, how, r] = ACH_TXT[k], on = profile.ach[k]; return `<div class="tile ach ${on ? 'own' : 'lockd'}"><span class="ti">${icon}</span><b>${name}</b><span>${how}</span><i class="lk">${on ? `${ICON.check}${on}` : `${star}${r}`}</i></div>`; }).join('')}</div>
    ${profile.runs.length ? `<div class="mlabel">Last runs</div><div class="runs">${profile.runs.map(run).join('')}</div>` : ''}`;
}

function codexHtml() {
  const [have, all] = codexProgress(), seen = (kind, k) => profile.codex[kind].includes(k);
  const unknown = `<div class="tile lockd"><span class="ti">${ICON.what}</span><b>???</b><span>Not met yet.</span></div>`;
  const mons = L().enemies.map((e, t) => {
    if (!seen('mon', e.key)) return unknown;
    const chips = Object.keys(CHIPS).filter((c) => e[c]).map((c) => CHIPS[c].toLowerCase()).join(', ');
    return `<div class="tile own"><img class="tp" src="${portrait('beast', t)}" alt=""><b>${MON[e.key][0]}</b><span>${MON[e.key][2]}</span><i class="lk">${ICON.hp}${e.hp}, speed ${e.speed}${chips ? `, ${chips}` : ''}</i></div>`;
  });
  const us = L().units.map((k) => {
    if (!seen('unit', k)) return unknown;
    const d = L().unitStats[k], sp = L().specs[k].map((x) => `<b>${SPEC_TXT[x.key][0]}</b>: ${SPEC_TXT[x.key][1]}`).join('<br>');
    return `<div class="tile own" ${tip(`At level ${L().specLevel}:<br>${sp}`)}><img class="tp" src="${portrait('unit', k)}" alt=""><b>${UNIT_TXT[k][0]}</b><span>${UNIT_TXT[k][1]}</span><i class="lk"><span class="fam fam-${d.fam}">${FAM_TXT[d.fam][0]}</span> ${classAge(d)}</i></div>`;
  });
  const its = CODEX.item.map((k) => (seen('item', k) ? `<div class="tile own" style="--rc:var(--r${L().items[k].r})"><span class="ti">${ITEM_TXT[k][0]}</span><b>${ITEM_TXT[k][1]}</b><span>${itemDesc(k)}</span><i class="lk" style="color:var(--rc)">${L().items[k].relic ? 'Boss relic' : RAR_TXT[L().items[k].r]}</i></div>` : unknown));
  const muts = CODEX.mut.map((k) => (seen('mut', k) ? `<div class="tile own" ${tip([1, 2, 3].map((l) => `<b>${roman(l)}</b> ${MUT_TXT[k][2](l)}`).join('<br>'))}><span class="ti">${MUT_TXT[k][0]}</span><b>${MUT_TXT[k][1]}</b><span>${MUT_TXT[k][2](1)}</span><i class="lk" style="color:#ffb0b3">Legacy of ${MON[L().enemies[L().bosses[L().mutations[k].from]].key][0].replace(/^The /, 'the ')}</i></div>` : unknown));
  const wx = CODEX.wx.map((k) => (seen('wx', k) ? `<div class="tile own"><span class="ti">${WEATHER_TXT[k][0]}</span><b>${WEATHER_TXT[k][1]}</b><span>${WEATHER_TXT[k][2]}</span></div>` : unknown));
  return `<div class="hint big"><b>${have}</b> of ${all} discovered. The codex fills in as you meet monsters, recruit defenders, find items, weather the seasons and watch the horde change.</div>
    <div class="mlabel">Monsters</div><div class="tiles wide">${mons.join('')}</div>
    <div class="mlabel">Mutations of the horde</div><div class="tiles wide">${muts.join('')}</div>
    <div class="mlabel">Weather</div><div class="tiles wide">${wx.join('')}</div>
    <div class="mlabel">Defenders</div><div class="tiles wide">${us.join('')}</div>
    <div class="mlabel">Items and relics</div><div class="tiles wide">${its.join('')}</div>`;
}

function settingsHtml() {
  const tog = (key, label, note = '') => `<label class="set"><span>${label}${note ? `<small>${note}</small>` : ''}</span><button class="btn ${prefs[key] ? '' : 'alt'}" data-set="${key}">${prefs[key] ? 'On' : 'Off'}</button></label>`;
  return `<div class="settings">
    <label class="set"><span>Volume</span><input type="range" min="0" max="100" value="${Math.round(prefs.volume * 100)}" data-vol></label>
    ${tog('music', 'Music')}${tog('sfx', 'Sound effects')}${tog('numbers', 'Damage numbers')}${tog('shake', 'Camera shake')}${tog('tips', 'Tips', 'Short hints the first time something comes up')}
    <label class="set"><span>Graphics<small>Fast turns shadows off and lowers the resolution</small></span><button class="btn alt" data-quality>${prefs.quality === 'low' ? 'Fast' : 'Pretty'}</button></label>
    <label class="set"><span>Show the tips again</span><button class="btn alt" data-retip>Reset tips</button></label>
    <label class="set"><span>Erase everything<small>Renown, unlocks, achievements, records and the saved run</small></span><button class="btn ${ask === 'reset' ? 'warn' : 'alt'}" data-reset>${ask === 'reset' ? 'Sure? This cannot be undone' : 'Reset progress'}</button></label>
    <div class="hint"><span class="kbd">WASD</span> or a right-drag moves the camera, the <span class="kbd">wheel</span> zooms, <span class="kbd">1</span> to <span class="kbd">6</span> choose, <span class="kbd">Space</span> pauses, <span class="kbd">Tab</span> turns the panels, <span class="kbd">Esc</span> opens the menu and <span class="kbd">M</span> stops the music.</div>
  </div>`;
}

function render() {
  if ($('overlay').hidden) return;
  const [have, all] = unlockProgress(), afford = Object.keys(UNLOCKS).some((kind) => UNLOCKS[kind][1].some((k) => !has(kind, k) && profile.renown >= price(kind, k)));
  const badge = { unlocks: afford ? '!' : `${have}/${all}`, ach: `${ACH_KEYS.filter((k) => profile.ach[k]).length}/${ACH_KEYS.length}`, codex: codexProgress().join('/') };
  const t = title();
  $('renown').innerHTML = `<span class="rank">${titleName(t.rank)}</span>${star}<b>${profile.renown}</b> renown`;
  $('renown').dataset.tip = `<b>${titleName(t.rank)}</b><br>${fmt(t.earned)} renown earned in all, ${fmt(t.next - t.earned)} more to ${titleName(t.rank + 1)}.<br>The title has no top and gives no power.`;
  $('mtabs').innerHTML = TABS.map(([k, name]) => `<button class="mtab ${k === tab ? 'on' : ''}" data-mtab="${k}">${name}${badge[k] ? `<i class="${badge[k] === '!' ? 'hot' : ''}">${badge[k]}</i>` : ''}</button>`).join('');
  const body = $('mbody'), y = body.scrollTop;
  body.innerHTML = tab === 'play' ? playHtml() : tab === 'unlocks' ? unlocksHtml() : tab === 'ach' ? achHtml() : tab === 'codex' ? codexHtml() : settingsHtml();
  body.scrollTop = y;
}

export function showMenu(message = '') {
  $('overlay').hidden = false;
  $('ovErr').textContent = message;
  ask = null; tab = 'play';
  render();
}

export function initMenu(h) {
  hooks = h;
  $('mtabs').onclick = (e) => { const b = e.target.closest('button'); if (b) { tab = b.dataset.mtab; ask = null; $('mbody').scrollTop = 0; render(); } };
  $('mbody').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const d = b.dataset;
    initAudio({ sfx: prefs.sfx, music: prefs.music, volume: prefs.volume });
    if (d.lord) { if (has('lords', d.lord)) { prefs.lord = d.lord; ask = null; saveProfile(); render(); } else tryUnlock('lords', d.lord); }
    else if (d.siege) { prefs.siege = Math.max(0, Math.min(profile.siege, prefs.siege + Number(d.siege))); saveProfile(); render(); }
    else if (d.abil) {
      if (!has('abilities', d.abil)) { tryUnlock('abilities', d.abil); return; }
      const a = prefs.abilities;
      // Three are taken: choosing a fourth swaps out the one chosen longest ago.
      if (a.includes(d.abil)) { if (a.length > 3) a.splice(a.indexOf(d.abil), 1); } else { a.push(d.abil); while (a.length > 3) a.shift(); }
      saveProfile(); render();
    } else if (d.unlock) { const [kind, key] = d.unlock.split(':'); if (!has(kind, key)) tryUnlock(kind, key); }
    else if (d.go === 'continue') hooks.startRun({ save: savedRun() });
    else if (d.go === 'new' || d.go === 'daily') {
      if (savedRun() && ask !== d.go) { ask = d.go; render(); return; }
      ask = null;
      setSavedRun(null);
      hooks.startRun(d.go === 'daily' ? { daily: dailyRun(today()) } : {});
    } else if (d.set) { prefs[d.set] = !prefs[d.set]; saveProfile(); hooks.applySettings(); render(); }
    else if (d.quality !== undefined) { prefs.quality = prefs.quality === 'low' ? 'high' : 'low'; saveProfile(); hooks.applySettings(); render(); }
    else if (d.retip !== undefined) { prefs.tipsSeen = []; prefs.tips = true; saveProfile(); render(); sfx('up'); }
    else if (d.reset !== undefined) { if (ask !== 'reset') { ask = 'reset'; render(); return; } ask = null; resetProfile(); hooks.applySettings(); render(); }
  };
  $('mbody').addEventListener('input', (e) => { if (e.target.dataset.vol !== undefined) { prefs.volume = Number(e.target.value) / 100; saveProfile(); hooks.applySettings(); } });
  render();
}
