# Toys nobody has built yet

A list to steal from. None of these are assigned, none are promised, and you do
not need permission to start one.

**To claim one**, open a [New toy issue](https://github.com/owenpkent/trinket/issues/new/choose)
saying which one you are taking, so two people do not build the same thing. If
you would rather just build it and open a pull request, that is fine too.

Difficulty is about the physics, not the code. Every one of these is a single
file against [the toy API](docs/TOY_API.md).

---

## Good first toy

Small, well-understood, and you can see it working within an hour.

**Bubble Wrap** `2d`
A grid of bubbles that pop under the cursor and stay popped. The whole thing is
a boolean array and a bit of shading. The design problem is the pop itself: it
has to feel like a release, which means the bubble should resist slightly first.

**Newton's Cradle** `2d`
Five balls on strings. Drag one aside and let go. Rigid collisions in one
dimension, so the maths is a couple of lines; the work is in the drawing.

**Zen Garden** `2d`
Rake grooves into sand. A height field plus a rake shape dragged through it,
with grains piling at the edges of each stroke. Wheel to change the rake width.
Nothing to solve, which is the point.

**Kaleidoscope** `2d`
Mirror the pointer trail into six or twelve wedges. Trivially simple and
disproportionately satisfying. The interesting decision is how the trail fades.

**Gravity Wells** `2d`
Particles orbiting a cursor that attracts them. Everyone has written this; the
version worth having is the one where the trails are beautiful and the particles
never fly off screen.

## Middling

You will spend an evening tuning constants, and that is where the toy is.

**Rope** `2d`
A chain of verlet points with distance constraints. Drag the end, flick it, let
it whip. The classic trap is instability: relax the constraints several times per
tick instead of once, and clamp the drag velocity.

**Pin Screen** `2d` or `webgl`
The desk toy with thousands of sliding pins. Push shapes into it with the cursor
and they hold. It is a height field with lighting, so it lives or dies on the
shading, not the simulation.

**Reaction Diffusion** `webgl`
Gray-Scott on the GPU: paint seeds with the mouse and watch coral, spots or maze
patterns grow. Two channels in a texture and a ping-pong pass. Needs render
targets, which the SDK does not wrap yet, so expect an SDK issue to fall out of
this one.

**Flocking** `2d`
Boids that follow the cursor at a distance and scatter when you hold the button.
Cheap to write, hard to tune into something that looks alive rather than
mechanical. A spatial grid keeps it above a few hundred birds.

**Slime Mould** `webgl`
Physarum: agents that deposit a trail and steer toward it. Produces networks
nothing else does. Same render-target requirement as reaction diffusion.

**Snow Globe** `2d`
Shake it and the snow swirls. The trick is that real snow globe motion is
dominated by the fluid, not gravity, so a plain particle fall looks wrong.

**Domino Run** `2d`
Place dominoes with clicks, then knock the first one over. Needs simple rigid
body rotation about a pivot and contact between neighbours.

## Ambitious

Worth doing, but expect to fight something.

**Ink in Water** `webgl`
Stable fluids: advect a dye field through a velocity field the cursor stirs. The
best-looking toy on this list, and the one most likely to eat a weekend. Needs
multiple passes and render targets.

**Soap Film** `webgl`
An iridescent bubble surface you can stretch and pop. Thin-film interference is a
closed-form colour from the film thickness, so the physics is a height field and
the magic is entirely in the shading.

**Plasma Globe** `webgl`
Branching arcs that reach for the cursor. Dielectric breakdown or a noise-driven
branch walk; both work, and both need care to avoid looking like scribble.

**Cloth** `2d`
A grid of verlet points with structural and shear constraints, pinned at the top.
Grab it, drag it, tear it. Doable, but the constraint count is where naive
implementations fall off the performance budget.

**Mercury** `webgl`
Droplets that merge on contact and split when you drag them apart quickly. The
metaball rendering already exists in Lava Lamp and Ferrofluid; the new part is
surface tension that genuinely separates a droplet rather than stretching it
forever.

---

## Not toys, but wanted

Things the platform needs that are not a new toy. Look for the `sdk` label.

- **Render targets in the SDK.** Three toys on this list need ping-pong
  framebuffers. Right now each would hand-roll it.
- **A screenshot button.** Save the canvas to a PNG. Awkward in the desktop
  build, which is exactly why it belongs in the shell rather than in a toy.
- **Remembering the last toy and its settings** between launches.
- **A shelf that is not one flat grid** once there are more than about a dozen
  toys.
