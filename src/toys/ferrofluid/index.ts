import { clamp, createFullscreenShader, defineToy, type ToyInstance } from '@sdk';
import fragmentSource from './ferro.frag?raw';

/** Hard limit baked into the shader's uniform array. */
const MAX_PARTICLES = 64;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** 0..1 pull from the magnet, which is what grows the spikes. */
  influence: number;
}

export default defineToy({
  id: 'ferrofluid',
  name: 'Ferrofluid',
  blurb: 'Magnetic goo. It reaches for the cursor and spikes when you hold the button.',
  author: 'OK Studio',
  tags: ['fluid', 'webgl', 'magnetic'],
  accent: '#6f8cff',
  surface: 'webgl',
  controls: [
    {
      id: 'count',
      type: 'range',
      label: 'Volume',
      min: 8,
      max: MAX_PARTICLES,
      step: 1,
      default: 28,
    },
    {
      id: 'magnet',
      type: 'range',
      label: 'Magnet',
      min: 0,
      max: 3,
      step: 0.05,
      default: 1.2,
      unit: 'x',
    },
    {
      id: 'spike',
      type: 'range',
      label: 'Spikes',
      min: 0,
      max: 6,
      step: 0.1,
      default: 3,
      help: 'How far the goo stretches along the field lines. This is the whole trick.',
    },
    {
      id: 'gravity',
      type: 'range',
      label: 'Gravity',
      min: 0,
      max: 2.5,
      step: 0.05,
      default: 1,
      unit: 'x',
    },
    {
      id: 'cohesion',
      type: 'range',
      label: 'Cohesion',
      min: 0.2,
      max: 3,
      step: 0.05,
      default: 1.1,
      help: 'How hard the goo holds itself together. Low values let it splatter.',
    },
    { id: 'sheen', type: 'color', label: 'Sheen', default: '#6f8cff' },
    { id: 'warm', type: 'color', label: 'Highlight', default: '#ffd9a8' },
    { id: 'scatter', type: 'action', label: 'Scatter' },
  ],
  setup(ctx) {
    const { gl, params, rng, pointer } = ctx;
    const shader = createFullscreenShader(gl, fragmentSource);
    const packed = new Float32Array(MAX_PARTICLES * 4);
    const particles: Particle[] = [];

    const spawn = (): Particle => ({
      x: ctx.width * 0.5 + rng.normal() * ctx.width * 0.08,
      y: ctx.height * 0.7 + rng.normal() * ctx.height * 0.05,
      vx: 0,
      vy: 0,
      r: rng.range(0.026, 0.044) * Math.min(ctx.width, ctx.height),
      influence: 0,
    });

    const syncCount = (): void => {
      const want = Math.round(params.num('count'));
      while (particles.length < want) particles.push(spawn());
      if (particles.length > want) particles.length = want;
    };
    syncCount();

    params.onAction('scatter', () => {
      const short = Math.min(ctx.width, ctx.height);
      for (const particle of particles) {
        particle.vx += rng.normal() * short * 1.4;
        particle.vy -= rng.range(0.4, 1.6) * short;
      }
    });

    const update = (dt: number): void => {
      syncCount();
      const short = Math.min(ctx.width, ctx.height);
      const gravity = params.num('gravity') * short * 1.6;
      const cohesion = params.num('cohesion');
      const magnetStrength = params.num('magnet');

      // Cohesion is modelled against the centre of mass rather than pairwise,
      // which is what keeps the goo behaving like one body when it stretches.
      let comX = 0;
      let comY = 0;
      for (const particle of particles) {
        comX += particle.x;
        comY += particle.y;
      }
      comX /= particles.length;
      comY /= particles.length;

      const magnetActive = pointer.inside && magnetStrength > 0;
      const reach = short * 0.55;
      const repelling = pointer.secondary;
      const grabbing = pointer.primary;

      for (const particle of particles) {
        particle.vy += gravity * dt;

        const cx = comX - particle.x;
        const cy = comY - particle.y;
        const cDist = Math.hypot(cx, cy) || 1e-4;
        // Linear spring, so distant blobs are reeled in hard and nearby ones
        // are left alone. A 1/r law here makes the mass collapse to a point.
        const pull = cohesion * short * 3.2 * Math.min(1, cDist / (short * 0.35));
        particle.vx += (cx / cDist) * pull * dt;
        particle.vy += (cy / cDist) * pull * dt;

        let influence = 0;
        if (magnetActive) {
          const mx = pointer.x - particle.x;
          const my = pointer.y - particle.y;
          const dist = Math.max(Math.hypot(mx, my), short * 0.03);
          // Clamped inverse square. Without the clamp the nearest particle gets
          // launched through the wall the instant the cursor touches it.
          const falloff = Math.min(1, (reach / dist) ** 2);
          influence = clamp(falloff * magnetStrength * (grabbing ? 1.6 : 1), 0, 1);
          const sign = repelling ? -1 : 1;
          const force = sign * falloff * magnetStrength * short * (grabbing ? 9 : 4.5);
          particle.vx += (mx / dist) * force * dt;
          particle.vy += (my / dist) * force * dt;
        }
        // Spikes ease in and out instead of snapping, which reads as viscosity.
        particle.influence += (influence - particle.influence) * Math.min(1, dt * 9);
      }

      // Short-range repulsion so the mass has volume instead of collapsing.
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 1e-4;
          const minimum = (a.r + b.r) * 0.72;
          if (dist >= minimum) continue;
          const push = (1 - dist / minimum) * short * 7;
          const nx = dx / dist;
          const ny = dy / dist;
          a.vx -= nx * push * dt;
          a.vy -= ny * push * dt;
          b.vx += nx * push * dt;
          b.vy += ny * push * dt;
        }
      }

      const drag = Math.exp(-2.6 * dt);
      for (const particle of particles) {
        particle.vx *= drag;
        particle.vy *= drag;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;

        const pad = particle.r * 0.55;
        if (particle.x < pad) {
          particle.x = pad;
          particle.vx = Math.abs(particle.vx) * 0.3;
        } else if (particle.x > ctx.width - pad) {
          particle.x = ctx.width - pad;
          particle.vx = -Math.abs(particle.vx) * 0.3;
        }
        if (particle.y < pad) {
          particle.y = pad;
          particle.vy = Math.abs(particle.vy) * 0.3;
        } else if (particle.y > ctx.height - pad) {
          particle.y = ctx.height - pad;
          particle.vy = -Math.abs(particle.vy) * 0.3;
          // Friction against the floor, so a settled puddle actually settles.
          particle.vx *= 0.86;
        }
      }
    };

    const render = (): void => {
      for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];
        packed[i * 4] = particle.x;
        packed[i * 4 + 1] = particle.y;
        packed[i * 4 + 2] = particle.r;
        packed[i * 4 + 3] = particle.influence;
      }

      const [sr, sg, sb] = params.rgb('sheen');
      const [wr, wg, wb] = params.rgb('warm');

      shader.use(ctx.width, ctx.height);
      gl.uniform2f(shader.uniform('uRes'), ctx.width, ctx.height);
      gl.uniform1i(shader.uniform('uCount'), particles.length);
      gl.uniform4fv(shader.uniform('uParts'), packed);
      gl.uniform2f(
        shader.uniform('uMagnet'),
        pointer.inside ? pointer.x : ctx.width * 0.5,
        pointer.inside ? pointer.y : -ctx.height,
      );
      gl.uniform1f(shader.uniform('uSpike'), params.num('spike'));
      gl.uniform3f(shader.uniform('uSheen'), sr, sg, sb);
      gl.uniform3f(shader.uniform('uWarm'), wr, wg, wb);
      gl.uniform1f(shader.uniform('uTime'), ctx.time);
      shader.draw();
    };

    const instance: ToyInstance = {
      update,
      render,
      resize(): void {
        const short = Math.min(ctx.width, ctx.height);
        for (const particle of particles) {
          particle.x = clamp(particle.x, 0, ctx.width);
          particle.y = clamp(particle.y, 0, ctx.height);
          particle.r = clamp(particle.r, 0.022 * short, 0.05 * short);
        }
      },
      dispose(): void {
        shader.dispose();
      },
    };
    return instance;
  },
});
