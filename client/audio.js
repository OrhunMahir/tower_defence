// Sound without sound files: every effect and the music are synthesised with the Web Audio API.
// Browsers only allow audio after a click, so initAudio() is called from the start menu.

let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
const prefs = { sfx: true, music: true };
const last = {};

export function initAudio(saved = {}) {
  Object.assign(prefs, saved);
  if (ctx) { ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = prefs.sfx ? 1 : 0; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = prefs.music ? 0.32 : 0; musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  setInterval(schedule, 100);
}

export function setAudio(kind, on) {
  prefs[kind] = on;
  if (!ctx) return;
  const bus = kind === 'sfx' ? sfxBus : musicBus;
  bus.gain.setTargetAtTime(on ? (kind === 'sfx' ? 1 : 0.32) : 0, ctx.currentTime, 0.1);
}
export const audioPrefs = () => ({ ...prefs });

// ---- Building blocks ----
function env(g, t, vol, attack, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}
function tone(freq, dur, { type = 'sine', vol = 0.1, to = null, attack = 0.005, at = 0, bus = sfxBus } = {}) {
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  env(g, t, vol, attack, dur);
  o.connect(g).connect(bus);
  o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, { vol = 0.1, freq = 1000, type = 'lowpass', to = null, q = 1, at = 0, bus = sfxBus } = {}) {
  const t = ctx.currentTime + at, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true;
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  env(g, t, vol, 0.004, dur);
  s.connect(f).connect(g).connect(bus);
  s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
// At most one sound of a kind every `gap` milliseconds, so a hundred arrows do not deafen anyone.
function allow(key, gap) {
  const now = performance.now();
  if (now - (last[key] || 0) < gap) return false;
  last[key] = now;
  return true;
}

const SOUNDS = {
  shoot: () => allow('shoot', 45) && noise(0.06, { vol: 0.05, freq: 2500, type: 'highpass' }),
  hit: () => allow('hit', 50) && noise(0.07, { vol: 0.09, freq: 900 }),
  kill: () => allow('kill', 55) && (tone(240, 0.12, { type: 'square', vol: 0.035, to: 90 }), noise(0.08, { vol: 0.05, freq: 700 })),
  crit: () => allow('crit', 90) && tone(1400, 0.08, { type: 'triangle', vol: 0.05, to: 2200 }),
  boom: () => allow('boom', 90) && (noise(0.45, { vol: 0.3, freq: 700, to: 120 }), tone(70, 0.35, { vol: 0.25, to: 35 })),
  ice: () => allow('ice', 80) && tone(1300, 0.14, { type: 'triangle', vol: 0.04, to: 2100 }),
  fire: () => allow('fire', 80) && noise(0.3, { vol: 0.1, freq: 1500, to: 400 }),
  zap: () => allow('zap', 70) && (noise(0.09, { vol: 0.07, freq: 3500, type: 'bandpass', q: 3 }), tone(900, 0.09, { type: 'square', vol: 0.03, to: 250 })),
  spit: () => allow('spit', 120) && noise(0.12, { vol: 0.05, freq: 600, type: 'bandpass', q: 4, to: 300 }),
  thump: () => allow('thump', 150) && tone(110, 0.2, { vol: 0.18, to: 55 }),
  chime: () => [660, 880, 1320].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.07, at: i * 0.07 })),
  up: () => allow('up', 150) && tone(880, 0.16, { type: 'triangle', vol: 0.04, to: 1320 }),
  level: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.4, { type: 'triangle', vol: 0.08, at: i * 0.08 })),
  coin: () => allow('coin', 60) && (tone(1318, 0.08, { type: 'square', vol: 0.03 }), tone(1760, 0.18, { type: 'square', vol: 0.03, at: 0.07 })),
  click: () => allow('click', 30) && tone(620, 0.04, { type: 'square', vol: 0.025 }),
  horn: () => { tone(196, 0.9, { type: 'sawtooth', vol: 0.06, attack: 0.08 }); tone(147, 0.9, { type: 'sawtooth', vol: 0.05, attack: 0.08 }); noise(0.9, { vol: 0.02, freq: 500 }); },
  roar: () => { tone(85, 1.4, { type: 'sawtooth', vol: 0.12, to: 45, attack: 0.1 }); noise(1.3, { vol: 0.15, freq: 500, to: 150 }); },
  crumble: () => allow('crumble', 200) && (noise(0.7, { vol: 0.28, freq: 500, to: 90 }), tone(60, 0.5, { vol: 0.15, to: 30 })),
  keep: () => allow('keep', 350) && tone(70, 0.18, { vol: 0.2, to: 45 }),
  volley: () => { noise(0.7, { vol: 0.12, freq: 3000, type: 'bandpass', to: 600, q: 2 }); },
  mend: () => [392, 523, 659].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.06, at: i * 0.06 })),
  rally: () => { tone(262, 0.5, { type: 'sawtooth', vol: 0.07, attack: 0.05 }); tone(392, 0.6, { type: 'sawtooth', vol: 0.06, attack: 0.05, at: 0.18 }); },
  victory: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.5, { type: 'triangle', vol: 0.09, at: i * 0.16 })),
  defeat: () => [392, 349, 311, 262].forEach((f, i) => tone(f, 0.7, { type: 'sine', vol: 0.1, at: i * 0.32 })),
};

export function sfx(name) {
  if (!ctx || !prefs.sfx || ctx.state !== 'running') return;
  const f = SOUNDS[name];
  if (f) f();
}

// ---- Music: a calm loop while preparing, drums and a quicker line during a wave ----
let mood = 'calm', nextBeat = 0, beat = 0;
const SCALE = [220, 261.6, 293.7, 329.6, 392, 440, 523.3, 587.3];   // A minor pentatonic, two octaves
const CHORDS = [[110, 130.8, 164.8], [87.3, 110, 130.8], [130.8, 164.8, 196], [98, 123.5, 146.8]];   // Am F C G
export function setMood(m) { mood = m === 'wave' ? 'battle' : m === 'over' ? 'quiet' : 'calm'; }

function schedule() {
  if (!ctx || ctx.state !== 'running' || !prefs.music) return;
  const bpm = mood === 'battle' ? 118 : 76, step = 60 / bpm / 2;
  if (nextBeat < ctx.currentTime) nextBeat = ctx.currentTime + 0.05;
  while (nextBeat < ctx.currentTime + 0.3) {
    const at = nextBeat - ctx.currentTime, bar = Math.floor(beat / 8) % 4, inBar = beat % 8;
    if (mood !== 'quiet' && inBar === 0) for (const f of CHORDS[bar]) tone(f, step * 8, { vol: 0.05, attack: 0.4, at, bus: musicBus });
    if (mood === 'quiet' && inBar === 0) tone(CHORDS[bar][0], step * 8, { vol: 0.04, attack: 0.8, at, bus: musicBus });
    const busy = mood === 'battle' ? 0.55 : 0.25;
    if (mood !== 'quiet' && Math.random() < busy) {
      const f = SCALE[Math.floor(Math.random() * SCALE.length)];
      tone(f, step * 1.6, { type: 'triangle', vol: mood === 'battle' ? 0.045 : 0.035, at, bus: musicBus });
    }
    if (mood === 'battle') {
      if (inBar % 4 === 0) tone(110, 0.25, { vol: 0.22, to: 40, at, bus: musicBus });
      if (inBar % 4 === 2) noise(0.12, { vol: 0.05, freq: 1800, type: 'bandpass', at, bus: musicBus });
      noise(0.03, { vol: 0.012, freq: 7000, type: 'highpass', at, bus: musicBus });
    }
    nextBeat += step;
    beat++;
  }
}
