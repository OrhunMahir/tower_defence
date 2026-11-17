// Everything on top of the 3D view during a run: status, wave cards, the right-hand panel,
// reward screens, abilities, tips and the keyboard.
import { S, send, $ } from './state.js';
import { portrait } from './models.js';
import { prefs, saveProfile, profile, title } from './profile.js';
import { sfx } from './audio.js';
import {
  esc, fmt, sign, plural, coin, star, MON, CHIPS, THEME_TXT, TIER_TXT, MOD_TXT, UNIT_TXT, FAM_TXT, TRAIT_TXT, SPEC_TXT, RAR_TXT, STAT_TXT, statLine, statTip,
  ITEM_TXT, TURRET_TXT, LORD_TXT, ABIL_TXT, siegeName, siegeWords, lowFirst, AGE_TXT, ageName, roman, PATH_TXT, PERK_TXT, SEASON_TXT, WEATHER_TXT, MUT_TXT, BOON_TXT, titleName,
  BUILD_TXT, DOC_TXT, EVENT_TXT, EVENT_OPT, ACH_TXT, ICON, PIC,
} from './text.js';

const L = () => S.layout;
const tip = (html) => `data-tip="${esc(html)}"`;
const rc = (r) => `--rc:var(--r${Math.min(5, r)})`;
const pct = (a, b) => `${Math.max(0, Math.min(100, (a / b) * 100))}%`;
const big = 'style="padding:10px 22px;font-size:14px"';

let toastTimer = 0;
// pic: a picture from text.js to go in front of the words (markup, so it is not escaped).
export function toast(text, small = '', ms = 1800, pic = '') {
  $('toast').innerHTML = `${pic ? `${pic} ` : ''}${esc(text)}${small ? `<small>${esc(small)}</small>` : ''}`; $('toast').style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').style.opacity = 0; }, ms);
}

// ---- What the panels remember between snapshots ----
let tab = 'shop', confirm = null, dialog = null, lastBoss = null, speedBefore = 1;
const sig = { abil: '', waves: '', panel: '', modal: '', status: '' };
let pickAt = 0, lastPick = '';
export function resetHud() {
  for (const k in sig) sig[k] = '';
  tab = 'shop'; confirm = null; dialog = null; lastBoss = null; tipNow = null;
  $('modal').hidden = true; $('advice').hidden = true;
}

const ageKey = (m) => m.ak;
const ageTitle = (m) => ageName(m.ak, Math.max(0, m.age - L().lastAge));
const nextBoss = (m) => ({ at: m.nb[0], key: L().enemies[m.nb[1]].key });
const ageReady = (m) => m.ph === 'prep' && m.ar && m.ar.boss && m.ar.level && m.ar.gold;
const sname = (m) => siegeName(m.sv, L().siege);
// A boss's name inside a sentence.
const the = (name) => name.replace(/^The /, 'the ');
// The title: a rank from all the renown ever earned, and how far the next one is.
export function titleBar() {
  const t = title();
  return `<div class="titlebar" ${tip('Your title grows with all the renown you have ever earned. It has no top and gives no power.')}><b>${titleName(t.rank)}</b><div class="bar"><i style="width:${Math.min(100, ((t.earned - t.from) / (t.next - t.from)) * 100)}%"></i></div><span>${fmt(t.next - t.earned)} renown to ${titleName(t.rank + 1)}</span></div>`;
}
// The best rarity the present age knows.
const rarCap = (m) => (m.age >= L().lastAge ? 5 : Math.min(m.age, L().ages.length - 1) + 1);
// The calendar: which season and year a wave falls in.
const seasonOf = (n) => L().seasons[Math.floor((Math.max(1, n) - 1) / L().seasonLen) % 4];
const yearOf = (n) => Math.floor((Math.max(1, n) - 1) / L().yearLen) + 1;
// The wave the panels are about: the one being fought, or the one that is coming.
const waveNow = (m) => (m.ph === 'wave' || m.ph === 'over' ? Math.max(1, m.wave) : m.wave + 1);
const seasonTip = (k) => `<b>${SEASON_TXT[k][0]} ${SEASON_TXT[k][1]}</b><br><span style="color:#9be0a8">${SEASON_TXT[k][2]}</span><br><span style="color:#ffb0b3">${SEASON_TXT[k][3]}</span>`;
const weatherChip = (w, label = '') => `<span class="chip wx ${w === 'clear' ? '' : 'on'}" ${tip(`<b>${WEATHER_TXT[w][1]}</b><br>${WEATHER_TXT[w][2]}`)}>${label}${WEATHER_TXT[w][0]} ${WEATHER_TXT[w][1]}</span>`;
const mutTip = (k, l) => `<b>${MUT_TXT[k][1]} ${roman(l)}</b><br>${MUT_TXT[k][2](l)}`;
// What a path age adds, for the Castle tab and the choice of a path.
const ageClasses = (path, age) => L().units.filter((k) => L().unitStats[k].path === path && L().unitStats[k].age === age + 1);
// Starts the next age: the fifth age first asks which path to follow.
function advance() { const m = S.snap; if (!m || !ageReady(m)) return; if (m.ar.choose) openDialog({ type: 'path' }); else send({ t: 'age' }); }
// What comes with a mutation.
function boonHtml(b) {
  if (b.k === 'gold') return `+${coin}${fmt(b.v)}`;
  if (b.k === 'level') return `${plural(b.v, 'castle level', 'castle levels')}: ${b.v > 1 ? 'two stat choices' : 'a stat choice'}`;
  if (b.k === 'item') return `${ITEM_TXT[b.key][0]} <b>${ITEM_TXT[b.key][1]}</b> (${itemDesc(b.key)})`;
  if (b.k === 'stat') return `<b>${statLine(b.stat, L().stats[b.stat][b.r])}</b> (${RAR_TXT[b.r].toLowerCase()})`;
  if (b.k === 'promote') return b.v > 1 ? 'Your two best defenders are promoted' : 'Your best defender is promoted';
  return 'One more relic to choose';
}

export function updateHud(m, boss, force = false) {
  if (force) { for (const k in sig) sig[k] = ''; boss = lastBoss; } else lastBoss = boss;
  if (m.ph === 'prep') {
    $('phase').textContent = `Wave ${m.wave + 1}`;
    $('sub').textContent = S.moving != null ? 'Click a place on the walls, or press Esc to cancel' : m.wave ? 'Prepare as long as you like' : 'Choose a wave to begin';
  } else if (m.ph === 'reward') {
    $('phase').textContent = m.wave && !(m.pick && (m.pick.type === 'muster' || m.pick.type === 'doctrine')) ? `Wave ${m.wave} cleared` : 'A new age';
    $('sub').textContent = 'Choose your rewards';
  } else if (m.ph === 'wave') {
    $('phase').textContent = `Wave ${m.wave}`;
    $('sub').textContent = `${plural(m.left, 'monster', 'monsters')} left`;
  } else {
    $('phase').textContent = m.sum && m.sum.retired ? 'The castle is given up' : 'The castle has fallen';
    $('sub').textContent = `Reached wave ${m.reached}`;
  }
  $('boss').hidden = !boss;
  if (boss) { $('bossBar').style.width = `${boss.hp}%`; $('bossTxt').textContent = `${boss.hp}%`; $('bossName').textContent = MON[L().enemies[boss.t].key][0]; }
  $('thBar').style.width = pct(m.th[0], m.th[1]);
  $('thTxt').textContent = `${fmt(m.th[0])} / ${fmt(m.th[1])}`;
  $('lvTxt').textContent = `Lv ${m.lv[0]}`;
  $('lvBar').style.width = `${m.lv[1]}%`;
  $('goldTxt').innerHTML = `${coin}${fmt(m.gold)}`;
  const st = JSON.stringify([m.un.length, m.cap, m.age, m.ak, m.b, m.lord, m.sv, m.daily, m.ph, m.wave, m.mod, m.ral, m.frz, m.bty, m.sig, m.lst, m.dk, m.now, m.wx, m.mu, ageReady(m), m.ar]);
  if (st !== sig.status) {
    sig.status = st;
    $('army').textContent = `${m.un.filter((u) => !(u[4] & 2)).length} / ${m.cap}`;
    $('ageName').textContent = `${ageTitle(m)}, ${lowFirst(AGE_TXT[ageKey(m)][1])}`;
    $('lordName').textContent = LORD_TXT[m.lord][0];
    $('siegeName').textContent = `${sname(m)}${m.daily ? ', daily run' : ''}`;
    const nb = nextBoss(m);
    $('bossNext').textContent = m.ph === 'over' ? '' : nb.at === m.wave + 1 && m.ph !== 'wave' ? `${MON[nb.key][0]} attacks next wave!` : `${MON[nb.key][0]} on wave ${nb.at}`;
    // The calendar: the season, and the weather of this wave and of the ones to come.
    const n = waveNow(m), sk = seasonOf(n), far = m.lord === 'seer' ? 3 : 2;
    let cal = `<span class="chip season ${sk}" ${tip(`${seasonTip(sk)}<br><span style="color:var(--dim)">A season lasts ${L().seasonLen} waves and ends with its boss.</span>`)}>${SEASON_TXT[sk][0]} ${SEASON_TXT[sk][1]}, year ${yearOf(n)}</span>`;
    if (m.ph === 'wave') cal += weatherChip(m.now) + (m.dk ? `<span class="chip on" ${tip('<b>Night</b><br>Your defenders see a fifth less far.')}>${PIC.night} Night</span>` : '');
    else if (m.ph !== 'over') cal += m.wx.slice(0, far).map((w, i) => weatherChip(w, i ? `<small>+${i}</small> ` : '<small>next</small> ')).join('');
    $('cal').innerHTML = cal;
    const muts = Object.entries(m.mu);
    $('muts').hidden = !muts.length;
    $('muts').innerHTML = muts.map(([k, l]) => `<span class="mut" ${tip(mutTip(k, l))}>${MUT_TXT[k][0]}${l > 1 ? `<i>${l}</i>` : ''}</span>`).join('');
    const fxs = [];
    if (m.ph === 'wave' && m.mod) fxs.push(`<span class="chip mod" ${tip(`<b>${MOD_TXT[m.mod][1]}</b><br>${MOD_TXT[m.mod][2]}`)}>${MOD_TXT[m.mod][0]} ${MOD_TXT[m.mod][1]}</span>`);
    if (m.ral) fxs.push(`<span class="chip on">${PIC.rally} Rally</span>`);
    if (m.frz) fxs.push(`<span class="chip on">${PIC.frozen} Frozen</span>`);
    if (m.bty) fxs.push(`<span class="chip on">${PIC.bounty} Bounty</span>`);
    if (m.sig) fxs.push(`<span class="chip on">${PIC.signal} Signal fire</span>`);
    if (m.lst) fxs.push(`<span class="chip on">${PIC.laststand} Last stand</span>`);
    $('nowFx').innerHTML = fxs.join('');
    $('nowFx').hidden = !fxs.length;
    const ready = ageReady(m);
    $('ageBtn').hidden = !ready;
    $('ageBtn').innerHTML = !ready ? '' : m.ar.choose ? `${ICON.up}Choose a path of ages ${coin}${fmt(m.ar.cost)}` : m.ar.asc ? `${ICON.up}Ascend ${coin}${fmt(m.ar.cost)}` : `${ICON.up}Advance to the ${AGE_TXT[m.ar.key][0]} ${coin}${fmt(m.ar.cost)}`;
  }
  for (const b of $('speed').querySelectorAll('[data-spd]')) b.classList.toggle('on', Number(b.dataset.spd) === m.spd);
  renderAbilities(m);
  renderWaves(m);
  renderPanel(m);
  renderModal(m);
  updateTips(m);
}

// ---- Abilities during a wave ----
function renderAbilities(m) {
  const show = m.ph === 'wave';
  const s = JSON.stringify([show, m.ab, S.aiming]);
  if (s === sig.abil) return;
  sig.abil = s;
  $('abilities').hidden = !show;
  if (!show) return;
  $('abilities').innerHTML = m.ab.map(([k, cd], i) => {
    const [icon, name, desc] = ABIL_TXT[k];
    return `<button class="abil ${S.aiming === k ? 'aim' : ''}" data-abil="${k}" ${cd ? 'disabled' : ''} ${tip(`<b>${name}</b><br>${desc}`)}><span class="ai">${icon}</span><span class="an">${name}</span>${cd ? `<span class="acd">${cd}</span>` : ''}<span class="kbd">${i + 1}</span></button>`;
  }).join('');
}
function useAbility(k) {
  const m = S.snap;
  if (!m || m.ph !== 'wave') return;
  const a = m.ab.find((x) => x[0] === k);
  if (!a || a[1]) return;
  if (L().abilities[k].r) { S.hooks.setAiming(S.aiming === k ? null : k); sig.abil = ''; renderAbilities(m); return; }
  send({ t: 'ability', k });
}

// ---- Wave choice ----
// champ: a number of champions of this kind. scale: a second boss comes at a share of its health.
function monLine(m, w, t, n, champ = 0, scale = 1) {
  const e = L().enemies[t], ns = m.ns ? m.ns[t] : [e.hp, e.dmg], hx = e.boss ? 1 : w.hx, mul = champ ? 5 : scale;
  const chips = Object.keys(CHIPS).filter((k) => e[k]).map((k) => `<span class="chip ${k === 'boss' ? 'boss' : ''}">${CHIPS[k]}</span>`).join('');
  const info = `<b>${MON[e.key][0]}</b><br>${MON[e.key][2]}<br><span style="color:var(--dim)">Speed ${e.speed}${e.armor ? `, armour ${e.armor}` : ''}</span>`;
  const count = champ ? (champ > 1 ? `${champ} champion` : 'Champion') : n, tag = champ ? '<span class="chip boss">×5</span>' : scale !== 1 ? `<span class="chip boss">twin at ${Math.round(scale * 100)}%</span>` : chips;
  return `<div class="mon" ${tip(info)}><img src="${portrait('beast', t)}" alt=""><div><b>${count}</b> ${n === 1 && champ < 2 ? MON[e.key][0] : MON[e.key][1]}${tag}<div class="ms">${ICON.hp}${fmt(ns[0] * hx * mul)} &nbsp;${ICON.dmg}${fmt(ns[1] * hx * (champ ? 2 : 1))}</div></div></div>`;
}
function renderWaves(m) {
  const show = m.ph === 'prep' && m.wv.length >= 2 && !dialog;
  const s = JSON.stringify([show, m.wv, m.wave, !!m.ns, m.wx, m.mu]);
  if (s === sig.waves) return;
  sig.waves = s;
  $('waves').hidden = !show;
  if (!show) return;
  $('waves').classList.toggle('three', m.wv.length > 2);
  const sk = seasonOf(m.wave + 1), wx = m.wx[0], escort = 2 * (m.mu.escort || 0);
  const day = `<span class="day" ${tip(seasonTip(sk))}>${SEASON_TXT[sk][0]} ${SEASON_TXT[sk][1]}</span>${wx !== 'clear' ? ` <span class="day wx" ${tip(`<b>${WEATHER_TXT[wx][1]}</b><br>${WEATHER_TXT[wx][2]}`)}>${WEATHER_TXT[wx][0]} ${WEATHER_TXT[wx][1]}: ${WEATHER_TXT[wx][2]}</span>` : ''}`;
  $('waves').innerHTML = `<h3>Choose wave ${m.wave + 1}</h3><div class="dayline">${day}</div><div class="cards">${m.wv.map((w, i) => {
    const boss = w.c.some((n, t) => n && L().enemies[t].boss);
    const mons = w.c.map((n, t) => (n ? monLine(m, w, t, n) : '')).join('') + (w.twin >= 0 ? monLine(m, w, w.twin, 1, 0, 0.25 + 0.25 * (m.mu.twin || 0)) : '')
      + (boss && escort ? monLine({ ...m, ns: m.ns && m.ns.map((x, t) => (t === 1 ? [x[0] * 2, x[1] * 2] : x)) }, { ...w, hx: 1 }, 1, escort) : '') + (w.champ >= 0 ? monLine(m, w, w.champ, 1, w.champs || 1) : '');
    const mod = (w.mod ? `<div class="modline" ${tip(`<b>${MOD_TXT[w.mod][1]}</b><br>${MOD_TXT[w.mod][2]}<br>A wave with a modifier pays a quarter more.`)}>${MOD_TXT[w.mod][0]} <b>${MOD_TXT[w.mod][1]}.</b> ${MOD_TXT[w.mod][2]}</div>` : '')
      + (w.night && w.mod !== 'night' ? `<div class="modline" ${tip('<b>Night raid</b><br>A mutation of the horde. This wave is fought at night.')}>${PIC.night} <b>Night raid.</b> Your defenders see a fifth less far.</div>` : '');
    const elite = w.hx > 1.01 && w.mod !== 'giants' ? `<div class="ms" style="color:#ffb0b3">Elite pack: fewer, tougher monsters (×${w.hx})</div>` : '';
    return `<button class="wcard ${w.tier}" data-wave="${i}"><div class="hd"><span class="th">${THEME_TXT[w.th] || ''}</span><span class="tag" ${tip(TIER_TXT[w.tier][1])}>${TIER_TXT[w.tier][0]}</span></div>${mons}${mod}${elite}<div class="gold"><span>${coin}${fmt(w.gold)}</span><span class="xpv">${ICON.xp}${fmt(w.xp)} xp</span>${w.luck ? `<span class="luck">${PIC.luck} +${w.luck}</span>` : ''}<span class="kbd">${i + 1}</span></div></button>`;
  }).join('')}</div>`;
}

// ---- Cards shared by the shop and the rewards ----
const traitChips = (ts) => ts.map((t) => { const k = typeof t === 'number' ? L().traits[t] : t; return `<span class="trait" ${tip(`<b>${TRAIT_TXT[k][0]}</b><br>${TRAIT_TXT[k][1]}`)}>${TRAIT_TXT[k][0]}</span>`; }).join('');
export function itemDesc(key) {
  const d = L().items[key], parts = Object.entries(d.mods || {}).map(([s, v]) => statLine(s, v));
  if (ITEM_TXT[key][2]) parts.push(ITEM_TXT[key][2]);
  return parts.join(', ') + (d.unique && !d.relic ? ' (one per run)' : '');
}
// What a defender does, in numbers. p is their power, as the rules count it for their class.
function unitStatsHtml(k, p, cd, range) {
  const d = L().unitStats[k];
  if (d.aura) return `<div class="stats one"><span><small>Song</small>+${Math.round(p * 100)}% attack speed nearby</span></div>`;
  if (d.guard) return `<div class="stats one"><span><small>Guard</small>−${Math.round(Math.min(0.7, p) * 100)}% damage to their wall</span></div>`;
  if (d.curse) return `<div class="stats one"><span><small>Curse</small>+${Math.round(Math.min(1, p) * 100)}% damage taken</span></div>`;
  if (d.tinker) return `<div class="stats one"><span><small>Tinkering</small>turrets fire ${Math.round(p * 100)}% faster</span></div>`;
  if (d.empower) return `<div class="stats one"><span><small>Runes</small>+${Math.round(p * 100)}% damage for defenders nearby</span></div>`;
  if (d.fate) return `<div class="stats one"><span><small>Fate</small>the next ${Math.max(1, Math.round(p))} hits on a monster are critical</span></div>`;
  return `<div class="stats"><span><small>${d.heal ? 'Heal' : d.mine ? 'Mine' : 'Damage'}</small>${d.heal ? ICON.heal : ICON.dmg}${fmt(p)}</span><span><small>Reload</small>${ICON.spd}${cd.toFixed(1)}s</span><span><small>Range</small>${ICON.rng}${d.heal === 'keep' ? '∞' : d.mine ? 'wall' : Math.round(range)}</span></div>`;
}
function recruitCard(c, footer, label = 'recruit') {
  const fam = L().unitStats[c.k].fam;
  return `<div class="card r${c.rar}" style="${rc(c.rar)}"><div class="top"><img class="pic" src="${portrait('unit', c.k, c.rar)}" alt=""><div><span class="rar">${RAR_TXT[c.rar]} ${label}</span><div class="nm">${esc(c.name)}</div><div class="cl"><span class="lv">${c.lv}</span>${UNIT_TXT[c.k][0]} <span class="fam fam-${fam}">${FAM_TXT[fam][0]}</span></div></div></div>${unitStatsHtml(c.k, c.p * (1 + 0.12 * (c.lv - 1)), c.cd, c.range)}<div class="traits">${traitChips(c.traits)}</div><div class="desc">${UNIT_TXT[c.k][1]}</div>${footer}</div>`;
}
function optionCard(o, footer) {
  // On full walls a recruit takes the post of the weakest defender, and the card says whose.
  if (o.type === 'recruit') return recruitCard(o.card, (o.swap ? `<div class="swap">${ICON.swap}Takes the post of <b>${esc(o.out.name)}</b>, ${RAR_TXT[o.out.rar].toLowerCase()} ${UNIT_TXT[o.out.k][0].toLowerCase()} Lv ${o.out.lv}</div>` : '') + footer, o.swap ? 'replacement' : 'recruit');
  if (o.type === 'promote') {
    const cap = rarCap(S.snap), top = Math.min(cap, o.rar + 1);
    return `<div class="card r${top}" style="${rc(top)}"><div class="top"><img class="pic" src="${portrait('unit', o.k, o.rar)}" alt=""><div><span class="rar">Promotion</span><div class="nm">${esc(o.name)}</div><div class="cl"><span class="lv">${o.lv}</span>${UNIT_TXT[o.k][0]}</div></div></div><div class="desc big">${o.rar < cap ? `${RAR_TXT[o.rar]} → <b>${RAR_TXT[top]}</b>` : `<b>Three levels</b>, because this age knows no rank above ${RAR_TXT[cap].toLowerCase()}`}.<br>The walls are full, so a veteran grows stronger instead.</div>${footer}</div>`;
  }
  if (o.type === 'item') {
    const d = L().items[o.key];
    return `<div class="card r${d.r}" style="${rc(d.r)}"><div class="top"><div class="pic emo">${ITEM_TXT[o.key][0]}</div><div><span class="rar">${d.relic ? 'Boss relic' : `${RAR_TXT[d.r]} item`}</span><div class="nm">${ITEM_TXT[o.key][1]}</div></div></div><div class="desc big" ${d.mods ? tip(statTip(Object.keys(d.mods))) : ''}>${itemDesc(o.key)}</div>${footer}</div>`;
  }
  if (o.type === 'turret') {
    const d = L().turrets[o.k], lv = o.lv || 1;
    return `<div class="card r1" style="${rc(1)}"><div class="top"><div class="pic emo">${TURRET_TXT[o.k][2]}</div><div><span class="rar">Turret${lv > 1 ? `, level ${lv}` : ''}</span><div class="nm">${TURRET_TXT[o.k][0]}</div></div></div><div class="stats"><span><small>Damage</small>${ICON.dmg}${fmt(d.p * (1 + 0.5 * (lv - 1)))}</span><span><small>Reload</small>${ICON.spd}${d.cd}s</span><span><small>Range</small>${ICON.rng}${d.range}</span></div><div class="desc">${TURRET_TXT[o.k][1]} ${lv > 1 ? 'Upgrades the one you have.' : 'Built in the courtyard.'}</div>${footer}</div>`;
  }
  if (o.type === 'bless') {
    const r = Math.min(3, o.v);
    return `<div class="card r${r}" style="${rc(r)}"><div class="top"><img class="pic" src="${portrait('unit', o.k, 0)}" alt=""><div><span class="rar">Blessing</span><div class="nm">${UNIT_TXT[o.k][0]}s</div></div></div><div class="desc big">Every ${UNIT_TXT[o.k][0].toLowerCase()} gets <b>+${20 * o.v}%</b> power, now and later.</div>${footer}</div>`;
  }
  return '';
}

// ---- The right-hand panel: shop, army, castle, yard, stats ----
const TABS = [['shop', 'Shop'], ['army', 'Army'], ['castle', 'Castle'], ['yard', 'Yard'], ['stats', 'Stats'], ['horde', 'Horde']];
function shopHtml(m) {
  let h = `<div class="sec"><span>Items and turrets. <b>Lock</b> an offer to keep it.</span><button class="btn alt" data-reroll ${m.gold < m.rr ? 'disabled' : ''}>${m.rr ? `Reroll ${coin}${fmt(m.rr)}` : 'Reroll for free'}</button></div><div class="cards2">`;
  m.shop.forEach((o, i) => {
    if (!o) { h += '<div class="card gone">Sold</div>'; return; }
    const lv = o.type === 'turret' ? (m.tu.find((t) => L().turretKeys[t[0]] === o.k)?.[2] || 0) + 1 : 0;
    const full = o.type === 'turret' && lv === 1 && m.tu.length >= m.yard.spots;
    h += optionCard({ ...o, lv }, `<div class="row2"><button class="btn" data-buy="${i}" ${m.gold < o.price || full ? 'disabled' : ''}>${full ? 'No free spot' : `Buy ${coin}${fmt(o.price)}`}</button><button class="btn ${o.locked ? '' : 'alt'} lockb" data-lock="${i}" ${tip(o.locked ? 'Locked. It stays in the shop until you buy it or unlock it.' : 'Lock to keep it for later')}>${ICON.lock}</button></div>`);
  });
  return `${h}</div>`;
}

function famHtml(m) {
  return `<div class="fams">${L().families.map((f, i) => {
    const n = m.fam[0][i], t = m.fam[1][i];
    const pips = L().familyAt.map((need) => `<i class="${n >= need ? 'on' : ''}"></i>`).join('');
    return `<div class="famrow fam-${f} ${t ? 'act' : ''}" ${tip(`<b>${FAM_TXT[f][0]}</b>, at ${L().familyAt.join(', ')} defenders<br>${FAM_TXT[f][1]}`)}><b>${FAM_TXT[f][0]}</b><span>${n}</span><div class="pips">${pips}</div></div>`;
  }).join('')}</div>`;
}

function armyHtml(m) {
  const own = m.ro.filter((r) => !r[17]);
  let h = famHtml(m) + `<div class="sec"><span><b>${own.length}</b> of ${m.cap} places taken</span><span>Click a defender on the wall to move them</span></div>`;
  const ro = [...m.ro].sort((a, b) => a[17] - b[17] || b[3] - a[3] || b[2] - a[2]);
  for (const [uid, ki, rar, lv, xp, name, p, cd, range, kills, tc, refund, traits, crit, slot, spec, canSpec, temp] of ro) {
    const k = L().units[ki], d = L().unitStats[k], sure = confirm === `u${uid}`, moving = S.moving === uid;
    const main = d.aura ? `+${Math.round(p * 100)}% speed` : d.guard ? `−${Math.round(Math.min(0.7, p) * 100)}% damage` : d.curse ? `+${Math.round(Math.min(1, p) * 100)}% curse` : d.tinker ? `+${Math.round(p * 100)}% turret speed`
      : d.empower ? `+${Math.round(p * 100)}% damage nearby` : d.fate ? `${Math.max(1, Math.round(p))} fated hits` : `${d.heal ? ICON.heal : ICON.dmg}${fmt(p)}`;
    const extra = d.aura || d.guard || d.curse || d.tinker || d.empower || d.fate ? '' : `<span>${ICON.spd}${cd.toFixed(1)}s</span>${d.mine ? '' : `<span>${ICON.rng}${d.heal === 'keep' ? '∞' : Math.round(range)}</span>`}${crit > 0 && !d.heal && !d.mine ? `<span>${Math.round(crit * 100)}% crit</span>` : ''}`;
    const sp = spec ? L().specs[k][spec - 1].key : null;
    const path = sp ? `<span class="trait spec" ${tip(`<b>${SPEC_TXT[sp][0]}</b><br>${SPEC_TXT[sp][1]}`)}>${SPEC_TXT[sp][0]}</span>` : '';
    const where = slot < L().towers.length ? `<span class="trait" ${tip('Standing in a tower: +15% range.')}>Tower</span>` : '';
    const btns = temp ? '<span class="desc">Hired for<br>this wave</span>'
      : `${canSpec ? `<button class="btn glow" data-spec="${uid}">Choose a path</button>` : ''}<button class="btn" data-train="${uid}" ${m.gold < tc || m.ph !== 'prep' ? 'disabled' : ''}>Train ${coin}${fmt(tc)}</button><div class="row2"><button class="btn ${moving ? '' : 'alt'}" data-move="${uid}" ${m.ph !== 'prep' ? 'disabled' : ''} ${tip('Move to another place on the walls. Towers give +15% range.')}>${ICON.move}</button><button class="btn ${sure ? 'warn' : 'alt'}" data-dismiss="${uid}" ${m.ph !== 'prep' ? 'disabled' : ''}>${sure ? `Sure? +${fmt(refund)}` : 'Dismiss'}</button></div>`;
    h += `<div class="unit ${moving ? 'sel' : ''}" data-uid="${uid}" style="${rc(rar)}"><img class="pic" src="${portrait('unit', k, rar)}" alt=""><div><div class="nm"><span class="lv">${lv}</span>${esc(name)} <i>${UNIT_TXT[k][0]}</i></div><div class="meta"><span>${main}</span>${extra}<span>${ICON.kill}${fmt(kills)}</span></div><div class="traits" style="margin-top:3px;min-height:0">${path}${where}${traitChips(traits)}</div><div class="xp"><i style="width:${xp}%"></i></div></div><div class="btns">${btns}</div></div>`;
  }
  return h;
}

function ageHtml(m) {
  const ar = m.ar, nb = MON[L().enemies[ar.bt].key][0];
  const req = (ok, text) => `<div class="req ${ok ? 'ok' : ''}">${ok ? ICON.check : ICON.ring}${text}</div>`;
  const ready = ar.boss && ar.level && ar.gold;
  const caps = `castle levels up to ${L().ageCap * (ar.next + 1)}, buildings up to level ${ar.next + 2}`;
  let name, gain, label;
  if (ar.choose) {
    name = 'a path of ages';
    gain = `Beyond the Golden Age the castle follows <b>one of three paths</b>. Each has three ages with their own walls, a lasting power and two new classes. The other two are closed for this run.<div class="pathrow">${Object.keys(L().paths).map((p) => `<span class="trait" ${tip(`<b>${PATH_TXT[p][1]}</b><br>${PATH_TXT[p][2]}<br>${L().paths[p].ages.map((k) => AGE_TXT[k][0]).join(' → ')}`)}>${PATH_TXT[p][0]} ${PATH_TXT[p][1]}</span>`).join('')}</div>`;
    label = `Choose a path ${coin}${fmt(ar.cost)}`;
  } else if (ar.asc) {
    name = ageName(ar.key, ar.asc);
    gain = `<b>An ascension.</b> +10% damage and wall HP, two legendary stat choices, a doctrine while any are left, ${caps}. There is no last one.`;
    label = `Ascend ${coin}${fmt(ar.cost)}`;
  } else if (ar.next >= L().ages.length) {
    name = AGE_TXT[ar.key][0];
    const cls = ageClasses(m.path, ar.next).map((k) => `<span ${tip(`<b>${UNIT_TXT[k][0]}</b> (${FAM_TXT[L().unitStats[k].fam][0]})<br>${UNIT_TXT[k][1]}`)}>${UNIT_TXT[k][0]}</span>`).join(' and ');
    gain = `<b>${AGE_TXT[ar.key][1]}</b>. <b>${PERK_TXT[ar.key][0]}:</b> ${PERK_TXT[ar.key][1]}<br>New recruits: ${cls} (one joins at once). +10% damage and wall HP, a doctrine, ${caps}${ar.next === L().lastAge ? ', exalted recruits' : ''}.`;
    label = `Advance to the ${name} ${coin}${fmt(ar.cost)}`;
  } else {
    const nt = AGE_TXT[ar.key];
    name = nt[0];
    const news = [
      L().units.filter((k) => !L().unitStats[k].path && L().unitStats[k].age === ar.next + 1).map((k) => UNIT_TXT[k][0]).join(', '),
      L().buildingKeys.filter((k) => L().buildings[k].age === ar.next + 1).map((k) => BUILD_TXT[k][1]).join(', '),
      L().turretKeys.filter((k) => L().turrets[k].age === ar.next + 1).map((k) => TURRET_TXT[k][0]).join(', '),
    ];
    gain = `<b>${nt[1]}</b>, +10% damage and wall HP, a doctrine, ${RAR_TXT[Math.min(4, ar.next + 1)].toLowerCase()} recruits, castle levels up to ${L().ageCap * (ar.next + 1)}.`
      + (news[0] ? `<br>New recruits: ${news[0]}.` : '') + (news[1] ? `<br>New buildings: ${news[1]}.` : '') + (news[2] ? `<br>New turrets: ${news[2]}.` : '');
    label = `Advance to the ${name} ${coin}${fmt(ar.cost)}`;
  }
  // The powers of the path that are already at work.
  const powers = m.path ? L().paths[m.path].ages.slice(0, Math.min(3, m.age - L().ages.length + 1)) : [];
  const now = powers.length ? `<div class="perkList" style="margin-bottom:6px">${powers.map((k) => `<span class="trait spec" ${tip(`<b>${PERK_TXT[k][0]}</b> (${AGE_TXT[k][0]})<br>${PERK_TXT[k][1]}`)}>${PERK_TXT[k][0]}</span>`).join('')}</div>` : '';
  return `<div class="agebox ${ready ? 'ready' : ''}"><div class="agehd"><b>${ageTitle(m)}</b><span>→ ${name}</span></div>${now}
    ${req(ar.boss, `${nb} slain (wave ${ar.wave})`)}${req(ar.level, `Castle level ${ar.needLevel} <i>(now ${m.lv[0]})</i>`)}${req(ar.gold, `${fmt(ar.cost)} gold`)}
    <div class="desc" style="margin:6px 0">${gain}</div>
    <button class="btn ${ready ? 'glow' : ''}" data-age ${ready && m.ph === 'prep' ? '' : 'disabled'} style="width:100%">${ready ? label : !ar.boss ? `Slay ${the(nb)} first` : !ar.level ? `Needs castle level ${ar.needLevel}` : `Needs ${fmt(ar.cost)} gold`}</button></div>`;
}

function castleHtml(m) {
  let h = ageHtml(m);
  [['hall', 'Keep', '+700 keep HP. The walls cannot be taller than the keep.'], ['walls', 'Walls', '+50% wall HP and room for more defenders.']].forEach(([k, name, desc], i) => {
    const l = m.b[i], max = Math.min(L().castle[k].max, m.yard.ccap), cost = m.bc[i];
    let label = `Upgrade ${coin}${fmt(cost)}`, off = m.gold < cost;
    if (cost === -1) { label = 'Max level'; off = true; } else if (cost === -2) { label = 'Needs the next age'; off = true; } else if (k !== 'hall' && l >= m.b[0]) { label = `Needs keep Lv ${l + 1}`; off = true; }
    // Past level 20 the row of pips would not fit: it shows the levels of this age only.
    const from = max > 20 ? max - 5 : 0;
    const pips = Array.from({ length: max - from }, (_, j) => `<i class="${j + from < l ? 'on' : ''}"></i>`).join('');
    h += `<div class="row"><div><b>${name}<i>Lv ${l} of ${max}</i></b><span>${desc}</span><div class="pips">${pips}</div></div><button class="btn" data-up="${k}" ${off || m.ph !== 'prep' ? 'disabled' : ''}>${label}</button></div>`;
  });
  h += `<div class="row"><div><b>Repair walls</b><span>${m.yard.free}% of the damage is mended for free after every wave.</span></div><button class="btn" data-repair="walls" ${m.gold && m.rc[0] && m.ph === 'prep' ? '' : 'disabled'}>${m.rc[0] ? `${coin}${fmt(m.rc[0])}` : 'Intact'}</button></div>`;
  h += `<div class="row"><div><b>Repair keep</b><span>${m.rc[1] ? `${fmt(m.th[1] - m.th[0])} HP missing.` : 'Unharmed.'}</span></div><button class="btn" data-repair="hall" ${m.gold && m.rc[1] && m.ph === 'prep' ? '' : 'disabled'}>${m.rc[1] ? `${coin}${fmt(m.rc[1])}` : 'Intact'}</button></div>`;
  h += `<div class="row" style="display:block"><b>Turrets <i>${m.tu.length} / ${m.yard.spots} spots</i></b>`;
  h += m.tu.length ? `<div class="perkList">${m.tu.map(([ki, , lv], i) => { const k = L().turretKeys[ki]; return `<span class="trait" ${tip(`<b>${TURRET_TXT[k][0]}</b>, level ${lv}<br>${TURRET_TXT[k][1]}<br>Damage ${fmt(m.tp[i])}`)}>${TURRET_TXT[k][0]}, level ${lv}</span>`; }).join('')}</div>` : '<span>Found in the shop and among the spoils. Another copy raises the level. A workshop opens more spots.</span>';
  return `${h}</div>`;
}

function yardHtml(m) {
  const y = m.yard, lvNeed = L().buildLevelReq;
  let h = `<div class="sec"><span><b>${m.pl.filter(Boolean).length}</b> of ${y.plots} plots built. Buildings go up to level ${y.cap} in this age.</span></div>`;
  m.pl.forEach((b, i) => {
    if (i >= y.plots) return;
    if (!b) {
      const can = m.lv[0] >= lvNeed[1];
      h += `<div class="row"><div><b>Empty plot</b><span>${can ? 'Raise a building here. Each kind can be built once.' : `The first building needs castle level ${lvNeed[1]}.`}</span></div><button class="btn" data-plot="${i}" ${can && m.ph === 'prep' ? '' : 'disabled'}>Build…</button></div>`;
      return;
    }
    const [ki, lv] = b, k = L().buildingKeys[ki], [icon, name, desc] = BUILD_TXT[k], up = y.up[i], sure = confirm === `p${i}`;
    let label, off = true;
    if (lv >= y.cap) label = 'Needs the next age';
    else if (m.lv[0] < up[1]) label = `Needs castle Lv ${up[1]}`;
    else { label = `Upgrade ${coin}${fmt(up[0])}`; off = m.gold < up[0]; }
    const from = Math.max(0, y.cap - 10);
    const pips = Array.from({ length: y.cap - from }, (_, j) => `<i class="${j + from < lv ? 'on' : ''}"></i>`).join('');
    h += `<div class="row"><div><b>${icon} ${name}<i>Lv ${lv}</i></b><span>${desc}</span><div class="pips">${pips}</div></div><div class="btns"><button class="btn" data-upbuild="${i}" ${off || m.ph !== 'prep' ? 'disabled' : ''}>${label}</button><button class="btn ${sure ? 'warn' : 'alt'}" data-demolish="${i}" ${m.ph !== 'prep' ? 'disabled' : ''}>${sure ? 'Sure? Half back' : 'Demolish'}</button></div></div>`;
  });
  const later = L().plotsByAge.findIndex((n) => n > y.plots);
  if (later > 0) h += `<div class="sec" style="margin-top:8px"><span>More plots open in the ${AGE_TXT[L().ages[later].key][0]}.</span></div>`;
  return h;
}

function statsHtml(m) {
  let h = `<div class="statgrid">${Object.keys(STAT_TXT).map((k) => {
    const v = Math.round(m.tot[k] * 10) / 10;
    return `<div class="stat ${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}" ${tip(`<b>${STAT_TXT[k][0]}</b><br>${STAT_TXT[k][2]}`)}><span>${STAT_TXT[k][0]}</span><b>${sign(v)}${STAT_TXT[k][1]}</b></div>`;
  }).join('')}</div><div class="sec" style="margin-top:10px"><span>Harvesting pays <b>${coin}${fmt(m.hv)}</b> after the next wave</span></div>`;
  if (m.dc.length) h += `<div class="row" style="display:block"><b>Doctrines</b><div class="perkList">${m.dc.map((k) => `<span class="trait" ${tip(`<b>${DOC_TXT[k][1]}</b><br>${DOC_TXT[k][2]}`)}>${DOC_TXT[k][0]} ${DOC_TXT[k][1]}</span>`).join('')}</div></div>`;
  const items = Object.entries(m.items);
  h += `<div class="row" style="display:block"><b>Items <i>${items.reduce((a, [, n]) => a + n, 0)}</i></b>${items.length ? `<div class="items">${items.map(([k, n]) => `<span class="item r${L().items[k].r}" style="${rc(L().items[k].r)}" ${tip(`<b>${ITEM_TXT[k][1]}</b>${n > 1 ? ` ×${n}` : ''}<br>${itemDesc(k)}`)}>${ITEM_TXT[k][0]}${n > 1 ? `<i>${n}</i>` : ''}</span>`).join('')}</div>` : '<span>None yet. Buy them in the shop or find them among the spoils.</span>'}</div>`;
  const bl = Object.entries(m.bless).filter(([, v]) => v);
  if (bl.length) h += `<div class="row" style="display:block"><b>Blessings</b><div class="perkList">${bl.map(([k, v]) => `<span class="trait">${UNIT_TXT[k][0]}s +${20 * v}%</span>`).join('')}</div></div>`;
  h += `<div class="row" style="display:block"><b>This run</b><span>${fmt(m.st[0])} monsters slain, ${fmt(m.st[1])} gold earned, ${m.st[2]} bosses felled</span></div>`;
  return h;
}

// The horde: the calendar, its mutations and what it has learnt to resist.
function hordeHtml(m) {
  const n = m.wave + 1, sk = seasonOf(n), left = L().seasonLen - ((n - 1) % L().seasonLen), nb = nextBoss(m);
  let h = `<div class="row" style="display:block"><b>${SEASON_TXT[sk][0]} ${SEASON_TXT[sk][1]} <i>year ${yearOf(n)}, wave ${n}</i></b><span style="color:#9be0a8">${SEASON_TXT[sk][2]}</span><br><span style="color:#ffb0b3">${SEASON_TXT[sk][3]}</span><br><span>${MON[nb.key][0]} ends the season ${left > 1 ? `in ${left} waves` : 'with the next wave'}.</span></div>`;
  h += `<div class="row" style="display:block"><b>Weather</b>${m.wx.slice(0, m.lord === 'seer' ? 3 : 2).map((w, i) => `<div class="wxrow"><span>${i ? `In ${i + 1} waves` : 'Next wave'}</span><b>${WEATHER_TXT[w][0]} ${WEATHER_TXT[w][1]}</b><span>${WEATHER_TXT[w][2]}</span></div>`).join('')}</div>`;
  const muts = Object.entries(m.mu);
  h += `<div class="row" style="display:block"><b>Mutations <i>${muts.reduce((a, [, l]) => a + l, 0)}</i></b>${muts.length ? muts.map(([k, l]) => `<div class="mutrow"><span class="pi">${MUT_TXT[k][0]}</span><div><b>${MUT_TXT[k][1]} ${roman(l)}</b><span>${MUT_TXT[k][2](l)}</span></div></div>`).join('') : '<span>None yet. Every boss leaves the horde one new trait, and you choose which.</span>'}</div>`;
  const total = m.ds.reduce((a, b) => a + b, 0), from = L().adapt.from;
  h += `<div class="row" style="display:block"><b>Adaptation</b><span>After every boss${m.st[2] < from ? ` (from the ${from === 2 ? 'second' : `${from}th`} on)` : ''} the horde resists the family that hurt it most this season ${L().adapt.gain}% more, up to ${L().adapt.cap}%, and forgets ${L().adapt.fade}% of what it knew of the others. A family it has forgotten hits harder.</span>
    <div class="adapt">${L().families.map((f, i) => {
    const a = m.ad[i], share = total ? Math.round((m.ds[i] / total) * 100) : 0;
    const txt = a > 0 ? `resists ${a}%` : a < 0 ? `weak: +${-a}%` : 'no resistance';
    return `<div class="adrow fam-${f}" ${tip(`<b>${FAM_TXT[f][0]}</b><br>${a > 0 ? `The horde takes ${a}% less damage from them.` : a < 0 ? `The horde takes ${-a}% more damage from them.` : 'The horde has learnt nothing about them.'}<br>${share}% of this season's damage so far.`)}><b>${FAM_TXT[f][0]}</b><span class="${a > 0 ? 'neg' : a < 0 ? 'pos' : ''}">${txt}</span><div class="bar"><i style="width:${share}%"></i></div><em>${share}%</em></div>`;
  }).join('')}</div></div>`;
  return h;
}

function renderPanel(m) {
  const show = m.ph === 'prep';
  const s = JSON.stringify([show, tab, confirm, S.moving, m.b, m.bc, m.rc, m.gold, m.un.length, m.cap, m.shop, m.rr, m.ro, m.tot, m.items, m.tu, m.fam, m.pl, m.yard, m.ar, m.dc, m.lv[0], m.mu, m.ad, m.wx, m.path]);
  if (s === sig.panel) return;
  sig.panel = s;
  $('shop').hidden = !show;
  if (!show) return;
  const badge = { shop: m.shop.filter(Boolean).length, army: m.ro.some((r) => r[16]) ? '!' : m.un.length, castle: ageReady(m) ? '!' : '', yard: `${m.pl.filter(Boolean).length}/${m.yard.plots}`, stats: '', horde: Object.values(m.mu).reduce((a, b) => a + b, 0) || '' };
  $('tabs').innerHTML = TABS.map(([k, name]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${name}${badge[k] !== '' ? `<i class="${badge[k] === '!' ? 'hot' : ''}">${badge[k]}</i>` : ''}</button>`).join('');
  const body = $('tabBody'), y = body.scrollTop;
  body.innerHTML = tab === 'shop' ? shopHtml(m) : tab === 'army' ? armyHtml(m) : tab === 'castle' ? castleHtml(m) : tab === 'yard' ? yardHtml(m) : tab === 'horde' ? hordeHtml(m) : statsHtml(m);
  body.scrollTop = y;
}
function setTab(k) { tab = k; confirm = null; $('tabBody').scrollTop = 0; if (S.snap) { sig.panel = ''; renderPanel(S.snap); } }

// ---- Modals: rewards, events, dialogs, the choice of a path and the end of a run ----
function eventOption(o, m) {
  const g = o.gold ? ` for ${coin}${fmt(o.gold)}` : '';
  const d = {
    buy: () => `<b>${ITEM_TXT[o.item][0]} ${ITEM_TXT[o.item][1]}</b> at half price${g}<br><span class="desc">${itemDesc(o.item)}</span>`,
    toll: () => `+${coin}${fmt(o.gain)}`,
    take: () => `<b>${esc(o.card.name)}</b>, a ${RAR_TXT[o.card.rar].toLowerCase()} ${UNIT_TXT[o.card.k][0].toLowerCase()} of level ${o.card.lv}, joins for free`,
    refuse: () => `+${fmt(o.xp)} castle experience`,
    pay: () => `Nobody is hurt${g}`,
    endure: () => `The keep loses ${fmt(o.hp)} HP`,
    hone: () => `<b>${esc(o.name)}</b> the ${UNIT_TXT[o.unit][0].toLowerCase()} gains three levels${g}`,
    drill: () => `Every defender gains a level${g}`,
    pass: () => 'Nothing happens',
    offer: () => `<b>${statLine(o.stat, L().stats[o.stat][o.r])}</b> (${RAR_TXT[o.r].toLowerCase()})${g}`,
    pray: () => 'Free. If the prayer is heard, one of your classes is blessed (+20% power)',
    bet: () => `Stake ${coin}${fmt(o.gold)}: win it again, or lose it`,
    shelter: () => `One more place on the walls, for good${g}`,
    away: () => `+${coin}${fmt(o.gain)}`,
    keep: () => `It hatches after wave ${o.wave} into a legendary item`,
    sell: () => `+${coin}${fmt(o.gain)}`,
    hire: () => `Two epic sellswords fight in the next wave${g}`,
    feast: () => `Every defender gains a level${g}`,
    modest: () => '+8 luck, for free',
  }[o.k]();
  const full = o.k === 'take' && m.ro.filter((r) => !r[17]).length >= m.cap;
  return [d, (o.gold && m.gold < o.gold) || full, full ? 'The walls are full' : ''];
}

function overHtml(m) {
  const b = m.best, k = b && b.k, a = S.award, s = m.sum || {};
  const ach = a && a.ach.length ? `<div class="achs">${a.ach.map((x) => `<span class="ach" ${tip(`<b>${ACH_TXT[x][1]}</b><br>${ACH_TXT[x][2]}`)}>${ACH_TXT[x][0]} ${ACH_TXT[x][1]} <em>+${ACH_TXT[x][3]}</em></span>`).join('')}</div>` : '';
  const renown = a ? `<div class="renown">${star}<b>+${a.renown}</b> renown${a.daily ? ' (daily bonus included)' : ''}. You now have ${star}<b>${profile.renown}</b> to spend on new lords, classes, items, relics and abilities</div>` : '';
  const rank = titleBar();
  const news = [a && a.record ? 'New record' : '', a && a.rank ? `New title: ${titleName(a.rank)}` : '', a && a.siege ? `Siege level ${a.siege} unlocked${a.opened > 1 ? ` (${a.opened} levels at once)` : ''}: ${siegeName(a.siege, L().siege)}` : '']
    .filter(Boolean).map((x) => `<div class="record">${x}</div>`).join(' ');
  const n = Math.max(1, m.reached), sk = seasonOf(n);
  return `<div class="panel wide">${news ? `${news}<br>` : ''}<h2>${s.retired ? 'The castle is given up' : 'The castle has fallen'}</h2>
    <p>${LORD_TXT[m.lord][0]}, ${siegeWords(m.sv, L().siege)}, ${ageTitle(m)}${s.time ? `, ${Math.round(s.time / 60)} minutes of battle` : ''}</p>
    <div class="sum"><div><b>${m.reached}</b><small>wave reached</small></div><div><b>Year ${yearOf(n)}</b><small>${SEASON_TXT[sk][0]} ${SEASON_TXT[sk][1].toLowerCase()}</small></div><div><b>${fmt(m.st[0])}</b><small>monsters slain</small></div><div><b>${m.st[2]}</b><small>bosses felled</small></div><div><b>${s.muts || 0}</b><small>mutations faced</small></div></div>
    ${b ? `<div class="hero"><img src="${portrait('unit', k)}" alt=""><div><small style="color:var(--dim)">Hero of the run</small><br><b style="font-size:16px">${esc(b.name)}</b>, ${UNIT_TXT[k][0].toLowerCase()} of level ${b.lv}<br><span style="color:var(--dim)">${fmt(b.kills)} kills</span></div></div>` : ''}
    ${renown}${rank}${ach}
    <div class="foot"><button class="btn" data-restart ${big}>Start a new run</button><button class="btn alt" data-menu ${big}>Main menu</button></div></div>`;
}

function dialogHtml(m) {
  if (dialog.type === 'spec') {
    const r = m.ro && m.ro.find((x) => x[0] === dialog.uid);
    if (!r || !r[16]) { dialog = null; return ''; }
    const k = L().units[r[1]];
    return `<div class="panel wide"><h2>${esc(r[5])} chooses a path</h2><p>A ${UNIT_TXT[k][0].toLowerCase()} of level ${r[3]} may specialise. The choice is final.</p><div class="choices">${L().specs[k].map((sp, i) => `<button class="choice r2" style="${rc(2)}" data-specpick="${i + 1}"><img class="pic" src="${portrait('unit', k, r[2])}" alt=""><b>${SPEC_TXT[sp.key][0]}</b><span class="desc big">${SPEC_TXT[sp.key][1]}</span></button>`).join('')}</div><div class="foot"><button class="btn alt" data-close>Later</button></div></div>`;
  }
  if (dialog.type === 'build') {
    if (m.ph !== 'prep' || m.pl[dialog.plot]) { dialog = null; return ''; }
    const built = new Set(m.pl.filter(Boolean).map((b) => b[0]));
    const cards = L().buildingKeys.map((k, i) => {
      const d = L().buildings[k], [icon, name, desc] = BUILD_TXT[k], cost = m.yard.cost[i], locked = d.age > m.age + 1, have = built.has(i);
      const label = have ? 'Already built' : locked ? `${AGE_TXT[L().ages[d.age - 1].key][0]}` : `Build ${coin}${fmt(cost)}`;
      return `<div class="pickwrap"><div class="card ${locked ? 'lockd' : ''}" style="${rc(d.age - 1)}"><div class="top"><img class="pic" src="${portrait('building', k)}" alt=""><div><span class="rar">${AGE_TXT[L().ages[d.age - 1].key][0]}</span><div class="nm">${icon} ${name}</div></div></div><div class="desc big">${desc}</div><button class="btn" data-buildpick="${k}" ${have || locked || m.gold < cost ? 'disabled' : ''}>${label}</button></div></div>`;
    }).join('');
    return `<div class="panel wide"><h2>Raise a building</h2><p>Each building can be upgraded later with gold, as the castle level allows.</p><div class="choices">${cards}</div><div class="foot"><button class="btn alt" data-close>Cancel</button></div></div>`;
  }
  if (dialog.type === 'path') {
    // The choice of a path of ages: three roads, one for the rest of the run.
    if (m.ph !== 'prep' || !m.ar || !m.ar.choose) { dialog = null; return ''; }
    const ready = ageReady(m);
    const cards = Object.keys(L().paths).map((p) => {
      const ages = L().paths[p].ages.map((k, i) => `<div class="pathage"><b>${AGE_TXT[k][0]}</b><span><i>${PERK_TXT[k][0]}.</i> ${PERK_TXT[k][1]}</span><span class="cls">${ageClasses(p, L().ages.length + i).map((c) => `<span ${tip(`<b>${UNIT_TXT[c][0]}</b> (${FAM_TXT[L().unitStats[c].fam][0]})<br>${UNIT_TXT[c][1]}`)}><img src="${portrait('unit', c, 0)}" alt="">${UNIT_TXT[c][0]}</span>`).join('')}</span></div>`).join('');
      return `<div class="pickwrap"><div class="card path r3" style="${rc(3)}"><div class="top"><div class="pic emo">${PATH_TXT[p][0]}</div><div><span class="rar">Path of ages</span><div class="nm">${PATH_TXT[p][1]}</div></div></div><div class="desc big">${PATH_TXT[p][2]}</div>${ages}<button class="btn" data-path="${p}" ${ready ? '' : 'disabled'}>Follow this path ${coin}${fmt(m.ar.cost)}</button></div></div>`;
    }).join('');
    return `<div class="panel wide paths"><h2>Choose a path of ages</h2><p>The Golden Age is not the end. The castle now follows one of three paths; each age on it brings its own walls, a lasting power and two new classes. <b>The choice is final:</b> the other two paths are closed for this run.</p><div class="choices">${cards}</div><div class="foot"><button class="btn alt" data-close>Not yet</button></div></div>`;
  }
  // The pause menu and settings.
  const tog = (key, label) => `<label class="set"><span>${label}</span><button class="btn ${prefs[key] ? '' : 'alt'}" data-set="${key}">${prefs[key] ? 'On' : 'Off'}</button></label>`;
  return `<div class="panel" style="min-width:340px"><h2>Paused</h2><p>Your run is saved between waves.</p>
    <label class="set"><span>Volume</span><input type="range" min="0" max="100" value="${Math.round(prefs.volume * 100)}" data-vol></label>
    ${tog('music', 'Music')}${tog('sfx', 'Sound effects')}${tog('numbers', 'Damage numbers')}${tog('shake', 'Camera shake')}${tog('tips', 'Tips')}
    <label class="set"><span>Graphics</span><button class="btn alt" data-quality>${prefs.quality === 'low' ? 'Fast' : 'Pretty'}</button></label>
    <div class="foot"><button class="btn" data-close ${big}>Resume</button><button class="btn alt" data-menu ${big}>Main menu</button><button class="btn ${confirm === 'abandon' ? 'warn' : 'alt'}" data-abandon ${big} ${tip('Ends the run here. Renown, records and the siege ladder count as they stand.')}>${confirm === 'abandon' ? 'Sure? The run ends here' : 'Give up the castle'}</button></div></div>`;
}

function renderModal(m) {
  const s = JSON.stringify([m.ph, m.pick, m.gold, dialog, confirm === 'abandon', dialog && dialog.type === 'pause' ? [prefs.music, prefs.sfx, prefs.numbers, prefs.shake, prefs.tips, prefs.quality] : 0, dialog && m.pl, dialog && m.ar, m.ph === 'over' && [m.reached, m.st, m.best, !!S.award]]);
  if (s === sig.modal) return;
  sig.modal = s;
  let h = '';
  if (dialog && dialog.type === 'pause') h = dialogHtml(m);
  else if (m.ph === 'over') h = overHtml(m);
  else if (m.ph === 'reward' && m.pick) {
    const p = m.pick;
    const more = p.left > 1 ? `<span class="left">${p.left - 1} more after this</span>` : '';
    const reroll = p.rr >= 0 ? `<button class="btn alt" data-repick ${m.gold < p.rr ? 'disabled' : ''}>Reroll ${coin}${fmt(p.rr)}</button>` : '';
    const keys = `<span class="kbd">1</span>–<span class="kbd">${p.opts ? p.opts.length : 2}</span> to choose`;
    if (p.type === 'mutation') {
      // The horde's legacy from the boss that has just fallen: one of these has to be taken.
      const bn = the(MON[L().enemies[L().bosses[p.boss]].key][0]);
      h = `<div class="panel wide"><div class="record warn">The horde changes</div><h2>The legacy of ${bn}</h2><p>The horde keeps one new trait for the rest of the run. Choose which, and take what comes with it. ${more}</p><div class="choices">${p.opts.map((o, i) => `<button class="choice mut" data-pick="${i}"><span class="pi">${MUT_TXT[o.key][0]}</span><b>${MUT_TXT[o.key][1]}${o.lv > 1 ? ` ${roman(o.lv)}` : ''}</b><span class="desc big curse">${MUT_TXT[o.key][2](o.lv)}</span>${o.lv > 1 ? `<span class="now">It was: ${MUT_TXT[o.key][2](o.lv - 1)}</span>` : ''}<span class="boon"><small>${BOON_TXT[o.boon.k][0]} You get</small>${boonHtml(o.boon)}</span></button>`).join('')}</div><div class="foot">${keys}</div></div>`;
    } else if (p.type === 'muster') {
      h = `<div class="panel wide"><div class="record">${ageTitle(m)}</div><h2>The muster of a new age</h2><p>Masters of the new age offer their service. Take one of them, or pass. ${more}</p><div class="choices">${p.opts.map((o, i) => `<div class="pickwrap">${optionCard(o, `<button class="btn" data-pick="${i}">Take</button>`)}</div>`).join('')}</div><div class="foot"><button class="btn alt" data-skip>Pass</button></div></div>`;
    } else if (p.type === 'level') {
      h = `<div class="panel wide"><h2>Castle level up</h2><p>Choose one upgrade for the whole castle. ${more}</p><div class="choices">${p.opts.map((o, i) => `<button class="choice r${o.r}" style="${rc(o.r)}" data-pick="${i}"><span class="rar">${RAR_TXT[o.r]}</span><b>${STAT_TXT[o.stat][0]}</b><em>${sign(L().stats[o.stat][o.r])}${STAT_TXT[o.stat][1]}</em><span class="desc">${STAT_TXT[o.stat][2]}</span><span class="now">Now ${sign(Math.round(m.tot[o.stat] * 10) / 10)}${STAT_TXT[o.stat][1]}</span></button>`).join('')}</div><div class="foot">${reroll}${keys}</div></div>`;
    } else if (p.type === 'spoils') {
      h = `<div class="panel wide"><h2>Spoils of the wave</h2><p>Choose one. ${more}</p><div class="choices">${p.opts.map((o, i) => `<div class="pickwrap">${optionCard(o, `<button class="btn" data-pick="${i}">Take</button>`)}</div>`).join('')}</div><div class="foot">${reroll}<button class="btn alt" data-skip>Skip for ${coin}${fmt(p.skip)}</button></div></div>`;
    } else if (p.type === 'relic') {
      h = `<div class="panel wide"><div class="record">Boss slain</div><h2>A relic from the fallen</h2><p>Relics are found nowhere else. Choose one. ${more}</p><div class="choices">${p.opts.map((o, i) => `<div class="pickwrap">${optionCard(o, `<button class="btn" data-pick="${i}">Take</button>`)}</div>`).join('')}</div><div class="foot">${keys}</div></div>`;
    } else if (p.type === 'doctrine') {
      h = `<div class="panel wide"><div class="record">${ageTitle(m)}</div><h2>Choose a doctrine</h2><p>A new age changes how the castle fights. A doctrine lasts for the whole run.</p><div class="choices">${p.opts.map((o, i) => {
        const fam = L().doctrines[o.key].fam;
        return `<button class="choice r3" style="${rc(3)}" data-pick="${i}"><span class="pi">${DOC_TXT[o.key][0]}</span><b>${DOC_TXT[o.key][1]}</b><span class="desc big">${DOC_TXT[o.key][2]}</span>${fam ? `<span class="fam fam-${fam}">${FAM_TXT[fam][0]}</span>` : ''}</button>`;
      }).join('')}</div><div class="foot">${keys}</div></div>`;
    } else if (p.type === 'event') {
      const [icon, title, story] = EVENT_TXT[p.ev];
      h = `<div class="panel event"><div class="pi">${icon}</div><h2>${title}</h2><p>${story}</p><div class="evopts">${p.opts.map((o, i) => {
        const [d, off, why] = eventOption(o, m);
        return `<button class="evopt" data-pick="${i}" ${off ? 'disabled' : ''}><span class="kbd">${i + 1}</span><div><b>${EVENT_OPT[o.k]}</b><span>${d}${why ? ` <i>(${why})</i>` : ''}</span></div></button>`;
      }).join('')}</div>${more ? `<div class="foot">${more}</div>` : ''}</div>`;
    }
  } else if (dialog) h = dialogHtml(m);
  // A new choice ignores number keys for a moment, so a key meant for the battle cannot pick a reward.
  const pk = m.ph === 'reward' && m.pick ? `${m.pick.type}:${m.pick.left}:${JSON.stringify(m.pick.opts || [])}` : '';
  if (pk && pk !== lastPick) pickAt = performance.now();
  lastPick = pk;
  $('modal').hidden = !h;
  $('modal').innerHTML = h;
}

function openDialog(d) {
  const m = S.snap;
  if (d && d.type === 'pause' && m) { speedBefore = m.spd || 1; send({ t: 'speed', v: 0 }); }
  if (!d && dialog && dialog.type === 'pause') send({ t: 'speed', v: speedBefore });
  dialog = d; confirm = null;
  if (m) { sig.modal = ''; sig.waves = ''; renderModal(m); renderWaves(m); }
}

// ---- Tips for the first runs: one at a time, each shown once ----
const TIPS = [
  ['start', (m) => m.ph === 'prep' && m.wave === 0, 'Pick one of the waves at the bottom to begin. A harder wave pays more gold and experience and brings luckier spoils, but it is a gamble.'],
  ['battle', (m) => m.ph === 'wave' && m.wave <= 2, 'Your defenders fight on their own. The three abilities at the bottom are yours to use. Press <b>1</b>, <b>2</b> or <b>3</b>, and click the ground when one asks for a spot. <b>Space</b> pauses and the buttons at the top speed the battle up.'],
  ['level', (m) => m.ph === 'reward' && m.pick?.type === 'level', 'Castle level up! Kills and cleared waves give the castle experience. Each level lets you pick one upgrade for the whole castle.'],
  ['spoils', (m) => m.ph === 'reward' && m.pick?.type === 'spoils', 'These are the spoils of the wave. Take a new defender, an item, a turret or a blessing. Defenders cannot be bought, they only come from here.'],
  ['shop', (m) => m.ph === 'prep' && m.wave >= 1, 'Spend gold in the <b>Shop</b> on the right. The lock keeps an offer for later. The <b>Castle</b> tab upgrades the keep and the walls, and the <b>Stats</b> tab explains every number.'],
  ['event', (m) => m.ph === 'reward' && m.pick?.type === 'event', 'Every few waves something happens at the castle. Each answer says what it costs and what it gives, and one of them is always free.'],
  ['yard', (m) => m.ph === 'prep' && m.lv[0] >= 2 && m.wave >= 2 && !m.pl.some(Boolean), 'The castle has reached level 2, so you can now raise buildings in the <b>Yard</b> tab. A forge sharpens every blade and a market widens the shop.'],
  ['move', (m) => m.ph === 'prep' && m.wave >= 3, 'Click a defender on the wall, then a free place, to move them. Whoever stands in a <b>tower</b> reaches 15% further.'],
  ['family', (m) => m.ph === 'prep' && m.fam && m.fam[1].some((t) => t > 0), 'Family bonus! Two defenders of the same family make that family stronger, four and six even more. See the <b>Army</b> tab.'],
  ['spec', (m) => m.ph === 'prep' && m.ro && m.ro.some((r) => r[16]), 'A defender has reached level 6 and may <b>choose a path</b>. Open the <b>Army</b> tab. Every class has two specialisations to choose from.'],
  ['mod', (m) => m.ph === 'prep' && m.wv.some((w) => w.mod), 'Some waves now carry a <b>modifier</b>, such as frenzied or armoured monsters. They pay a quarter more. Hover the modifier to see what it does.'],
  ['boss', (m) => m.ph === 'prep' && m.nb[0] === m.wave + 1, 'A boss attacks next wave. Repair and upgrade your walls before you start it. Slaying it leaves a relic and opens the way to the next age, but the horde keeps a new trait from it.'],
  ['season', (m) => m.ph === 'prep' && m.wave >= 1, 'The run follows a <b>calendar</b>. A season lasts eight waves and ends with its boss, and each one gives something to the castle and something to the horde. Hover the season at the top to see what.'],
  ['weather', (m) => m.ph === 'prep' && m.wx[0] !== 'clear', 'The <b>weather</b> changes with every wave, and you can see it coming. Rain damps fire, fog shortens every reach, a gale grounds what flies. Hover the forecast at the top.'],
  ['mutation', (m) => m.ph === 'reward' && m.pick?.type === 'mutation', 'The boss is dead, but the horde <b>mutates</b> and keeps one new trait for the rest of the run. You have to take one of these, and each comes with something for you. The <b>Horde</b> tab lists them all.'],
  ['adapt', (m) => m.ph === 'prep' && m.la, 'The horde has <b>adapted</b>. It now resists the family that hurt it most last season and is weaker to the ones you neglected. The <b>Horde</b> tab shows who is resisted. A mixed army gives it nothing to learn.'],
  ['path', (m) => m.ph === 'prep' && m.ar && m.ar.choose && m.ar.boss, 'A year has passed and the Golden Age is not the end. The castle can now follow <b>one of three paths of ages</b>. Open the <b>Castle</b> tab to see them. The choice is final for this run.'],
  ['age', (m) => m.ph === 'prep' && m.ar && m.ar.boss, 'The boss is dead and a <b>new age</b> is within reach. It needs a castle level and gold, which the <b>Castle</b> tab shows. A new age rebuilds the walls and brings new recruits, buildings and a doctrine.'],
  ['full', (m) => m.ph === 'prep' && m.un.length >= m.cap, 'The walls are full. Upgrade the walls in the <b>Castle</b> tab to make room. Until then the spoils bring promotions, or a newcomer who takes the post of your weakest defender.'],
];
let tipNow = null;
function markSeen(id) { if (!prefs.tipsSeen.includes(id)) { prefs.tipsSeen.push(id); saveProfile(); } }
function updateTips(m) {
  if (!prefs.tips || dialog) { $('advice').hidden = true; return; }
  if (tipNow && TIPS.find((t) => t[0] === tipNow)[1](m)) return;
  if (tipNow) { markSeen(tipNow); tipNow = null; }
  const t = TIPS.find(([id, when]) => !prefs.tipsSeen.includes(id) && when(m));
  $('advice').hidden = !t;
  if (!t) return;
  tipNow = t[0];
  $('advice').innerHTML = `<span class="ai">${PIC.tip}</span><div>${t[2]}</div><button class="btn" data-ok>Got it</button><button class="btn alt" data-off>No tips</button>`;
}

// ---- Clicks and keys ----
export function initHud({ dev, keys }) {
  $('advice').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.off !== undefined) { prefs.tips = false; saveProfile(); } else if (tipNow) markSeen(tipNow);
    tipNow = null; $('advice').hidden = true;
  };
  $('abilities').onclick = (e) => { const b = e.target.closest('button'); if (b && !b.disabled) useAbility(b.dataset.abil); };
  $('waves').onclick = (e) => { const b = e.target.closest('button'); if (b) send({ t: 'wave', i: Number(b.dataset.wave) }); };
  $('ageBtn').onclick = advance;
  $('speed').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.pause !== undefined) openDialog({ type: 'pause' });
    else send({ t: 'speed', v: Number(b.dataset.spd) });
  };
  $('tabs').onclick = (e) => { const b = e.target.closest('button'); if (b) setTab(b.dataset.tab); };
  $('tabBody').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const d = b.dataset, again = (key) => { if (confirm === key) { confirm = null; return true; } confirm = key; sig.panel = ''; renderPanel(S.snap); return false; };
    if (d.buy) send({ t: 'buy', i: Number(d.buy) });
    else if (d.lock) send({ t: 'lock', i: Number(d.lock) });
    else if (d.reroll !== undefined) send({ t: 'reroll' });
    else if (d.train) send({ t: 'train', u: Number(d.train) });
    else if (d.move) S.hooks.setMoving(S.moving === Number(d.move) ? null : Number(d.move));
    else if (d.spec) openDialog({ type: 'spec', uid: Number(d.spec) });
    else if (d.dismiss) { if (again(`u${d.dismiss}`)) send({ t: 'dismiss', u: Number(d.dismiss) }); }
    else if (d.up) send({ t: 'up', b: d.up });
    else if (d.repair) send({ t: 'repair', what: d.repair });
    else if (d.age !== undefined) advance();
    else if (d.plot) openDialog({ type: 'build', plot: Number(d.plot) });
    else if (d.upbuild) send({ t: 'upbuild', p: Number(d.upbuild) });
    else if (d.demolish) { if (again(`p${d.demolish}`)) send({ t: 'demolish', p: Number(d.demolish) }); }
  };
  // Hovering a defender shows how far they reach.
  $('tabBody').addEventListener('mouseover', (e) => { const row = e.target.closest('[data-uid]'); if (S.moving == null) S.hooks.showRange(row ? Number(row.dataset.uid) : null); });
  $('tabBody').addEventListener('mouseleave', () => { if (S.moving == null) S.hooks.showRange(null); });

  $('modal').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.pick !== undefined) send({ t: 'pick', i: Number(d.pick) });
    else if (d.skip !== undefined) send({ t: 'skip' });
    else if (d.repick !== undefined) send({ t: 'repick' });
    else if (d.restart !== undefined) S.hooks.restart();
    else if (d.menu !== undefined) { dialog = null; S.hooks.leave(); }
    else if (d.close !== undefined) openDialog(null);
    else if (d.specpick) { send({ t: 'spec', u: dialog.uid, b: Number(d.specpick) }); sfx('up'); openDialog(null); }
    else if (d.buildpick) { send({ t: 'build', p: dialog.plot, k: d.buildpick }); openDialog(null); }
    else if (d.path) { send({ t: 'age', path: d.path }); openDialog(null); }
    else if (d.set) { prefs[d.set] = !prefs[d.set]; saveProfile(); S.hooks.applySettings(); sig.modal = ''; renderModal(S.snap); }
    else if (d.quality !== undefined) { prefs.quality = prefs.quality === 'low' ? 'high' : 'low'; saveProfile(); S.hooks.applySettings(); sig.modal = ''; renderModal(S.snap); }
    else if (d.abandon !== undefined) {
      if (confirm !== 'abandon') { confirm = 'abandon'; sig.modal = ''; renderModal(S.snap); return; }
      openDialog(null);
      S.hooks.abandon();
    }
  };
  $('modal').addEventListener('input', (e) => { if (e.target.dataset.vol !== undefined) { prefs.volume = Number(e.target.value) / 100; saveProfile(); S.hooks.applySettings(); } });

  // Tooltips for anything with data-tip.
  document.addEventListener('mousemove', (e) => {
    const el = e.target.closest?.('[data-tip]'), box = $('tip');
    if (!el) { box.hidden = true; return; }
    box.innerHTML = el.dataset.tip; box.hidden = false;
    box.style.left = `${Math.min(innerWidth - 260, e.clientX + 14)}px`; box.style.top = `${Math.min(innerHeight - box.offsetHeight - 8, e.clientY + 16)}px`;
  });
  // A soft click for every button.
  document.addEventListener('click', (e) => { if (e.target.closest?.('.btn, .choice, .wcard, .lord, .evopt, #tabs button, #speed button, .abil, .mtab, .tile')) sfx('click'); }, true);

  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    const m = S.snap;
    if (!S.joined || !m) return;
    void keys;
    if (e.code === 'Escape') {
      if (S.aiming) S.hooks.setAiming(null);
      else if (S.moving != null) S.hooks.setMoving(null);
      else if (dialog) openDialog(null);
      else if (m.ph !== 'over') openDialog({ type: 'pause' });
      return;
    }
    if (dialog && dialog.type === 'pause') return;
    const digit = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5 }[e.code];
    if (digit !== undefined) {
      if (dialog && dialog.type === 'spec') { if (digit < 2) { send({ t: 'spec', u: dialog.uid, b: digit + 1 }); openDialog(null); } }
      else if (dialog) return;
      else if (m.ph === 'prep' && digit < m.wv.length) send({ t: 'wave', i: digit });
      else if (m.ph === 'reward' && m.pick && performance.now() - pickAt > 800) send({ t: 'pick', i: digit });
      else if (m.ph === 'wave' && digit < m.ab.length) useAbility(m.ab[digit][0]);
    }
    if (e.code === 'KeyM') { prefs.music = !prefs.music; saveProfile(); S.hooks.applySettings(); toast(prefs.music ? 'Music on' : 'Music off', '', 900); }
    if (e.code === 'Space') { e.preventDefault(); send({ t: 'speed', v: m.spd ? 0 : 1 }); }
    if (e.code === 'Tab' && m.ph === 'prep') {
      e.preventDefault();
      const order = TABS.map((x) => x[0]);
      setTab(order[(order.indexOf(tab) + (e.shiftKey ? order.length - 1 : 1)) % order.length]);
    }
    // Shortcuts for testing, honoured only when the game was opened with ?dev.
    const k = dev && { KeyG: 'gold', KeyH: 'boss', KeyK: 'hurt', KeyJ: 'skip', KeyL: 'level', KeyV: 'mutate', KeyB: 'age', KeyN: 'event', KeyR: 'relic', KeyY: 'weather' }[e.code];
    if (k) send({ t: 'dev', k });
  });
}
