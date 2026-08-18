/**
 * The Trinket SDK.
 *
 * Everything a toy is allowed to depend on lives behind this one import:
 *
 *   import { defineToy, clamp, damp } from '@sdk';
 *
 * Nothing else in src/ is part of the contract, so the shell is free to change
 * around you. If you need something that is not here, open an issue rather than
 * reaching into src/shell.
 */

export { defineToy } from './types';
export type {
  ActionControl,
  ColorControl,
  ContextFor,
  Control,
  Params,
  Pointer,
  RangeControl,
  Rng,
  SelectControl,
  Surface,
  ToggleControl,
  Toy2DContext,
  ToyContext,
  ToyDefinition,
  ToyGLContext,
  ToyInstance,
} from './types';

export { registerToy, allToys, getToy, clearToys } from './registry';
export { createRng } from './rng';
export { createLoop } from './loop';
export type { Loop, LoopHooks } from './loop';
export { createPointerTracker } from './pointer';
export type { PointerTracker } from './pointer';
export { createParamStore } from './params';
export type { ParamStore, ParamValue } from './params';
export { createFullscreenShader, createProgram } from './gl';
export type { FullscreenShader } from './gl';
export { buildRampLut, hexToRgb, mixRgb, packRgba, rgbToHex } from './color';
export { TAU, clamp, damp, lerp, remap, smoothstep, wrap } from './math';
