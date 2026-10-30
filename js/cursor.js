import { CURSOR } from './config.js';

const PALETTE = ['#f7c6dc', '#cfc2f7', '#bdf0cf', '#ffffff', '#c2e1f4'];

function isTouch() {
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

function drawArrow(ctx, size) {
  ctx.clearRect(0, 0, size, size);
  const px = size / 11;
  const cells = [
    [0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7],
    [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6],
    [2, 2], [2, 3], [2, 4], [2, 5],
    [3, 3], [3, 4],
    [4, 4], [4, 5],
    [5, 5], [5, 6],
    [6, 6], [6, 7],
    [7, 7],
  ];
  const outline = [
    [-1, -1], [1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7], [1, 8],
    [0, 8], [-1, 7], [2, 6], [3, 5], [4, 6], [5, 7], [6, 8], [7, 8], [8, 8], [8, 7],
    [7, 6], [6, 5], [5, 4], [4, 3], [3, 2], [2, 1], [1, -1], [0, -1],
  ];
  ctx.fillStyle = '#fff2f2';
  outline.forEach(([x, y]) => ctx.fillRect((x + 1) * px, (y + 1) * px, px, px));
  ctx.fillStyle = '#825c6c';
  cells.forEach(([x, y]) => ctx.fillRect((x + 1) * px, (y + 1) * px, px, px));
}

/**
 * Pixel cursor + delayed pastel trail. Never captures pointer events.
 */
export function mountCursor() {
  if (isTouch()) return { destroy() {} };

  const root = document.createElement('div');
  root.className = 'px-cursor';
  root.setAttribute('aria-hidden', 'true');

  const canvas = document.createElement('canvas');
  canvas.className = 'px-cursor__arrow';
  canvas.width = 88;
  canvas.height = 88;
  canvas.style.width = `${CURSOR.size}px`;
  canvas.style.height = `${CURSOR.size}px`;
  drawArrow(canvas.getContext('2d'), 88);

  const ring = document.createElement('span');
  ring.className = 'px-cursor__ring';
  const spark = document.createElement('span');
  spark.className = 'px-cursor__spark';

  const dots = [];
  for (let i = 0; i < CURSOR.trailLength; i += 1) {
    const d = document.createElement('span');
    d.className = 'px-cursor__dot';
    d.style.background = PALETTE[i % PALETTE.length];
    d.style.width = `${5 - Math.min(2, i >> 1)}px`;
    d.style.height = d.style.width;
    root.appendChild(d);
    dots.push({ el: d, x: 0, y: 0 });
  }

  root.append(canvas, ring, spark);
  document.body.appendChild(root);
  document.body.classList.add('has-custom-cursor');
  document.documentElement.style.cursor = 'none';
  document.body.style.cursor = 'none';

  const style = document.createElement('style');
  style.textContent = `.has-custom-cursor, .has-custom-cursor * { cursor: none !important; }`;
  document.head.appendChild(style);

  let mx = window.innerWidth / 2;
  let my = window.innerHeight / 2;
  let cx = mx;
  let cy = my;
  let raf = 0;
  let running = true;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const onMove = (e) => {
    mx = e.clientX;
    my = e.clientY;
  };
  const onDown = () => root.classList.add('is-pressed');
  const onUp = () => root.classList.remove('is-pressed');
  const onOver = (e) => {
    const clickable = e.target.closest('a, button, input, [data-cursor="hover"]');
    root.classList.toggle('is-hover', Boolean(clickable));
  };
  const onBurst = () => {
    root.classList.add('is-bursting');
    window.setTimeout(() => root.classList.remove('is-bursting'), 280);
  };

  const tick = () => {
    if (!running) return;
    const k = reduced ? 1 : CURSOR.follow;
    cx += (mx - cx) * k;
    cy += (my - cy) * k;
    canvas.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    ring.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    spark.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;

    let tx = cx;
    let ty = cy;
    dots.forEach((d, i) => {
      const f = reduced ? 1 : CURSOR.trailFollow * (0.55 + i * 0.08);
      d.x += (tx - 6 - i * 3 - d.x) * f;
      d.y += (ty + 10 + i * 4 - d.y) * f;
      d.el.style.transform = `translate3d(${d.x}px, ${d.y}px, 0)`;
      tx = d.x;
      ty = d.y;
    });
    raf = requestAnimationFrame(tick);
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  document.addEventListener('pointerover', onOver);
  document.addEventListener('bubble-burst', onBurst);
  raf = requestAnimationFrame(tick);

  return {
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('bubble-burst', onBurst);
      root.remove();
      style.remove();
      document.body.classList.remove('has-custom-cursor');
      document.documentElement.style.cursor = '';
      document.body.style.cursor = '';
    },
  };
}
