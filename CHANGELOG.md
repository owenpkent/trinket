# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-08-18

First cut. The platform and four toys.

### Added

- **Toy SDK** (`src/sdk/`): the contract toys are written against. Fixed-timestep
  loop, per-tick sampled pointer, declarative controls with a generated panel,
  seeded PRNG, colour and maths helpers, and a full-screen WebGL2 shader helper.
- **Shell** (`src/shell/`): a shelf of toys with hash routing, a toy host that
  owns canvas sizing and lifecycle, and a control panel generated from each toy's
  declared controls.
- **Lava Lamp**: buoyancy-driven wax blobs rendered as GPU metaballs, with heat
  exchange between touching blobs. Drag to stir, right-drag to chill.
- **Falling Sand**: a cellular-automata sandbox with sand, water, oil, wood,
  stone, fire and smoke. Left-drag to draw, right-drag to erase, wheel to resize
  the brush.
- **Ripple Pool**: a two-buffer wave equation, refracted and lit per pixel over
  three selectable bottoms. Ripples on hover, heavier drops on click.
- **Ferrofluid**: anisotropic metaballs stretched along the field lines to the
  cursor, which is what produces the spikes.
- **Desktop build**: Tauri v2 window with an always-on-top pin, offline by
  design, sharing the exact bundle the web build uses.
- `run.py`: a stdlib-only launcher matching the convention used across the
  other repos here. Opens the shelf or a single toy in a dedicated app window,
  stops the dev server when that window closes, and carries subcommands for the
  desktop build, the installers, verification, icons and a prerequisite check.
- Documentation: `docs/TOY_API.md` and `CONTRIBUTING.md`.

[Unreleased]: https://github.com/owenpkent/trinket/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/owenpkent/trinket/releases/tag/v0.1.0
