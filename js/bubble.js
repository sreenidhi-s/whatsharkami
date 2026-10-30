import { BUBBLE } from './config.js';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function playPop(muted) {
  if (muted || reduced()) return;
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(420, t);
  osc.frequency.exponentialRampToValueAtTime(90, t + 0.12);
  gain.gain.setValueAtTime(0.08, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.16);
  osc.onended = () => ctx.close();
}

/**
 * Reusable pixel bubble.
 * @param {HTMLElement} host
 * @param {{ size?: number, src?: string, muted?: boolean, onBurst?: Function, config?: object }} props
 */
export function mountBubble(host, props = {}) {
  const cfg = { ...BUBBLE, ...props.config };
  const size = props.size ?? 69;
  const ariaLabel = String(props.ariaLabel ?? 'Burst the bubble').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
  let bursting = false;
  let raf = 0;
  let reformTimer = 0;
  let swellTimer = 0;
  let finishTimer = 0;
  const particles = [];

  host.style.setProperty('--bubble-size', `${size}px`);
  host.style.setProperty('--reform-ms', `${cfg.reformMs}ms`);
  host.innerHTML = `
    <button class="bubble" type="button" aria-label="${ariaLabel}">
      <span class="bubble__idle">
        <img class="bubble__art" src="${props.src || 'assets/bubble.png'}" alt="" width="${size}" height="${Math.round((size * 73) / 69)}" />
      </span>
      <span class="bubble__fx" aria-hidden="true"></span>
    </button>
  `;

  const btn = host.querySelector('.bubble');
  const art = host.querySelector('.bubble__art');
  const fx = host.querySelector('.bubble__fx');

  const cleanupFx = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    fx.innerHTML = '';
    particles.length = 0;
  };

  const spawn = () => {
    cleanupFx();
    if (reduced()) return;
    const n = cfg.particleCount;
    const ring = document.createElement('span');
    ring.className = 'bubble__ring';
    fx.appendChild(ring);

    for (let i = 0; i < n; i += 1) {
      const el = document.createElement('span');
      el.className = 'bubble__particle';
      const color = cfg.palette[Math.floor(Math.random() * cfg.palette.length)];
      const s = 4 + Math.floor(Math.random() * 5);
      el.style.width = `${s}px`;
      el.style.height = `${s}px`;
      el.style.background = color;
      el.style.margin = `${-s / 2}px 0 0 ${-s / 2}px`;
      fx.appendChild(el);
      const angle = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const speed = 90 + Math.random() * 160;
      particles.push({
        el,
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        rot: Math.random() * 360,
        vr: (Math.random() * 2 - 1) * 420,
      });
    }

    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / cfg.burstMs);
      const dt = 1 / 60;
      particles.forEach((p) => {
        p.vy += 420 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.el.style.opacity = String(1 - t);
        p.el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.rot}deg)`;
      });
      const ringScale = 1 + t * 6;
      ring.style.opacity = String(Math.max(0, 1 - t * 1.6));
      ring.style.transform = `translate3d(-50%, -50%, 0) scale(${ringScale})`;
      if (t < 1) raf = requestAnimationFrame(tick);
      else cleanupFx();
    };
    raf = requestAnimationFrame(tick);
  };

  const reform = () => {
    btn.classList.remove('is-popped', 'is-swelling', 'is-bursting');
    btn.classList.add('is-reforming');
    art.style.opacity = '';
    finishTimer = window.setTimeout(() => {
      btn.classList.remove('is-reforming');
      bursting = false;
      btn.disabled = false;
    }, reduced() ? 160 : cfg.reformMs);
  };

  const burst = () => {
    if (bursting) return;
    bursting = true;
    btn.disabled = true;
    btn.classList.add('is-bursting', 'is-swelling');
    document.dispatchEvent(new CustomEvent('bubble-burst'));
    props.onBurst?.();
    playPop(props.muted ?? true);

    swellTimer = window.setTimeout(() => {
      btn.classList.remove('is-swelling');
      btn.classList.add('is-popped');
      spawn();
    }, reduced() ? 0 : cfg.swellMs);

    reformTimer = window.setTimeout(reform, cfg.reformDelayMs);
  };

  const onClick = (e) => {
    e.preventDefault();
    burst();
  };

  btn.addEventListener('click', onClick);

  return {
    burst,
    el: btn,
    destroy() {
      btn.removeEventListener('click', onClick);
      window.clearTimeout(reformTimer);
      window.clearTimeout(swellTimer);
      window.clearTimeout(finishTimer);
      cleanupFx();
      host.innerHTML = '';
    },
  };
}
