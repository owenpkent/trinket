export interface LoopHooks {
  /** Called once per fixed tick, before update. */
  beforeTick?(): void;
  /** Fixed-step simulation step, in seconds. */
  update(dt: number): void;
  /** Called once per animation frame. alpha is the 0..1 position between ticks. */
  render(alpha: number): void;
}

export interface Loop {
  start(): void;
  stop(): void;
  readonly running: boolean;
  /** Smoothed frames per second, for the shell's readout. */
  readonly fps: number;
}

/**
 * Fixed-timestep loop with an accumulator.
 *
 * Sand and fluid sims go unstable if dt wobbles, so simulation runs at a fixed
 * rate and rendering happens as often as the display allows. Long stalls (a
 * backgrounded tab, a dragged window) are clamped rather than replayed, which
 * would otherwise produce a spiral of death.
 */
export function createLoop(hooks: LoopHooks, tickRate = 60): Loop {
  const step = 1 / tickRate;
  const maxFrame = Math.max(step * 5, 0.25);

  let handle = 0;
  let running = false;
  let last = 0;
  let accumulator = 0;
  let fps = 0;

  const frame = (now: number): void => {
    handle = requestAnimationFrame(frame);

    const seconds = now / 1000;
    let elapsed = seconds - last;
    last = seconds;
    if (!Number.isFinite(elapsed) || elapsed < 0) elapsed = step;
    if (elapsed > maxFrame) elapsed = maxFrame;

    fps =
      fps === 0 ? 1 / Math.max(elapsed, 1e-4) : fps * 0.92 + (1 / Math.max(elapsed, 1e-4)) * 0.08;

    accumulator += elapsed;
    while (accumulator >= step) {
      hooks.beforeTick?.();
      hooks.update(step);
      accumulator -= step;
    }

    hooks.render(accumulator / step);
  };

  return {
    start(): void {
      if (running) return;
      running = true;
      accumulator = 0;
      last = performance.now() / 1000;
      handle = requestAnimationFrame(frame);
    },
    stop(): void {
      if (!running) return;
      running = false;
      cancelAnimationFrame(handle);
    },
    get running() {
      return running;
    },
    get fps() {
      return fps;
    },
  };
}
