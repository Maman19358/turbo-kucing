// Tiny WebAudio synth SFX — no audio files, everything synthesized.
// All calls are guarded: if AudioContext is unavailable/suspended, they no-op.
let ctx = null;
let muted = false;
let engine = null; // { osc, gain, filter }

function ac() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(freq, dur, type = 'sine', vol = 0.12, when = 0, slideTo = null) {
  const c = ac();
  if (!c || muted) return;
  try {
    const t0 = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  } catch { /* ignore */ }
}

function noise(dur, vol = 0.15, freq = 800) {
  const c = ac();
  if (!c || muted) return;
  try {
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(c.destination);
    src.start();
  } catch { /* ignore */ }
}

export const audio = {
  unlock() { ac(); },
  setMuted(m) {
    muted = m;
    if (engine) engine.gain.gain.value = m ? 0 : 0.035;
  },
  isMuted() { return muted; },
  coin(combo = 1) {
    const base = 660 + Math.min(combo, 8) * 40;
    tone(base, 0.09, 'sine', 0.12);
    tone(base * 1.5, 0.14, 'sine', 0.1, 0.06);
  },
  boost() {
    noise(0.45, 0.16, 2400);
    tone(180, 0.4, 'sawtooth', 0.08, 0, 720);
    tone(90, 0.4, 'sine', 0.1, 0, 360);
  },
  hit() { noise(0.25, 0.22, 500); tone(140, 0.25, 'sawtooth', 0.12, 0, 60); },
  click() { tone(520, 0.06, 'sine', 0.08); },
  gameOver() {
    tone(392, 0.22, 'triangle', 0.12);
    tone(311, 0.22, 'triangle', 0.12, 0.2);
    tone(233, 0.4, 'triangle', 0.12, 0.4);
  },
  start() {
    tone(523, 0.1, 'triangle', 0.1);
    tone(659, 0.1, 'triangle', 0.1, 0.08);
    tone(784, 0.18, 'triangle', 0.12, 0.16);
  },
  // engine hum: a low sawtooth whose pitch follows speed. Started on the
  // first run, stopped on game over / menu. Fully guarded.
  engineStart() {
    const c = ac();
    if (!c || engine) return;
    try {
      const o = c.createOscillator();
      const f = c.createBiquadFilter();
      const g = c.createGain();
      o.type = 'sawtooth';
      o.frequency.value = 55;
      f.type = 'lowpass'; f.frequency.value = 320;
      g.gain.value = muted ? 0 : 0.035;
      o.connect(f).connect(g).connect(c.destination);
      o.start();
      engine = { osc: o, gain: g };
    } catch { engine = null; }
  },
  engineSet(speedNorm, boosting) {
    if (!engine) return;
    try {
      const target = 55 + speedNorm * 70 + (boosting ? 45 : 0);
      engine.osc.frequency.setTargetAtTime(target, ctx.currentTime, 0.08);
    } catch { /* ignore */ }
  },
  engineStop() {
    if (!engine) return;
    try { engine.osc.stop(); } catch { /* ignore */ }
    engine = null;
  },
};
