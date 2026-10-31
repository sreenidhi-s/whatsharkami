/**
 * 8-bit sound effects, synthesised with the Web Audio API (no audio files).
 * - Plays after the visitor's first click/tap (browser rule).
 * - Mute button (bottom-left); the choice is remembered.
 * - Most sounds are wired up automatically by listening to clicks, hovers,
 *   form submits, the shark dialog and the 'bubble-burst' event.
 *   For anything else call: playSound('fanfare') etc.
 */

const KEY = 'sharkSoundMuted';
const MASTER_VOLUME = 0.5; // 0 - 1, overall loudness

let ctx = null;
let master = null;
let noiseBuf = null;
let muted = false;
try { muted = localStorage.getItem(KEY) === '1'; } catch (_) { /* storage blocked */ }

function ensureContext() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = MASTER_VOLUME;
    master.connect(ctx.destination);
  }
  return ctx;
}

/* ---------- building blocks ---------- */

function tone(c, { f = 440, f2, t = 0, d = 0.08, type = 'square', v = 0.12 }) {
  const o = c.createOscillator();
  const g = c.createGain();
  const start = c.currentTime + t;
  o.type = type;
  o.frequency.setValueAtTime(f, start);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, start + d);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(v, start + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, start + d);
  o.connect(g).connect(master);
  o.start(start);
  o.stop(start + d + 0.03);
}

function swoosh(c, { from = 400, to = 2200, d = 0.25, v = 0.12 }) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.2;
  const g = c.createGain();
  const start = c.currentTime;
  filter.frequency.setValueAtTime(from, start);
  filter.frequency.exponentialRampToValueAtTime(to, start + d);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(v, start + d * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, start + d);
  src.connect(filter).connect(g).connect(master);
  src.start(start);
  src.stop(start + d + 0.03);
}

/* ---------- the sounds ---------- */

const NOTES = { C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5, A4: 440, D5: 587.33 };
const ANSWER_PITCH = [392, 440, 494, 523]; // A, B, C, D

const SOUNDS = {
  tick: (c) => tone(c, { f: 1400, d: 0.025, type: 'triangle', v: 0.035 }),
  click: (c) => tone(c, { f: 520, f2: 700, d: 0.06, v: 0.1 }),
  answer: (c, i = 0) => {
    const f = ANSWER_PITCH[i % 4];
    tone(c, { f, f2: f * 1.5, d: 0.09, v: 0.12 });
  },
  start: (c) => {
    tone(c, { f: NOTES.C5, d: 0.09 });
    tone(c, { f: NOTES.G5, t: 0.09, d: 0.14 });
  },
  back: (c) => tone(c, { f: 520, f2: 330, d: 0.09, v: 0.1 }),
  success: (c) => {
    tone(c, { f: NOTES.E5, d: 0.08 });
    tone(c, { f: NOTES.G5, t: 0.08, d: 0.08 });
    tone(c, { f: NOTES.C6, t: 0.16, d: 0.16 });
  },
  bloop: (c) => {
    tone(c, { f: 300, f2: 900, d: 0.13, type: 'sine', v: 0.2 });
    tone(c, { f: 500, f2: 1200, t: 0.07, d: 0.1, type: 'sine', v: 0.12 });
  },
  open: (c) => swoosh(c, { from: 350, to: 2400, d: 0.26 }),
  close: (c) => swoosh(c, { from: 2000, to: 300, d: 0.2, v: 0.09 }),
  fanfare: (c) => {
    [NOTES.C5, NOTES.E5, NOTES.G5].forEach((f, i) => tone(c, { f, t: i * 0.1, d: 0.11 }));
    tone(c, { f: NOTES.C6, t: 0.3, d: 0.3 });
    tone(c, { f: NOTES.G5, t: 0.3, d: 0.3, type: 'triangle', v: 0.1 });
  },
};

/* ---------- playing ---------- */

/** Play a named sound. `arg` is passed to the sound (e.g. answer index). */
export function playSound(name, arg) {
  if (muted || !SOUNDS[name]) return;
  const c = ensureContext();
  if (!c) return;
  if (c.state === 'running') {
    SOUNDS[name](c, arg);
  } else {
    // the first sound after a click: wake the audio engine, then play
    c.resume().then(() => SOUNDS[name](c, arg)).catch(() => {});
  }
}

/** Hover ticks must never try to wake the engine (no click has happened yet). */
function playHoverTick() {
  if (muted || !ctx || ctx.state !== 'running') return;
  SOUNDS.tick(ctx);
}

export function isMuted() {
  return muted;
}

/* ---------- mute button ---------- */

const ICON_ON = '<rect x="2" y="6" width="3" height="4"/><rect x="5" y="5" width="2" height="6"/><rect x="7" y="3" width="2" height="10"/><rect x="11" y="6" width="1" height="4"/><rect x="13" y="4" width="1" height="8"/>';
const ICON_OFF = '<rect x="2" y="6" width="3" height="4"/><rect x="5" y="5" width="2" height="6"/><rect x="7" y="3" width="2" height="10"/><rect x="11" y="6" width="1" height="1"/><rect x="12" y="7" width="1" height="1"/><rect x="13" y="8" width="1" height="1"/><rect x="14" y="9" width="1" height="1"/><rect x="14" y="6" width="1" height="1"/><rect x="13" y="7" width="1" height="1"/><rect x="12" y="8" width="1" height="1"/><rect x="11" y="9" width="1" height="1"/>';

function mountToggle() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sound-toggle';
  const paint = () => {
    btn.setAttribute('aria-pressed', String(!muted));
    btn.setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
    btn.title = muted ? 'Sound off' : 'Sound on';
    btn.innerHTML = `<svg viewBox="0 0 16 16" width="26" height="26" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${muted ? ICON_OFF : ICON_ON}</svg>`;
  };
  paint();
  btn.addEventListener('click', () => {
    muted = !muted;
    try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (_) { /* ignore */ }
    paint();
    if (!muted) playSound('click');
  });
  document.body.appendChild(btn);
  return btn;
}

/* ---------- automatic wiring ---------- */

export function mountSound() {
  mountToggle();

  // clicks
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a, [data-answer], [data-shark], .nav__link');
    if (!t || t.closest('.sound-toggle') || t.closest('#site-bubble') || t.classList.contains('dialog-close')) return;
    if (t.matches('[data-answer]')) {
      playSound('answer', Array.prototype.indexOf.call(t.parentElement.children, t));
    } else if (t.matches('[data-action="download"], [data-action="share"], [data-action="make-card"]')) {
      playSound('success');
    } else if (t.matches('[data-action="back"], [data-action="back-result"], [data-action="restart"], [data-action="retake"]')) {
      playSound('back');
    } else if (t.matches('[data-shark]')) {
      // the dialog's whoosh handles tiles; hotspots just get a blip
      if (!t.classList.contains('tile')) playSound('click');
    } else {
      playSound('click');
    }
  });

  // start form
  document.addEventListener('submit', (e) => {
    if (e.target.id === 'start-form') playSound('start');
  });

  // hover ticks (mouse only, very quiet)
  if (!window.matchMedia('(hover: none)').matches) {
    let last = null;
    let lastAt = 0;
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('button, a, [data-answer], .tile, .map-hotspot');
      if (!t || t === last || t.closest('.sound-toggle')) return;
      last = t;
      const now = performance.now();
      if (now - lastAt < 60) return;
      lastAt = now;
      playHoverTick();
    });
  }

  // bubble pop
  document.addEventListener('bubble-burst', () => playSound('bloop'));

  // shark popup opening / closing
  const dialog = document.querySelector('#shark-dialog');
  if (dialog) {
    let wasOpen = dialog.open;
    new MutationObserver(() => {
      if (dialog.open === wasOpen) return;
      wasOpen = dialog.open;
      playSound(dialog.open ? 'open' : 'close');
    }).observe(dialog, { attributes: true, attributeFilter: ['open'] });
  }
}
