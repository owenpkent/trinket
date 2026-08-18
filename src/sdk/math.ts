/** Scalar helpers the toys reach for constantly. */

export const TAU = Math.PI * 2;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Map value from one range to another without clamping. */
export function remap(value: number, inMin: number, inMax: number, outMin: number, outMax: number) {
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

/** Hermite ease between two edges, clamped to 0..1. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Frame-rate independent exponential approach.
 *
 * `rate` is the fraction of the remaining distance covered per second, so the
 * same value behaves identically at 60Hz and 144Hz.
 */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-rate * dt));
}

/** Wrap into [0, span), correct for negative inputs. */
export function wrap(value: number, span: number): number {
  const result = value % span;
  return result < 0 ? result + span : result;
}
