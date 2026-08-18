import type { Pointer } from './types';

/**
 * Pointer tracking for a canvas.
 *
 * Trinket toys are mouse-driven by design: everything a toy can do must be
 * reachable with the pointer alone, so nothing here depends on the keyboard.
 * Pointer Events give us pen and touch for free.
 */
export interface PointerTracker {
  readonly state: Pointer;
  /** Roll dx/dy/speed forward and clear per-tick accumulators. Called by the loop. */
  commit(): void;
  dispose(): void;
}

export function createPointerTracker(canvas: HTMLCanvasElement): PointerTracker {
  const state: Pointer = {
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    dx: 0,
    dy: 0,
    speed: 0,
    down: false,
    primary: false,
    secondary: false,
    inside: false,
    wheel: 0,
  };

  // Raw position, written by events and sampled on commit. Sampling rather than
  // reacting keeps a high-rate mouse from starving the simulation.
  let rawX = 0;
  let rawY = 0;
  let wheelAccum = 0;
  let buttons = 0;
  let seeded = false;

  const toBuffer = (event: PointerEvent): void => {
    const rect = canvas.getBoundingClientRect();
    // getBoundingClientRect is in CSS pixels; the drawing buffer may be larger.
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
    rawX = (event.clientX - rect.left) * scaleX;
    rawY = (event.clientY - rect.top) * scaleY;
    if (!seeded) {
      // Avoid a phantom flick from (0,0) on the first sample.
      seeded = true;
      state.x = rawX;
      state.y = rawY;
      state.px = rawX;
      state.py = rawY;
    }
  };

  const onMove = (event: PointerEvent): void => {
    toBuffer(event);
    state.inside = true;
    buttons = event.buttons;
  };

  const onDown = (event: PointerEvent): void => {
    toBuffer(event);
    buttons = event.buttons;
    state.inside = true;
    // Keep receiving moves if the drag wanders off the canvas.
    canvas.setPointerCapture(event.pointerId);
  };

  const onUp = (event: PointerEvent): void => {
    buttons = event.buttons;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  };

  const onEnter = (): void => {
    state.inside = true;
  };

  const onLeave = (): void => {
    // A captured drag still counts as inside; only a genuine hover exit clears it.
    if (buttons === 0) state.inside = false;
  };

  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    wheelAccum += event.deltaY;
  };

  // Right-drag is a real input in several toys, so suppress the browser menu.
  const onContextMenu = (event: Event): void => event.preventDefault();

  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerenter', onEnter);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContextMenu);

  return {
    state,
    commit(): void {
      state.px = state.x;
      state.py = state.y;
      state.x = rawX;
      state.y = rawY;
      state.dx = state.x - state.px;
      state.dy = state.y - state.py;
      state.speed = Math.hypot(state.dx, state.dy);
      state.down = buttons !== 0;
      state.primary = (buttons & 1) !== 0;
      state.secondary = (buttons & 2) !== 0;
      state.wheel = wheelAccum;
      wheelAccum = 0;
    },
    dispose(): void {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerenter', onEnter);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
    },
  };
}
