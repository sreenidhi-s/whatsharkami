/**
 * Bubble + burst tunables.
 *
 * Burst speed:  lower BUBBLE.burstMs for a snappier pop (try 600–800).
 * Particle count:  BUBBLE.particleCount, keep between 12 and 20.
 * Reform delay:  BUBBLE.reformDelayMs is the wait after the pop before
 * the bubble grows back (try 2000–3000).
 */
export const BUBBLE = {
  particleCount: 16,
  /** How long particles fly, rotate, fall, and fade (ms). */
  burstMs: 720,
  /** 1–2 frame swell before the break (ms). */
  swellMs: 70,
  /** Wait after burst before the bubble reforms (ms). */
  reformDelayMs: 2400,
  /** Grow-back duration (ms). */
  reformMs: 280,
  idleBobPx: 7,
  idleDriftPx: 5,
  idleRotateDeg: 5,
  palette: ['#F7C6DC', '#CFC2F7', '#BDF0CF', '#FFFFFF', '#C2E1F4'],
};

export const CURSOR = {
  size: 22,
  trailLength: 7,
  follow: 0.42,
  trailFollow: 0.18,
};
