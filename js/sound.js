// sound.js — Web Audio synth. Lazy-init on first user gesture.
// All sounds are computed; no audio files shipped.

let ctx = null;
let masterGain = null;
let humNode = null;
let humGain = null;
let muted = false;
let volume = 0.6;

function ensure() {
  if (ctx) return ctx;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = ctx.createGain();
  masterGain.gain.value = volume;
  masterGain.connect(ctx.destination);
  // Tube hum
  startHum();
  return ctx;
}

function startHum() {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  // pink-ish noise
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.0990460;
    b1 = 0.96300 * b1 + w * 0.2965164;
    b2 = 0.57000 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.05;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 140;
  bp.Q.value = 0.6;
  humGain = ctx.createGain();
  humGain.gain.value = 0.07;
  src.connect(bp).connect(humGain).connect(masterGain);
  src.start();
  humNode = src;
}

function envBeep(freq, dur, type = "square", vol = 0.2) {
  ensure();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = 0;
  g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.connect(g).connect(masterGain);
  o.start();
  o.stop(ctx.currentTime + dur + 0.05);
}

function noiseBurst(dur = 0.18, q = 1.0, freq = 1500, vol = 0.18) {
  ensure();
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = vol;
  g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + dur);
  src.connect(bp).connect(g).connect(masterGain);
  src.start();
  src.stop(ctx.currentTime + dur);
}

const SOUNDS = {
  tab_click() { envBeep(1200, 0.04, "square", 0.18); },
  key_press() { envBeep(800 + Math.random() * 100, 0.025, "square", 0.10); },
  boot_chime() {
    [261.6, 329.6, 392.0, 523.3].forEach((f, i) =>
      setTimeout(() => envBeep(f, 0.16, "sine", 0.18), i * 110));
  },
  static_burst() { noiseBurst(0.4, 0.8, 1800, 0.16); },
  static_short() { noiseBurst(0.08, 1.0, 2400, 0.10); },
  stranger_sting() {
    [440, 370, 311, 220, 165].forEach((f, i) =>
      setTimeout(() => envBeep(f, 0.18, "sine", 0.18), i * 90));
  },
  pin_break() { noiseBurst(0.15, 1.4, 4500, 0.20); envBeep(220, 0.06, "sawtooth", 0.10); },
  holotape_insert() {
    envBeep(60, 0.10, "square", 0.20);
    setTimeout(() => envBeep(80, 0.30, "sawtooth", 0.10), 40);
    setTimeout(() => noiseBurst(0.20, 0.6, 600, 0.08), 80);
  },
  achievement() {
    [523, 659, 784].forEach((f, i) =>
      setTimeout(() => envBeep(f, 0.14, "sine", 0.18), i * 90));
  },
  beep() { envBeep(880, 0.05, "square", 0.12); },
  error() { envBeep(220, 0.18, "sawtooth", 0.20); },
  unlock() {
    [392, 523, 659, 784].forEach((f, i) =>
      setTimeout(() => envBeep(f, 0.10, "triangle", 0.16), i * 60));
  },
  radroach() { noiseBurst(0.06, 1.5, 3000, 0.08); },
};

export function play(name) {
  if (muted) return;
  ensure();
  const fn = SOUNDS[name];
  if (fn) fn();
}

export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  if (masterGain) masterGain.gain.value = volume;
}

export function setHumVolume(v) {
  if (humGain) humGain.gain.value = Math.max(0, Math.min(0.2, v));
}

export function setMuted(m) { muted = !!m; }

export function getVolume() { return volume; }

// Lazy init on first interaction (autoplay policy)
function init() {
  if (!ctx) ensure();
  document.removeEventListener("pointerdown", init);
  document.removeEventListener("keydown", init);
  document.removeEventListener("touchstart", init);
}
document.addEventListener("pointerdown", init, { once: true });
document.addEventListener("keydown", init, { once: true });
document.addEventListener("touchstart", init, { once: true });
