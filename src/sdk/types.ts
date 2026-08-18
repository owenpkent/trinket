/**
 * The Trinket toy API.
 *
 * A toy is a self-contained fidget: it owns a canvas, gets a fixed-step update
 * loop, a live pointer, and whatever controls it declares. The shell builds the
 * UI, handles resizing, and manages the lifecycle. A toy never touches the DOM
 * outside its own canvas.
 *
 * See docs/TOY_API.md for a walkthrough.
 */

/** Which drawing context a toy wants. */
export type Surface = '2d' | 'webgl';

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

interface ControlBase {
  /** Stable key used to read the value, as in params.num('heat'). */
  id: string;
  /** Shown next to the widget. */
  label: string;
  /** Optional one-liner shown as a tooltip. */
  help?: string;
}

export interface RangeControl extends ControlBase {
  type: 'range';
  min: number;
  max: number;
  step?: number;
  default: number;
  /** Optional unit suffix shown beside the readout, such as x or %. */
  unit?: string;
}

export interface ToggleControl extends ControlBase {
  type: 'toggle';
  default: boolean;
}

export interface SelectControl extends ControlBase {
  type: 'select';
  options: ReadonlyArray<{ value: string; label: string }>;
  default: string;
}

export interface ColorControl extends ControlBase {
  type: 'color';
  /** CSS hex, such as #ff7a3d. */
  default: string;
}

/** A momentary button. Read it with params.onAction(id, fn). */
export interface ActionControl extends ControlBase {
  type: 'action';
}

export type Control = RangeControl | ToggleControl | SelectControl | ColorControl | ActionControl;

/* ------------------------------------------------------------------ */
/* Runtime services handed to a toy                                    */
/* ------------------------------------------------------------------ */

/** Live pointer state, refreshed before every update tick. */
export interface Pointer {
  /** Position in device pixels, matching the drawing buffer. */
  x: number;
  y: number;
  /** Position at the previous tick. */
  px: number;
  py: number;
  /** Movement since the previous tick, in device pixels. */
  dx: number;
  dy: number;
  /** Magnitude of (dx, dy), in device pixels per tick. */
  speed: number;
  /** True while any button is held. */
  down: boolean;
  /** True while the primary (left) button is held. */
  primary: boolean;
  /** True while the secondary (right) button is held. */
  secondary: boolean;
  /** True while the cursor is over the canvas. */
  inside: boolean;
  /** Wheel movement accumulated since the last tick, then reset to 0. */
  wheel: number;
}

/** Typed reader for the values behind a toy's declared controls. */
export interface Params {
  num(id: string): number;
  bool(id: string): boolean;
  str(id: string): string;
  /** Hex color as normalized rgb in 0..1. */
  rgb(id: string): [number, number, number];
  /** Subscribe to an action control. Returns an unsubscribe function. */
  onAction(id: string, handler: () => void): () => void;
  /** Set a value from inside the toy. The UI follows. */
  set(id: string, value: number | boolean | string): void;
}

/** Small deterministic PRNG so sims can be seeded and tested. */
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [min, max). */
  range(min: number, max: number): number;
  /** Integer in [min, max). */
  int(min: number, max: number): number;
  /** Approximately standard-normal. */
  normal(): number;
  pick<T>(items: ReadonlyArray<T>): T;
}

interface BaseContext {
  canvas: HTMLCanvasElement;
  /** Drawing buffer size, in device pixels. Use this for simulation extents. */
  width: number;
  height: number;
  /** Layout size, in CSS pixels. */
  cssWidth: number;
  cssHeight: number;
  /** Device pixel ratio the buffer was sized with. */
  dpr: number;
  pointer: Pointer;
  params: Params;
  rng: Rng;
  /** Seconds since this toy was created. */
  readonly time: number;
}

export interface Toy2DContext extends BaseContext {
  surface: '2d';
  c2d: CanvasRenderingContext2D;
}

export interface ToyGLContext extends BaseContext {
  surface: 'webgl';
  gl: WebGL2RenderingContext;
}

export type ContextFor<S extends Surface> = S extends '2d' ? Toy2DContext : ToyGLContext;

export type ToyContext = Toy2DContext | ToyGLContext;

/* ------------------------------------------------------------------ */
/* The toy itself                                                      */
/* ------------------------------------------------------------------ */

/** The running instance returned by setup. */
export interface ToyInstance {
  /**
   * Advance the simulation by exactly dt seconds. Called zero or more times per
   * frame so the sim runs at a steady rate regardless of display refresh.
   */
  update?(dt: number): void;
  /**
   * Draw. alpha is the 0..1 blend position between the last two update ticks,
   * for toys that want to interpolate. Ignore it if you do not.
   */
  render(alpha: number): void;
  /** The canvas was resized. Context width and height are already updated. */
  resize?(): void;
  /** Release GPU resources and timers. Always called before the toy is swapped out. */
  dispose?(): void;
}

export interface ToyDefinition<S extends Surface = Surface> {
  /** URL-safe, stable, unique. Used in the hash route, as in #/lava-lamp. */
  id: string;
  name: string;
  /** One sentence for the shelf card. */
  blurb: string;
  /** Who made it. Shown on the card. */
  author: string;
  /** Free-form, used for filtering. */
  tags?: readonly string[];
  /** CSS color used to tint the toy's card and its control panel. */
  accent: string;
  surface: S;
  /** Declared up front. The shell renders the panel for you. */
  controls?: readonly Control[];
  /**
   * Fixed simulation rate in ticks per second. Defaults to 60. Lower it for
   * expensive sims: the shell still renders every frame.
   */
  tickRate?: number;
  /** Build the toy. Called once per activation, after the canvas is sized. */
  setup(ctx: ContextFor<S>): ToyInstance;
}

/** Identity helper that pins the surface type so setup gets the right context. */
export function defineToy<S extends Surface>(def: ToyDefinition<S>): ToyDefinition<S> {
  return def;
}
