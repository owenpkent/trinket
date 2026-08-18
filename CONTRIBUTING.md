# Contributing to Trinket

New toys are the point of this repository. A good one is a single file, a handful
of controls, and something pleasant to push around with a mouse. If you have an
idea, open an issue first only if you want feedback on the concept; otherwise just
build it and send the pull request.

## Getting set up

```bash
git clone https://github.com/owenpkent/trinket.git
cd trinket
python run.py
```

`run.py` installs dependencies on first use and opens the shelf in its own
window. `python run.py doctor` tells you what is missing. If you would rather
drive npm directly, `npm install && npm run dev` does the same thing.

That is the whole setup for web work. The desktop build additionally needs a Rust
toolchain and, on Windows, the MSVC build tools:

```bash
python run.py desktop
```

## Finding something to work on

[IDEAS.md](IDEAS.md) is a list of toys nobody has built, sorted by how hard the
physics is. The [`good first issue`](https://github.com/owenpkent/trinket/labels/good%20first%20issue)
label has smaller, well-scoped work. Neither is a queue you have to join: if you
want to build something that is on neither list, build it.

## Adding a toy

1. Create `src/toys/your-toy/index.ts` with a `defineToy({...})` default export.
   Read **[docs/TOY_API.md](docs/TOY_API.md)** first; it is short and it will save
   you from re-deriving the fixed-timestep rules.
2. Register it in `src/toys/index.ts`: one import, one entry in the array.
3. Run `npm run verify`.
4. Open a pull request. The template has a checklist; it is short, and every
   line on it maps to something that has actually gone wrong. Include a GIF or a
   short clip. This is a visual project, and a clip is worth more than any
   description.

Put any shader next to the toy as a `.frag` file and import it with `?raw`.

## What gets merged

A toy is a good fit when it holds to the four design rules in the README:
mouse only, no goal, instant, quiet. Beyond that:

- **It has to feel like something.** The test is whether you keep fiddling with it
  after you have finished debugging it. If you get bored of your own toy, so will
  everyone else.
- **Defaults are the product.** Most people will never open the control panel.
  Tune the defaults until the toy is good without them.
- **It performs.** 60fps at 1080p on integrated graphics. See the performance
  budget in the API doc.
- **It cleans up.** GPU resources freed in `dispose`, no allocation per frame.

Things that will get sent back: keyboard-only interactions, anything with a score
or a timer, sound, a toy that takes more than a frame to become playable, and
anything that reaches into `src/shell` instead of `@sdk`.

## Changing the SDK

The SDK is a contract, so changes to `src/sdk/` get more scrutiny than a new toy.
Roughly:

- **Adding a helper** that two or more toys would use: yes, with a test.
- **Adding a control type**: yes, if it is genuinely pointer-friendly. Include the
  panel rendering and a note in the API doc.
- **Special-casing a toy in the shell**: no. If a toy needs something the shell
  does not offer, that belongs in the SDK as a general capability.

Breaking changes need a note in `CHANGELOG.md` and updates to every affected toy
in the same pull request.

## Style

The tooling enforces the mechanical parts:

```bash
npm run verify   # types, lint, tests
npm run format   # prettier
```

Beyond that, match the surrounding code. Two things this project cares about more
than most:

- **Comments explain why, not what.** `// alternate scan direction or piles drift
one way` is useful. `// loop over cells` is not.
- **No em dashes** in code, comments, docs or commit messages. Use a comma, a
  colon, parentheses, or a full stop.

## Reporting a problem

Open an issue with your OS, browser or desktop build, GPU if the toy is a WebGL
one, and what you were doing. Visual glitches are much easier to fix with a
screenshot.
