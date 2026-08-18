# Working on Trinket

Orientation for anyone arriving cold, including AI coding agents. Humans should
read [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/TOY_API.md](docs/TOY_API.md)
too; this file is the short version of what will get a change rejected.

## What this project is

A shelf of mouse-driven desktop fidget toys, plus a small SDK so that adding the
next toy is one file rather than a project. The platform matters more than any
individual toy.

## Commands

```bash
python run.py            # the shelf, in its own window
python run.py toy <id>   # straight into one toy
npm run verify           # types, lint, tests. Run this before you finish.
npm run format           # prettier
npm run build            # static site into dist/
```

`npm run verify` is the gate. CI additionally runs `prettier --check` and a
no-em-dash scan over the whole tree.

## Layout

```
src/sdk/      the contract toys are written against, and nothing else
src/shell/    the shelf, the toy host, the generated control panel
src/toys/     one directory per toy, plus index.ts which registers them
src-tauri/    the desktop window
tests/        pure logic only, runs under Node with no DOM
docs/         TOY_API.md is the reference for everything a toy can do
```

## Rules that are not negotiable

1. **Toys import from `@sdk` and nowhere else.** A toy that imports from
   `src/shell` is wrong even if it works. If a toy needs something the SDK does
   not offer, add it to the SDK as a general capability, or open an issue.
2. **The shell never special-cases a toy.** No `if (toy.id === 'lava-lamp')`.
3. **Simulation goes in `update(dt)`, drawing goes in `render()`.** `update` runs
   on a fixed timestep. Sand piles, wave equations and metaball fluids go
   unstable when `dt` varies, and on a 144Hz display a variable step silently
   changes how fast the sim runs. If you want the real frame time, you want
   `damp()` instead.
4. **Allocate in `setup` and `resize`, never per frame.** A `new Float32Array`
   inside `render` shows up as jitter.
5. **Free GPU resources in `dispose`.** WebGL toys leak otherwise.
6. **Mouse only.** No keyboard shortcut may be the only way to do something.
7. **No em dashes** anywhere, including code comments and commit messages. Use a
   comma, a colon, parentheses, or a full stop. CI fails on them.

## Adding a toy

One file at `src/toys/<id>/index.ts` exporting `defineToy({...})`, plus two lines
in `src/toys/index.ts`. Declare controls as data and the shell builds the panel;
do not write DOM. `docs/TOY_API.md` has a worked example.

The four design rules in the README (mouse only, no goal, instant, quiet) are the
merge criteria, not aspirations. "Instant" in particular means the toy must be
doing something the frame it opens. Falling Sand seeds a starting scene, Ripple
Pool seeds a few drops, and Ferrofluid runs an attract mode until the pointer
first touches the canvas, all for this reason.

## Verifying visual work

**Types compiling is not evidence that a toy looks right.** Every significant
visual bug found so far in this repository passed the type checker, passed lint,
and passed the tests. Look at the thing:

```bash
python run.py toy <id>
```

If you cannot open a window, render it headlessly and inspect the image:

```bash
npm run build
npx vite preview --port 4173 --strictPort &
chrome --headless --disable-gpu --enable-unsafe-swiftshader \
  --window-size=1100,720 --virtual-time-budget=8000 \
  --screenshot=out.png "http://localhost:4173/#/<toy-id>"
```

Pick the virtual time budget to match what you are checking: a fresh ripple is
gone in a second, and a lava lamp needs several seconds to circulate.

Bugs this caught that nothing else would have: metaballs whose attraction was
too close to their repulsion and fused into one screen-filling mass; a surface
normal scaled about twenty times too large, which tipped every normal into the
view plane and lit a black fluid as a matte balloon; and a height field silently
wiped because the container gets measured once before layout settles.

## Performance budget

60fps at 1080p on integrated graphics.

- CPU grid sims: roughly 300k cells per tick. Expose the cell size as a control
  and default it to a comfortable value, not the prettiest one.
- Fragment-shader metaballs: the per-pixel loop is the cost, and 64 elements is
  the practical ceiling for a full-screen pass.

## Conventions

- TypeScript, strict. No `any` without a comment explaining why.
- Comments explain **why**, not what. `// alternate the scan direction or piles
drift one way` earns its place; `// loop over cells` does not.
- Match the surrounding code. Prettier settles the mechanical parts.
- Commit messages: a short subject line, then prose explaining the reasoning.
  No AI attribution or co-author trailers.
