<!--
Thanks for sending this. Delete whichever section does not apply.
Nothing here is bureaucracy: every box maps to something that has actually
gone wrong before.
-->

## What this changes

<!-- One or two sentences. If it is a new toy, say what it feels like to use. -->

## Show it

<!--
A GIF or a short clip. This is a visual project and a clip is worth more than
any description. Drag the file straight into this box.
-->

---

## If this adds a toy

- [ ] It lives in `src/toys/<id>/` and is registered in `src/toys/index.ts`
- [ ] Everything it does is reachable with the pointer alone
- [ ] It is playable the frame it opens, with no empty or loading state
- [ ] No score, no timer, no sound
- [ ] The defaults are the good version of the toy, not a starting point
- [ ] It holds 60fps at 1080p on integrated graphics
- [ ] It allocates in `setup` and `resize`, never per frame
- [ ] GPU resources are freed in `dispose` (WebGL toys)
- [ ] It imports from `@sdk` only, and never from `src/shell`

## If this touches the SDK

- [ ] At least two toys would use it, or it fixes something broken
- [ ] `docs/TOY_API.md` is updated
- [ ] There is a test in `tests/` for anything that is pure logic
- [ ] Breaking changes update every affected toy in this same pull request
- [ ] `CHANGELOG.md` has an entry under Unreleased

## Everything

- [ ] `npm run verify` passes (types, lint, tests)
- [ ] `npm run format` has been run
- [ ] No em dashes anywhere, including commit messages (CI enforces this)
