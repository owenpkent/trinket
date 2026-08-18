/** Color helpers shared by toys and the shell. */

/** Parse #rgb or #rrggbb into normalized 0..1 components. */
export function hexToRgb(hex: string): [number, number, number] {
  let body = hex.trim().replace(/^#/, '');
  if (body.length === 3) {
    body = body[0] + body[0] + body[1] + body[1] + body[2] + body[2];
  }
  const value = Number.parseInt(body, 16);
  if (body.length !== 6 || Number.isNaN(value)) return [1, 1, 1];
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

/** Inverse of hexToRgb, clamped. */
export function rgbToHex(r: number, g: number, b: number): string {
  const channel = (v: number): string =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** Linear interpolation between two normalized rgb triples. */
export function mixRgb(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * Build a 256-entry lookup table of packed 0xAABBGGRR values from a set of
 * color stops. ImageData is little-endian RGBA, so packing this way lets sims
 * write straight into a Uint32Array view of the pixel buffer.
 */
export function buildRampLut(stops: readonly string[]): Uint32Array {
  const lut = new Uint32Array(256);
  const rgb = stops.map(hexToRgb);
  if (rgb.length === 0) return lut;
  if (rgb.length === 1) rgb.push(rgb[0]);

  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * (rgb.length - 1);
    const lo = Math.min(Math.floor(t), rgb.length - 2);
    const [r, g, b] = mixRgb(rgb[lo], rgb[lo + 1], t - lo);
    lut[i] =
      (255 << 24) | (Math.round(b * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(r * 255);
  }
  return lut;
}

/** Pack normalized rgb plus alpha into the 0xAABBGGRR layout ImageData expects. */
export function packRgba(r: number, g: number, b: number, a = 1): number {
  return (
    ((Math.round(Math.min(1, Math.max(0, a)) * 255) << 24) |
      (Math.round(Math.min(1, Math.max(0, b)) * 255) << 16) |
      (Math.round(Math.min(1, Math.max(0, g)) * 255) << 8) |
      Math.round(Math.min(1, Math.max(0, r)) * 255)) >>>
    0
  );
}
