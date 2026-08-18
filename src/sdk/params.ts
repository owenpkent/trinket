import type { Control, Params } from './types';
import { hexToRgb } from './color';

export type ParamValue = number | boolean | string;

/**
 * Backing store for a toy's declared controls.
 *
 * The toy reads through the narrow `Params` view; the shell drives the same
 * store from the other side to render and update widgets. Keeping both on one
 * object is what lets a toy call `params.set()` and have the slider move.
 */
export interface ParamStore {
  /** The view handed to the toy. */
  readonly view: Params;
  readonly controls: readonly Control[];
  get(id: string): ParamValue;
  set(id: string, value: ParamValue): void;
  /** Fire an action control. */
  trigger(id: string): void;
  /** Notified whenever any value changes, from either side. */
  subscribe(listener: (id: string, value: ParamValue) => void): () => void;
  /** Restore every control to its declared default. */
  reset(): void;
}

function defaultOf(control: Control): ParamValue {
  return control.type === 'action' ? 0 : control.default;
}

export function createParamStore(controls: readonly Control[] = []): ParamStore {
  const values = new Map<string, ParamValue>();
  const actions = new Map<string, Set<() => void>>();
  const listeners = new Set<(id: string, value: ParamValue) => void>();
  // Hex parsing is not free and colors rarely change, so keep the last result.
  const rgbCache = new Map<string, { hex: string; rgb: [number, number, number] }>();

  for (const control of controls) {
    values.set(control.id, defaultOf(control));
  }

  const missing = (id: string): never => {
    throw new Error(
      `Trinket: no control declared with id "${id}". Add it to the toy's controls array.`,
    );
  };

  const set = (id: string, value: ParamValue): void => {
    if (!values.has(id)) missing(id);
    if (values.get(id) === value) return;
    values.set(id, value);
    for (const listener of listeners) listener(id, value);
  };

  const view: Params = {
    num(id) {
      const value = values.get(id);
      if (value === undefined) missing(id);
      return typeof value === 'number' ? value : Number(value);
    },
    bool(id) {
      const value = values.get(id);
      if (value === undefined) missing(id);
      return Boolean(value);
    },
    str(id) {
      const value = values.get(id);
      if (value === undefined) missing(id);
      return String(value);
    },
    rgb(id) {
      const hex = view.str(id);
      const cached = rgbCache.get(id);
      if (cached && cached.hex === hex) return cached.rgb;
      const rgb = hexToRgb(hex);
      rgbCache.set(id, { hex, rgb });
      return rgb;
    },
    onAction(id, handler) {
      let handlers = actions.get(id);
      if (!handlers) {
        handlers = new Set();
        actions.set(id, handlers);
      }
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    set,
  };

  return {
    view,
    controls,
    get: (id) => values.get(id) ?? missing(id),
    set,
    trigger(id) {
      for (const handler of actions.get(id) ?? []) handler();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    reset() {
      for (const control of controls) set(control.id, defaultOf(control));
    },
  };
}
