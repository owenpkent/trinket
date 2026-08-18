import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRampLut, hexToRgb, mixRgb, packRgba, rgbToHex } from '../src/sdk/color';
import { clamp, damp, lerp, remap, smoothstep, wrap } from '../src/sdk/math';
import { createParamStore } from '../src/sdk/params';
import { createRng } from '../src/sdk/rng';
import { allToys, clearToys, getToy, registerToy } from '../src/sdk/registry';
import { defineToy } from '../src/sdk/types';

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const first = [a.next(), a.next(), a.next()];
    const second = [b.next(), b.next(), b.next()];
    expect(first).toEqual(second);
  });

  it('produces different streams for different seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('stays inside the requested bounds', () => {
    const rng = createRng(7);
    for (let i = 0; i < 500; i++) {
      const value = rng.range(-3, 9);
      expect(value).toBeGreaterThanOrEqual(-3);
      expect(value).toBeLessThan(9);

      const integer = rng.int(0, 4);
      expect(Number.isInteger(integer)).toBe(true);
      expect(integer).toBeGreaterThanOrEqual(0);
      expect(integer).toBeLessThan(4);
    }
  });

  it('picks only from the given list', () => {
    const rng = createRng(3);
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 100; i++) {
      expect(items).toContain(rng.pick(items));
    }
  });
});

describe('color', () => {
  it('parses long and short hex', () => {
    expect(hexToRgb('#ffffff')).toEqual([1, 1, 1]);
    expect(hexToRgb('#000')).toEqual([0, 0, 0]);
    expect(hexToRgb('f00')).toEqual([1, 0, 0]);
  });

  it('falls back to white on malformed input rather than throwing', () => {
    expect(hexToRgb('nonsense')).toEqual([1, 1, 1]);
  });

  it('round-trips through rgbToHex', () => {
    expect(rgbToHex(...hexToRgb('#3a7fd5'))).toBe('#3a7fd5');
  });

  it('mixes linearly', () => {
    expect(mixRgb([0, 0, 0], [1, 1, 1], 0.5)).toEqual([0.5, 0.5, 0.5]);
  });

  it('packs into the little-endian RGBA layout ImageData expects', () => {
    // Pure red must land in the low byte, with alpha in the high byte.
    expect(packRgba(1, 0, 0, 1)).toBe(0xff0000ff);
    expect(packRgba(0, 0, 1, 1)).toBe(0xffff0000);
  });

  it('builds a 256-entry ramp whose ends match the stops', () => {
    const lut = buildRampLut(['#000000', '#ffffff']);
    expect(lut).toHaveLength(256);
    expect(lut[0]).toBe(packRgba(0, 0, 0, 1));
    expect(lut[255]).toBe(packRgba(1, 1, 1, 1));
  });

  it('handles a single-stop ramp without dividing by zero', () => {
    const lut = buildRampLut(['#112233']);
    expect(lut[0]).toBe(lut[255]);
  });
});

describe('math', () => {
  it('clamps at both ends', () => {
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it('interpolates and remaps', () => {
    expect(lerp(10, 20, 0.25)).toBe(12.5);
    expect(remap(5, 0, 10, 0, 100)).toBe(50);
  });

  it('smoothsteps within the edges', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5);
  });

  it('damps toward the target at the same rate regardless of step size', () => {
    // One big step and many small ones must land in the same place, which is
    // the entire reason damp exists instead of a plain lerp.
    const oneStep = damp(0, 1, 4, 0.5);
    let many = 0;
    for (let i = 0; i < 50; i++) many = damp(many, 1, 4, 0.01);
    expect(many).toBeCloseTo(oneStep, 5);
  });

  it('wraps negatives into range', () => {
    expect(wrap(-1, 10)).toBe(9);
    expect(wrap(11, 10)).toBe(1);
    expect(wrap(3, 10)).toBe(3);
  });
});

describe('param store', () => {
  const controls = [
    { id: 'speed', type: 'range', label: 'Speed', min: 0, max: 10, default: 4 },
    { id: 'loud', type: 'toggle', label: 'Loud', default: true },
    { id: 'mode', type: 'select', label: 'Mode', default: 'a', options: [] },
    { id: 'ink', type: 'color', label: 'Ink', default: '#ff0000' },
    { id: 'bang', type: 'action', label: 'Bang' },
  ] as const;

  it('starts every control at its declared default', () => {
    const store = createParamStore(controls);
    expect(store.view.num('speed')).toBe(4);
    expect(store.view.bool('loud')).toBe(true);
    expect(store.view.str('mode')).toBe('a');
    expect(store.view.rgb('ink')).toEqual([1, 0, 0]);
  });

  it('throws a helpful error for an undeclared control', () => {
    const store = createParamStore(controls);
    expect(() => store.view.num('nope')).toThrow(/no control declared/);
  });

  it('notifies subscribers once per real change', () => {
    const store = createParamStore(controls);
    const listener = vi.fn();
    store.subscribe(listener);

    store.set('speed', 7);
    store.set('speed', 7); // no-op, must not notify again
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('speed', 7);
  });

  it('lets a toy write back through the same store', () => {
    const store = createParamStore(controls);
    store.view.set('speed', 9);
    expect(store.get('speed')).toBe(9);
  });

  it('re-parses a color only when the hex actually changes', () => {
    const store = createParamStore(controls);
    const first = store.view.rgb('ink');
    expect(store.view.rgb('ink')).toBe(first); // cached identity
    store.set('ink', '#00ff00');
    expect(store.view.rgb('ink')).toEqual([0, 1, 0]);
  });

  it('fires action handlers and can unsubscribe them', () => {
    const store = createParamStore(controls);
    const handler = vi.fn();
    const off = store.view.onAction('bang', handler);
    store.trigger('bang');
    off();
    store.trigger('bang');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('restores defaults on reset', () => {
    const store = createParamStore(controls);
    store.set('speed', 1);
    store.set('loud', false);
    store.reset();
    expect(store.get('speed')).toBe(4);
    expect(store.get('loud')).toBe(true);
  });
});

describe('registry', () => {
  const make = (id: string) =>
    defineToy({
      id,
      name: id,
      blurb: 'test',
      author: 'test',
      accent: '#fff',
      surface: '2d',
      setup: () => ({ render: () => {} }),
    });

  beforeEach(() => clearToys());

  it('registers and looks toys up by id', () => {
    registerToy(make('good-toy'));
    expect(getToy('good-toy')?.name).toBe('good-toy');
    expect(allToys()).toHaveLength(1);
  });

  it('rejects ids that are not kebab-case, since the id is the route', () => {
    expect(() => registerToy(make('Bad Toy'))).toThrow(/kebab-case/);
    expect(() => registerToy(make('bad_toy'))).toThrow(/kebab-case/);
  });

  it('rejects duplicate ids', () => {
    registerToy(make('twice'));
    expect(() => registerToy(make('twice'))).toThrow(/already registered/);
  });

  it('rejects duplicate control ids inside one toy', () => {
    const toy = defineToy({
      ...make('dupe-controls'),
      controls: [
        { id: 'a', type: 'toggle', label: 'A', default: true },
        { id: 'a', type: 'toggle', label: 'A again', default: false },
      ],
    });
    expect(() => registerToy(toy)).toThrow(/two controls with id/);
  });
});
