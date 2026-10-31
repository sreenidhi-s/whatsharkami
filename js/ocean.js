/**
 * Ambient ocean: small pixel fish and drifting pixel bubbles on a canvas
 * behind the page. Some fish dart away from the cursor, some "shy" bubbles
 * drift away from it, and clicking any bubble pops it (with a sound).
 * The canvas is low-resolution and scaled up, so everything is chunky pixels.
 */
import { playSound } from './sound.js';

const FISH_PALETTE = [
  { b: '#f7c6dc', f: '#e79bbd' },
  { b: '#cfc2f7', f: '#a89be0' },
  { b: '#bdf0cf', f: '#8fd6ab' },
  { b: '#c2e1f4', f: '#8dc0e0' },
  { b: '#ffffff', f: '#c9d6e6' },
];
const SPRITES = [
  ['...ff.....', '.fbbbbbb..', 'ffbbbbbbeb', 'ffbllllbbb', '.fbbbbbb..', '...ff.....'],
  ['f..bbb..', 'ffbbbbb.', 'fbbbbbeb', 'ffbllbb.', 'f..bbb..'],
  ['f.bb.', 'fbbbe', 'f.bb.'],
];
// clicks on these never pop bubbles
const INTERACTIVE = 'button, a, input, textarea, select, label, dialog, summary, [role="button"], [data-answer], [data-shark], .nav';

const rand = (a, b) => a + Math.random() * (b - a);

export function mountOcean() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.createElement('canvas');
  canvas.className = 'ocean-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let S = 4; // screen pixels per canvas pixel
  let W = 0;
  let H = 0;
  const resize = () => {
    S = window.innerWidth < 760 ? 3 : 4;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.ceil(W / S);
    canvas.height = Math.ceil(H / S);
  };
  resize();
  window.addEventListener('resize', resize);

  const cur = { x: -9999, y: -9999 };
  let t = 0;

  /* ---------- bubbles ---------- */
  const bubbles = [];
  const newBubble = (fromBottom) => {
    const rr = Math.round(rand(3, 8));
    return {
      bx: rand(0, W),
      by: fromBottom ? H + rr * S + rand(0, 160) : rand(0, H),
      rr,
      vy: -rand(8, 22),
      phase: rand(0, 6.28),
      sway: rand(6, 16),
      ox: 0, oy: 0, ovx: 0, ovy: 0,
      shy: Math.random() < 0.35,
      alive: true,
      respawnAt: 0,
    };
  };
  const bubblePos = (b) => ({
    x: b.bx + Math.sin(t * 0.8 + b.phase) * b.sway + b.ox,
    y: b.by + b.oy,
  });

  /* ---------- fish ---------- */
  const fish = [];
  const newFish = (initial) => {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const r = Math.random();
    const type = r < 0.2 ? 2 : r < 0.55 ? 1 : 0;
    return {
      dir, type,
      colors: FISH_PALETTE[Math.floor(Math.random() * FISH_PALETTE.length)],
      x: initial ? rand(0, W) : dir > 0 ? -90 : W + 90,
      by: rand(H * 0.1, H * 0.88),
      speed: rand(22, 55) * (type === 2 ? 1.2 : 1),
      phase: rand(0, 6.28),
      vxE: 0, vyE: 0,
    };
  };

  const bubbleCount = window.innerWidth < 760 ? 9 : 16;
  const fishCount = reduced ? 0 : window.innerWidth < 760 ? 4 : 7;
  for (let i = 0; i < bubbleCount; i += 1) bubbles.push(newBubble(false));
  for (let i = 0; i < fishCount; i += 1) fish.push(newFish(true));

  /* ---------- pop particles ---------- */
  const bits = [];
  const pop = (b) => {
    const p = bubblePos(b);
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2;
      const sp = rand(50, 95);
      bits.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1 });
    }
    b.alive = false;
    b.respawnAt = t + rand(1.5, 4);
    playSound('pop');
  };

  /* ---------- cards hide the ocean behind them ---------- */
  // Anything floating behind a card can't be seen or touched. It keeps moving
  // and shows up again on the other side. (The ID card's wrapper panel is
  // transparent, so the card itself is used there.)
  const CARDS = '.panel:not(.panel--id), .id-card';
  const OFF = { x: -9999, y: -9999 };
  const cardRects = () => Array.from(document.querySelectorAll(CARDS), (el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0);
  const inCards = (rects, x, y) => rects.some((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);

  /* ---------- update ---------- */
  const damp = (v, k, dt) => v * Math.max(0, 1 - k * dt);

  const update = (dt, rects) => {
    const pt = inCards(rects, cur.x, cur.y) ? OFF : cur; // cursor on a card: nothing flees
    bubbles.forEach((b) => {
      if (!b.alive) {
        if (t >= b.respawnAt) Object.assign(b, newBubble(true));
        return;
      }
      if (!reduced) b.by += b.vy * dt;
      if (b.by < -b.rr * S - 10) {
        b.by = H + b.rr * S + 10;
        b.bx = rand(0, W);
      }
      if (b.shy && !reduced) {
        const p = bubblePos(b);
        const dx = p.x - pt.x;
        const dy = p.y - pt.y;
        const d = Math.hypot(dx, dy);
        if (d < 130 && d > 0.1 && !inCards(rects, p.x, p.y)) {
          const k = (1 - d / 130) * 420 * dt;
          b.ovx += (dx / d) * k;
          b.ovy += (dy / d) * k;
        }
      }
      b.ox += b.ovx * dt;
      b.oy += b.ovy * dt;
      b.ovx = damp(b.ovx, 2.2, dt);
      b.ovy = damp(b.ovy, 2.2, dt);
      b.ox = damp(b.ox, 0.5, dt);
      b.oy = damp(b.oy, 0.5, dt);
    });

    fish.forEach((f, i) => {
      const y = f.by + Math.sin(t * 1.6 + f.phase) * S * 1.2;
      const dx = f.x - pt.x;
      const dy = y - pt.y;
      const d = Math.hypot(dx, dy);
      if (d < 150 && d > 0.1 && !inCards(rects, f.x, y)) {
        const k = (1 - d / 150) * 320 * dt;
        f.vxE += (dx / d) * k;
        f.vyE += (dy / d) * k;
      }
      f.x += (f.dir * f.speed + f.vxE) * dt;
      f.by = Math.min(H * 0.95, Math.max(H * 0.04, f.by + f.vyE * dt));
      f.vxE = damp(f.vxE, 1.6, dt);
      f.vyE = damp(f.vyE, 1.6, dt);
      if (Math.abs(f.vxE) > 70) f.dir = f.vxE > 0 ? 1 : -1; // turn and dart away
      if ((f.dir > 0 && f.x > W + 90) || (f.dir < 0 && f.x < -90)) fish[i] = newFish(false);
    });

    for (let i = bits.length - 1; i >= 0; i -= 1) {
      const p = bits[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx = damp(p.vx, 3, dt);
      p.vy = damp(p.vy, 3, dt);
      p.life -= dt * 2.4;
      if (p.life <= 0) bits.splice(i, 1);
    }
  };

  /* ---------- draw ---------- */
  const draw = (rects) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // paint everywhere except inside the cards (whole canvas pixels keep edges crisp)
    ctx.save();
    if (rects.length) {
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height);
      rects.forEach((r) => {
        const x0 = Math.round(r.left / S);
        const y0 = Math.round(r.top / S);
        ctx.rect(x0, y0, Math.round(r.right / S) - x0, Math.round(r.bottom / S) - y0);
      });
      ctx.clip('evenodd');
    }

    // bubbles: pixel ring + a highlight pixel
    ctx.globalAlpha = 0.7;
    bubbles.forEach((b) => {
      if (!b.alive) return;
      const p = bubblePos(b);
      const cx = Math.round(p.x / S);
      const cy = Math.round(p.y / S);
      ctx.fillStyle = '#eaf7ff';
      for (let py = -b.rr - 1; py <= b.rr + 1; py += 1) {
        for (let px = -b.rr - 1; px <= b.rr + 1; px += 1) {
          const d = Math.hypot(px, py);
          if (d > b.rr - 0.8 && d <= b.rr + 0.4) ctx.fillRect(cx + px, cy + py, 1, 1);
        }
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - Math.round(b.rr * 0.45), cy - Math.round(b.rr * 0.5), 1, 1);
    });

    // fish
    ctx.globalAlpha = 0.8;
    fish.forEach((f) => {
      const sprite = SPRITES[f.type];
      const w = sprite[0].length;
      const h = sprite.length;
      const y = f.by + Math.sin(t * 1.6 + f.phase) * S * 1.2;
      const x0 = Math.round(f.x / S - w / 2);
      const y0 = Math.round(y / S - h / 2);
      for (let r = 0; r < h; r += 1) {
        for (let c = 0; c < w; c += 1) {
          const ch = sprite[r][f.dir > 0 ? c : w - 1 - c];
          if (ch === '.') continue;
          ctx.fillStyle = ch === 'b' ? f.colors.b : ch === 'f' ? f.colors.f : ch === 'l' ? '#ffffff' : '#13375e';
          ctx.fillRect(x0 + c, y0 + r, 1, 1);
        }
      }
    });

    // pop particles
    ctx.fillStyle = '#ffffff';
    bits.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillRect(Math.round(p.x / S), Math.round(p.y / S), 1, 1);
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  };

  /* ---------- loop ---------- */
  let raf = 0;
  let last = 0;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (now - last < 33) return; // ~30 fps keeps the pixel feel and saves battery
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    t = now / 1000;
    const rects = cardRects();
    update(dt, rects);
    draw(rects);
  };
  raf = requestAnimationFrame(frame);

  const onVisibility = () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  /* ---------- input ---------- */
  const onMove = (e) => {
    cur.x = e.clientX;
    cur.y = e.clientY;
  };
  const onLeave = () => {
    cur.x = -9999;
    cur.y = -9999;
  };
  const onDown = (e) => {
    if (e.target.closest && e.target.closest(INTERACTIVE)) return;
    if (inCards(cardRects(), e.clientX, e.clientY)) return; // behind a card: can't be reached
    let best = null;
    let bestD = Infinity;
    bubbles.forEach((b) => {
      if (!b.alive) return;
      const p = bubblePos(b);
      const d = Math.hypot(p.x - e.clientX, p.y - e.clientY);
      if (d <= b.rr * S + 12 && d < bestD) {
        best = b;
        bestD = d;
      }
    });
    if (best) pop(best);
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('mouseleave', onLeave);
  document.addEventListener('pointerdown', onDown);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.remove();
    },
  };
}