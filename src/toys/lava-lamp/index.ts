import { clamp, createFullscreenShader, defineToy, TAU, type ToyInstance } from '@sdk';
import fragmentSource from './lava.frag?raw';

/** Hard limit baked into the shader's uniform array. */
const MAX_BLOBS = 48;

interface Blob {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Radius in device pixels, scaled at render time by the size control. */
  r: number;
  /** 0 is cold and sinking, 1 is hot and rising. */
  temp: number;
}

export default defineToy({
  id: 'lava-lamp',
  name: 'Lava Lamp',
  blurb: 'Wax blobs heated from below. Drag to stir them, right-drag to chill a spot.',
  author: 'OK Studio',
  tags: ['fluid', 'webgl', 'slow'],
  accent: '#ff7a3d',
  surface: 'webgl',
  controls: [
    { id: 'count', type: 'range', label: 'Blobs', min: 4, max: MAX_BLOBS, step: 1, default: 16 },
    {
      id: 'size',
      type: 'range',
      label: 'Size',
      min: 0.5,
      max: 2,
      step: 0.05,
      default: 1,
      unit: 'x',
    },
    {
      id: 'heat',
      type: 'range',
      label: 'Heat',
      min: 0.1,
      max: 2.5,
      step: 0.05,
      default: 1,
      unit: 'x',
    },
    {
      id: 'viscosity',
      type: 'range',
      label: 'Viscosity',
      min: 0.2,
      max: 4,
      step: 0.05,
      default: 1.4,
      help: 'How much the wax resists moving. High values look like cold honey.',
    },
    { id: 'glow', type: 'range', label: 'Glow', min: 0, max: 1.5, step: 0.05, default: 0.7 },
    { id: 'hot', type: 'color', label: 'Hot', default: '#ff8a2b' },
    { id: 'cool', type: 'color', label: 'Cool', default: '#b3184d' },
    { id: 'glass', type: 'color', label: 'Glass', default: '#12233a' },
    { id: 'shake', type: 'action', label: 'Shake it' },
  ],
  setup(ctx) {
    const { gl, params, rng, pointer } = ctx;
    const shader = createFullscreenShader(gl, fragmentSource);
    // Flat xyzw per blob, uploaded once per frame.
    const packed = new Float32Array(MAX_BLOBS * 4);
    const blobs: Blob[] = [];

    const spawn = (): Blob => ({
      x: rng.range(0.15, 0.85) * ctx.width,
      y: rng.range(0.15, 0.9) * ctx.height,
      vx: 0,
      vy: 0,
      // Radius is relative to the short edge so the lamp looks the same at any size.
      r: rng.range(0.028, 0.058) * Math.min(ctx.width, ctx.height),
      temp: rng.next(),
    });

    const syncCount = (): void => {
      const want = Math.round(params.num('count'));
      while (blobs.length < want) blobs.push(spawn());
      if (blobs.length > want) blobs.length = want;
    };
    syncCount();

    params.onAction('shake', () => {
      for (const blob of blobs) {
        const angle = rng.range(0, TAU);
        const kick = rng.range(0.4, 1) * Math.min(ctx.width, ctx.height);
        blob.vx += Math.cos(angle) * kick;
        blob.vy += Math.sin(angle) * kick;
      }
    });

    const update = (dt: number): void => {
      syncCount();
      const heat = params.num('heat');
      const viscosity = params.num('viscosity');
      const short = Math.min(ctx.width, ctx.height);
      const heaterY = ctx.height * 0.88;
      const chillY = ctx.height * 0.12;

      for (const blob of blobs) {
        // Temperature is the whole engine: the heater at the base warms whatever
        // sinks into it, the cool top steals it back, and buoyancy follows.
        if (blob.y > heaterY) blob.temp += dt * 0.55 * heat;
        else if (blob.y < chillY) blob.temp -= dt * 0.5;
        blob.temp -= dt * 0.06;
        blob.temp = clamp(blob.temp, 0, 1);

        // Centred on 0.5 so cold wax genuinely falls instead of merely rising slower.
        blob.vy -= (blob.temp - 0.5) * short * 0.9 * heat * dt;
      }

      // Surface tension: a firm shove once they overlap, a much weaker pull just
      // outside that. The two have to stay lopsided. Make the pull comparable to
      // the shove and every blob in the lamp ends up in one permanent lump.
      for (let i = 0; i < blobs.length; i++) {
        const a = blobs[i];
        for (let j = i + 1; j < blobs.length; j++) {
          const b = blobs[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 1e-4;
          const touch = a.r + b.r;
          if (dist > touch * 1.5) continue;

          const nx = dx / dist;
          const ny = dy / dist;
          const force =
            dist < touch
              ? -(1 - dist / touch) * short * 3.4 // push apart
              : (1 - (dist - touch) / (touch * 0.5)) * short * 0.11; // draw together

          a.vx += nx * force * dt;
          a.vy += ny * force * dt;
          b.vx -= nx * force * dt;
          b.vy -= ny * force * dt;

          // Blobs in contact trade a little heat, so a hot one drifting past a
          // cold one wakes it up. Too much and the whole lamp reaches one
          // temperature and stops circulating.
          const exchange = (a.temp - b.temp) * dt * 0.35;
          a.temp -= exchange;
          b.temp += exchange;
        }
      }

      if (pointer.inside && pointer.down) {
        const reach = short * 0.28;
        const stirring = pointer.primary;
        for (const blob of blobs) {
          const dx = blob.x - pointer.x;
          const dy = blob.y - pointer.y;
          const dist = Math.hypot(dx, dy);
          if (dist > reach) continue;
          const falloff = 1 - dist / reach;
          if (stirring) {
            // Left-drag: shove wax out of the way and warm it with the friction.
            const push = (falloff * short * 2.4) / Math.max(dist, short * 0.05);
            blob.vx += dx * push * dt;
            blob.vy += dy * push * dt;
            blob.vx += pointer.dx * falloff * 6 * dt * 60;
            blob.vy += pointer.dy * falloff * 6 * dt * 60;
            blob.temp = clamp(blob.temp + falloff * dt * 0.5, 0, 1);
          } else {
            // Right-drag: a cold finger on the glass. The wax there sinks.
            blob.temp = clamp(blob.temp - falloff * dt * 1.4, 0, 1);
          }
        }
      }

      const decay = Math.exp(-viscosity * dt);
      const scale = params.num('size');
      for (const blob of blobs) {
        blob.vx *= decay;
        blob.vy *= decay;
        blob.x += blob.vx * dt;
        blob.y += blob.vy * dt;

        // The vessel. Bounce is heavily damped so wax creeps down the glass.
        const pad = blob.r * scale * 0.65;
        if (blob.x < pad) {
          blob.x = pad;
          blob.vx = Math.abs(blob.vx) * 0.25;
        } else if (blob.x > ctx.width - pad) {
          blob.x = ctx.width - pad;
          blob.vx = -Math.abs(blob.vx) * 0.25;
        }
        if (blob.y < pad) {
          blob.y = pad;
          blob.vy = Math.abs(blob.vy) * 0.25;
        } else if (blob.y > ctx.height - pad) {
          blob.y = ctx.height - pad;
          blob.vy = -Math.abs(blob.vy) * 0.25;
        }
      }
    };

    const render = (): void => {
      const scale = params.num('size');
      for (let i = 0; i < blobs.length; i++) {
        const blob = blobs[i];
        packed[i * 4] = blob.x;
        packed[i * 4 + 1] = blob.y;
        packed[i * 4 + 2] = blob.r * scale;
        packed[i * 4 + 3] = blob.temp;
      }

      const [hr, hg, hb] = params.rgb('hot');
      const [cr, cg, cb] = params.rgb('cool');
      const [gr, gg, gb] = params.rgb('glass');

      shader.use(ctx.width, ctx.height);
      gl.uniform2f(shader.uniform('uRes'), ctx.width, ctx.height);
      gl.uniform1i(shader.uniform('uCount'), blobs.length);
      gl.uniform4fv(shader.uniform('uBlobs'), packed);
      gl.uniform3f(shader.uniform('uHot'), hr, hg, hb);
      gl.uniform3f(shader.uniform('uCool'), cr, cg, cb);
      gl.uniform3f(shader.uniform('uGlass'), gr, gg, gb);
      gl.uniform1f(shader.uniform('uGlow'), params.num('glow'));
      gl.uniform1f(shader.uniform('uTime'), ctx.time);
      shader.draw();
    };

    const instance: ToyInstance = {
      update,
      render,
      resize(): void {
        // Keep the wax proportional to the new window instead of restarting.
        const short = Math.min(ctx.width, ctx.height);
        for (const blob of blobs) {
          blob.x = clamp(blob.x, 0, ctx.width);
          blob.y = clamp(blob.y, 0, ctx.height);
          blob.r = clamp(blob.r, 0.024 * short, 0.07 * short);
        }
      },
      dispose(): void {
        shader.dispose();
      },
    };
    return instance;
  },
});
