# The Toy API

Everything you need to add a toy to Trinket. The whole surface is exported from
`@sdk`; if you find yourself importing from `src/shell`, something is missing
from the SDK and that is worth an issue.

---

## The shape of a toy

```ts
import { defineToy } from '@sdk';

export default defineToy({
  id: 'my-toy', // kebab-case, unique, doubles as the route (#/my-toy)
  name: 'My Toy',
  blurb: 'One sentence. Shows on the shelf card and above the controls.',
  author: 'your name or handle',
  tags: ['2d', 'calm'], // optional, for filtering later
  accent: '#9ad5c0', // tints the card and the control panel
  surface: '2d', // or 'webgl'
  tickRate: 60, // optional, simulation ticks per second
  controls: [], // optional, see below
  setup(ctx) {
    return {
      update(dt) {},
      render(alpha) {},
      resize() {},
      dispose() {},
    };
  },
});
```

`setup` runs once per activation, after the canvas has been sized. Everything the
toy needs lives in the closure. There are no globals and no shared state between
toys.

## Lifecycle

| Hook            | When                                          | Notes                                               |
| --------------- | --------------------------------------------- | --------------------------------------------------- |
| `setup(ctx)`    | Once, on activation and after Reset           | Allocate here. The canvas is already sized.         |
| `update(dt)`    | Zero or more times per frame, at a fixed `dt` | All simulation goes here.                           |
| `render(alpha)` | Once per animation frame                      | Draw only. `alpha` is the 0..1 blend between ticks. |
| `resize()`      | After the drawing buffer changed size         | `ctx.width` and `ctx.height` are already updated.   |
| `dispose()`     | Before the toy is swapped out                 | Free GPU resources and timers.                      |

Only `render` is required.

### Why the split matters

`update` is called with a fixed `dt`, as many times as needed to catch up, and
`render` is called once per frame. This is not stylistic. Sand piles, wave
equations and metaball fluids all go unstable when the timestep varies, and on a
144Hz display a variable step silently changes how fast the sim runs. If you find
yourself wanting the real frame time, you almost certainly want `damp()` instead.

Long stalls (a backgrounded window, a dragged title bar) are clamped rather than
replayed, so a toy never gets a 3-second `dt` or a burst of 200 catch-up ticks.

## The context

```ts
ctx.canvas; // the HTMLCanvasElement, already in the DOM
ctx.width; // drawing buffer size, in device pixels. Use this for sim extents.
ctx.height;
ctx.cssWidth; // layout size, in CSS pixels
ctx.cssHeight;
ctx.dpr; // the ratio the buffer was sized with
ctx.time; // seconds since setup, as a getter
ctx.pointer; // live pointer state
ctx.params; // typed reader for your declared controls
ctx.rng; // seeded, deterministic PRNG
ctx.c2d; // when surface is '2d'
ctx.gl; // when surface is 'webgl' (WebGL2)
```

`width` and `height` are **device pixels**, and so is everything in `pointer`.
Work in that space and you never have to think about DPI. The host caps the
buffer at roughly 2.6 megapixels by lowering the effective DPR, so a 4K monitor
does not quietly hand your cellular automaton eight million cells.

## Pointer

```ts
(ctx.pointer.x, y); // current position, device pixels
(ctx.pointer.px, py); // position at the previous tick
(ctx.pointer.dx, dy); // movement since the previous tick
ctx.pointer.speed; // hypot(dx, dy)
ctx.pointer.down; // any button held
ctx.pointer.primary; // left button
ctx.pointer.secondary; // right button
ctx.pointer.inside; // cursor is over the canvas
ctx.pointer.wheel; // wheel delta accumulated since the last tick, then cleared
```

Sampled once per tick, not per event, so a 1000Hz mouse cannot starve your
simulation. The right-click menu is suppressed on the canvas, so right-drag is
yours to use. Drags are pointer-captured, so a stroke that leaves the canvas keeps
reporting.

Two things worth doing:

- **Interpolate between `px,py` and `x,y`** when a fast drag would otherwise leave
  gaps. `falling-sand` does this to paint a line rather than a row of dots.
- **Make hover do something.** Requiring a click for the primary interaction makes
  a toy tiring. `ripple-pool` ripples on movement alone and reserves the button
  for a heavier effect.

## Controls

Declare them, and the shell renders a two-way-bound panel. You never write DOM.

```ts
controls: [
  { id: 'speed', type: 'range', label: 'Speed', min: 0, max: 10, step: 0.1, default: 3, unit: 'x' },
  { id: 'trails', type: 'toggle', label: 'Trails', default: true },
  {
    id: 'mode',
    type: 'select',
    label: 'Mode',
    default: 'calm',
    options: [
      { value: 'calm', label: 'Calm' },
      { value: 'wild', label: 'Wild' },
    ],
  },
  { id: 'ink', type: 'color', label: 'Ink', default: '#49b8ff' },
  { id: 'boom', type: 'action', label: 'Shake it' },
];
```

Read them:

```ts
ctx.params.num('speed'); // number
ctx.params.bool('trails'); // boolean
ctx.params.str('mode'); // string
ctx.params.rgb('ink'); // [r, g, b] normalized 0..1, cached until the hex changes
ctx.params.onAction('boom', () => {}); // returns an unsubscribe function
ctx.params.set('speed', 5); // write back; the slider follows
```

Reading an id you did not declare throws with a message naming the id. That is
deliberate: a typo in a param name is otherwise a silent `NaN` three frames later.

Add a `help` string to any control and it becomes a tooltip. Use it for the one
setting whose name is not self-explanatory, not for all of them.

### Guidelines that keep the panel usable

- **Six controls is plenty.** If you want more, the toy is probably two toys.
- **Defaults must be the best version of the toy.** Someone who never opens the
  panel should still get the good experience.
- **Every range needs a sensible `step`.** The readout picks its precision from it.
- **`params.set` is for the toy talking back**, such as the wheel resizing a brush.
  Do not use it to fight the user for control of a value.

## Randomness

`ctx.rng` is a seeded mulberry32. Same seed, same sequence, every run.

```ts
ctx.rng.next(); // [0, 1)
ctx.rng.range(2, 9); // [2, 9)
ctx.rng.int(0, 4); // integer [0, 4)
ctx.rng.normal(); // roughly standard normal
ctx.rng.pick(['a', 'b']);
```

Use it rather than `Math.random()` so behaviour is reproducible and testable.

## Helpers

```ts
import { clamp, lerp, remap, smoothstep, damp, wrap, TAU } from '@sdk';
```

`damp(current, target, rate, dt)` is the one worth knowing. It is a
frame-rate-independent exponential approach, so the same `rate` behaves
identically at any tick rate. Reach for it instead of `lerp(a, b, 0.1)`.

Colour helpers:

```ts
import { hexToRgb, rgbToHex, mixRgb, buildRampLut, packRgba } from '@sdk';
```

`buildRampLut(stops)` returns a 256-entry `Uint32Array` of packed pixels in the
little-endian `0xAABBGGRR` layout that `ImageData` uses, so a CPU sim can index it
and write straight into a `Uint32Array` view of the pixel buffer. `falling-sand`
is the worked example.

## 2D toys

You get a `CanvasRenderingContext2D` with `alpha: false`. Clear it yourself.

The fast pattern for grid simulations, which both CPU toys use:

1. Keep the sim on a small offscreen canvas at one cell per pixel.
2. Write packed colours into a `Uint32Array` view of an `ImageData`.
3. `putImageData` onto the offscreen canvas.
4. `drawImage` it scaled up to the real canvas.

Set `imageSmoothingEnabled = false` when the pixels are the point (sand) and
`true` when they are not (water).

## WebGL toys

You get a `WebGL2RenderingContext`. For the common "CPU does the physics, GPU does
the look" shape there is a helper:

```ts
import { createFullscreenShader } from '@sdk';
import source from './my.frag?raw';

const shader = createFullscreenShader(gl, source);

// in render:
shader.use(ctx.width, ctx.height);
gl.uniform2f(shader.uniform('uRes'), ctx.width, ctx.height);
shader.draw();

// in dispose:
shader.dispose();
```

It covers the viewport with one oversized triangle generated from `gl_VertexID`,
so there are no buffers or attributes to manage, and it caches uniform locations.
Shader compile errors throw with the driver's log attached, and the shell shows
that message instead of a blank canvas.

Two notes:

- `gl_FragCoord` is y-up; the pointer and everything on the CPU side is y-down.
  Flip once at the top of `main`: `vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);`
- **You must free GPU resources in `dispose`.** The host loses the context when a
  toy is swapped out, but leaking programs while a toy is running is still on you.

## Performance budget

A toy should hold 60fps on integrated graphics at 1080p. Concretely:

- CPU grid sims: keep it under about 300k cells per tick. Both CPU toys expose a
  cell-size control and default to a comfortable value rather than the prettiest one.
- Fragment-shader metaballs: the per-pixel loop is the cost. 64 elements is the
  practical ceiling for a full-screen pass, which is why both GPU toys cap there.
- Allocate in `setup` and `resize`, never in `update` or `render`. A `new
Float32Array` per frame will show up as jitter.

If your toy genuinely needs more, expose the cost as a control and default it low.

## Testing

Pure logic goes in `tests/`, which runs under Node with no DOM. Anything that
touches a canvas is not unit tested here. Keep the interesting maths in functions
that take numbers and return numbers, and it becomes testable for free.

```bash
npm run verify   # types, lint, tests
```
