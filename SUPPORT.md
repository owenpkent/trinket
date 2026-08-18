# Getting help

Trinket is a small project maintained in spare time. There is no support
guarantee, but issues do get read.

## Where to go

| You want to               | Go here                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| Play with it right now    | [The live demo](https://owenpkent.github.io/trinket/)                   |
| Understand the toy API    | [docs/TOY_API.md](docs/TOY_API.md)                                      |
| Build a toy               | [CONTRIBUTING.md](CONTRIBUTING.md)                                      |
| Find something to work on | [IDEAS.md](IDEAS.md) or the `good first issue` label                    |
| Report a bug              | [Open an issue](https://github.com/owenpkent/trinket/issues/new/choose) |
| Report a security problem | [SECURITY.md](SECURITY.md), privately                                   |
| Ask anything else         | [Discussions](https://github.com/owenpkent/trinket/discussions)         |

## Before opening an issue

Run `python run.py doctor`. It checks Node, npm, Rust and whether dependencies
are installed, which covers most of what goes wrong on a fresh machine.

If a WebGL toy shows an error box instead of a canvas, that message is the
driver's own shader log and is worth pasting in full.

## What is unlikely to happen

- **Ports to other platforms.** The web build already runs anywhere with WebGL2.
- **A mobile version.** Everything here is designed around a pointer with a hover
  state and two buttons.
- **Features with a goal attached.** Scores, timers, achievements and streaks are
  out of scope by design, not by omission.
