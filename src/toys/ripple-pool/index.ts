import { clamp, defineToy, hexToRgb, packRgba, type ToyInstance } from '@sdk';

/**
 * A height field solved with the standard two-buffer wave equation, then lit
 * and refracted per pixel. The sim is cheap; almost all of the character comes
 * out of the shading pass.
 */
export default defineToy({
  id: 'ripple-pool',
  name: 'Ripple Pool',
  blurb: 'Still water. Move the mouse to disturb it, click for a heavier drop.',
  author: 'OK Studio',
  tags: ['waves', '2d', 'calm'],
  accent: '#49b8ff',
  surface: '2d',
  controls: [
    {
      id: 'theme',
      type: 'select',
      label: 'Bottom',
      default: 'pool',
      options: [
        { value: 'pool', label: 'Tiled pool' },
        { value: 'ink', label: 'Dark ink' },
        { value: 'chrome', label: 'Studio chrome' },
      ],
    },
    { id: 'tint', type: 'color', label: 'Tint', default: '#1e6f9e' },
    {
      id: 'damping',
      type: 'range',
      label: 'Stillness',
      min: 0.9,
      max: 0.999,
      step: 0.001,
      default: 0.985,
      help: 'How long a ripple survives. Push it to the top and the water never settles.',
    },
    {
      id: 'force',
      type: 'range',
      label: 'Touch',
      min: 0.2,
      max: 3,
      step: 0.05,
      default: 1,
      unit: 'x',
    },
    { id: 'refract', type: 'range', label: 'Refraction', min: 0, max: 3, step: 0.05, default: 1.2 },
    {
      id: 'detail',
      type: 'range',
      label: 'Detail',
      min: 2,
      max: 6,
      step: 1,
      default: 3,
      help: 'Pixels per simulation cell. Lower is sharper and slower.',
    },
    { id: 'rain', type: 'toggle', label: 'Rain', default: false },
    { id: 'still', type: 'action', label: 'Settle the water' },
  ],
  setup(ctx) {
    const { c2d, params, rng, pointer } = ctx;

    let scale = 0;
    let gridW = 0;
    let gridH = 0;
    let current = new Float32Array(0);
    let previous = new Float32Array(0);
    let background = new Uint32Array(0);

    const buffer = document.createElement('canvas');
    const bufferCtx = buffer.getContext('2d', { alpha: false });
    if (!bufferCtx) throw new Error('Trinket: could not create the water back buffer.');
    let image = bufferCtx.createImageData(1, 1);
    let pixels = new Uint32Array(image.data.buffer);

    let backgroundKey = '';

    const paintBackground = (): void => {
      const theme = params.str('theme');
      const hex = params.str('tint');
      const key = `${theme}:${hex}:${gridW}x${gridH}`;
      if (key === backgroundKey) return;
      backgroundKey = key;

      const [tr, tg, tb] = hexToRgb(hex);
      const tile = Math.max(6, Math.round(Math.min(gridW, gridH) / 9));

      for (let y = 0; y < gridH; y++) {
        for (let x = 0; x < gridW; x++) {
          const u = x / gridW;
          const v = y / gridH;
          let r: number;
          let g: number;
          let b: number;

          if (theme === 'pool') {
            // Grout lines are what make refraction legible: straight edges bend
            // visibly, a flat colour does not.
            const onGrout = x % tile < 1.5 || y % tile < 1.5;
            const shade = onGrout ? 0.45 : 0.85 + 0.15 * Math.sin(x * 0.13) * Math.cos(y * 0.11);
            const depth = 0.65 + 0.5 * v;
            r = tr * shade * depth;
            g = tg * shade * depth;
            b = tb * shade * depth;
          } else if (theme === 'chrome') {
            // Soft horizontal bands, like a row of studio lights overhead.
            const band = 0.5 + 0.5 * Math.sin(v * 9.5 + Math.sin(u * 2.0) * 0.6);
            const level = 0.1 + 0.85 * Math.pow(band, 2.2);
            r = level * (0.86 + tr * 0.2);
            g = level * (0.9 + tg * 0.2);
            b = level * (1.0 + tb * 0.2);
          } else {
            const vignette = 1 - 0.75 * ((u - 0.5) ** 2 + (v - 0.5) ** 2);
            r = tr * 0.1 * vignette;
            g = tg * 0.11 * vignette;
            b = tb * 0.14 * vignette;
          }

          background[y * gridW + x] = packRgba(r, g, b);
        }
      }
    };

    const allocate = (): void => {
      const detail = Math.round(params.num('detail'));
      const width = Math.max(16, Math.floor(ctx.width / detail));
      const height = Math.max(16, Math.floor(ctx.height / detail));
      if (detail === scale && width === gridW && height === gridH) return;

      // Keep the old field so the water survives the reallocation. Resizing a
      // window should not flatten the pool, and the very first layout pass often
      // measures the container before it has settled, which would otherwise wipe
      // whatever was already rippling.
      const stale = { current, previous, w: gridW, h: gridH };

      scale = detail;
      gridW = width;
      gridH = height;
      const count = width * height;
      current = new Float32Array(count);
      previous = new Float32Array(count);
      background = new Uint32Array(count);

      if (stale.w > 0 && stale.h > 0) {
        for (let y = 0; y < height; y++) {
          const sy = Math.min(stale.h - 1, Math.floor((y / height) * stale.h));
          for (let x = 0; x < width; x++) {
            const sx = Math.min(stale.w - 1, Math.floor((x / width) * stale.w));
            current[y * width + x] = stale.current[sy * stale.w + sx];
            previous[y * width + x] = stale.previous[sy * stale.w + sx];
          }
        }
      }

      buffer.width = width;
      buffer.height = height;
      image = bufferCtx.createImageData(width, height);
      pixels = new Uint32Array(image.data.buffer);
      backgroundKey = '';
      paintBackground();
    };

    allocate();

    params.onAction('still', () => {
      current.fill(0);
      previous.fill(0);
    });

    /** Press the surface down over a soft circular footprint. */
    const disturb = (cx: number, cy: number, radius: number, amount: number): void => {
      const minX = Math.max(1, Math.floor(cx - radius));
      const maxX = Math.min(gridW - 2, Math.ceil(cx + radius));
      const minY = Math.max(1, Math.floor(cy - radius));
      const maxY = Math.min(gridH - 2, Math.ceil(cy + radius));
      const r2 = radius * radius;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const d2 = dx * dx + dy * dy;
          if (d2 > r2) continue;
          // Cosine falloff avoids the hard rim a linear one leaves behind.
          const falloff = 0.5 + 0.5 * Math.cos((Math.sqrt(d2) / radius) * Math.PI);
          current[y * gridW + x] -= amount * falloff;
        }
      }
    };

    // Arrive to water that is already moving. Opening onto a dead-flat surface
    // reads as a broken toy rather than a calm one.
    for (let i = 0; i < 4; i++) {
      disturb(rng.range(8, gridW - 8), rng.range(8, gridH - 8), rng.range(5, 9), 15);
    }

    const update = (): void => {
      allocate();
      paintBackground();

      const damping = params.num('damping');
      const force = params.num('force');

      if (pointer.inside) {
        const x = pointer.x / scale;
        const y = pointer.y / scale;
        const px = pointer.px / scale;
        const py = pointer.py / scale;
        const travelled = Math.hypot(x - px, y - py);

        if (pointer.down) {
          // A held button is a finger in the water: a steady, heavy dent.
          disturb(x, y, Math.max(4, 0.022 * gridW), 21 * force);
        } else if (travelled > 0.25) {
          // Drawing a wake along the path keeps fast movement from stippling.
          const steps = Math.min(24, Math.max(1, Math.ceil(travelled)));
          const strength = clamp(travelled * 0.6, 0.5, 9) * force;
          for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            disturb(px + (x - px) * t, py + (y - py) * t, 3.6, strength / steps);
          }
        }
      }

      if (params.bool('rain') && rng.next() < 0.22) {
        disturb(rng.range(6, gridW - 6), rng.range(6, gridH - 6), rng.range(3, 6), 17 * force);
      }

      // Wave equation. next = neighbour average * 2 - previous, damped.
      // Borders are left at zero, which reflects waves back off the walls.
      for (let y = 1; y < gridH - 1; y++) {
        const row = y * gridW;
        for (let x = 1; x < gridW - 1; x++) {
          const i = row + x;
          const value =
            (current[i - 1] + current[i + 1] + current[i - gridW] + current[i + gridW]) * 0.5 -
            previous[i];
          previous[i] = value * damping;
        }
      }

      const swap = current;
      current = previous;
      previous = swap;
    };

    const render = (): void => {
      // The gradient at a fresh drop is tens of units, so the offset multiplier
      // has to stay small or the sampler jumps halfway across the pool and the
      // ripple reads as noise instead of glass.
      const refract = params.num('refract') * 0.4;
      const isChrome = params.str('theme') === 'chrome';
      // Light from the upper left, the direction every eye reads as "above".
      const lx = 0.38;
      const ly = 0.46;
      const lz = 0.8;
      const specularPower = isChrome ? 64 : 26;
      const specularGain = isChrome ? 1.5 : 0.85;

      for (let y = 1; y < gridH - 1; y++) {
        const row = y * gridW;
        for (let x = 1; x < gridW - 1; x++) {
          const i = row + x;
          // Central differences give the surface slope, which is both the
          // refraction offset and the normal used for lighting.
          const dx = current[i - 1] - current[i + 1];
          const dy = current[i - gridW] - current[i + gridW];

          const sx = clamp(x + dx * refract, 0, gridW - 1) | 0;
          const sy = clamp(y + dy * refract, 0, gridH - 1) | 0;
          const source = background[sy * gridW + sx];

          const inverse = 1 / Math.sqrt(dx * dx + dy * dy + 1);
          const nx = dx * inverse;
          const ny = dy * inverse;
          const nz = inverse;
          const ndl = clamp(nx * lx + ny * ly + nz * lz, 0, 1);
          const shade = 0.72 + 0.55 * ndl;
          const specular = Math.pow(ndl, specularPower) * specularGain * 255;

          const r = (source & 255) * shade + specular;
          const g = ((source >> 8) & 255) * shade + specular;
          const b = ((source >> 16) & 255) * shade + specular;

          pixels[i] =
            (255 << 24) | (Math.min(255, b) << 16) | (Math.min(255, g) << 8) | Math.min(255, r);
        }
      }

      bufferCtx.putImageData(image, 0, 0);
      // Smoothing is welcome here: water has no pixels.
      c2d.imageSmoothingEnabled = true;
      c2d.imageSmoothingQuality = 'high';
      c2d.drawImage(buffer, 0, 0, gridW, gridH, 0, 0, ctx.width, ctx.height);
    };

    const instance: ToyInstance = {
      update,
      render,
      resize: allocate,
    };
    return instance;
  },
});
