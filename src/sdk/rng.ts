import type { Rng } from './types';

/**
 * mulberry32. Small, fast, good enough for visual noise, and fully
 * deterministic so sims can be unit tested.
 */
export function createRng(seed = 0x9e3779b9): Rng {
  let s = seed >>> 0;

  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min)),
    // Irwin-Hall with n = 4, rescaled. Cheaper than Box-Muller and plenty
    // normal-looking for particle jitter.
    normal: () => (next() + next() + next() + next() - 2) * 1.7320508,
    pick: (items) => items[Math.floor(next() * items.length)],
  };
}
