import { buildRampLut, clamp, defineToy, type ToyInstance } from '@sdk';

/* Material ids. Kept as plain numbers so the grid can live in a Uint8Array. */
const EMPTY = 0;
const SAND = 1;
const WATER = 2;
const OIL = 3;
const STONE = 4;
const WOOD = 5;
const FIRE = 6;
const SMOKE = 7;

const MATERIAL_BY_NAME: Record<string, number> = {
  sand: SAND,
  water: WATER,
  oil: OIL,
  stone: STONE,
  wood: WOOD,
  fire: FIRE,
  smoke: SMOKE,
  eraser: EMPTY,
};

/** Colour ramps, sampled per cell by a fixed random tint so piles look granular. */
const RAMPS: Record<number, readonly string[]> = {
  [EMPTY]: ['#0a0b0e'],
  [SAND]: ['#b8823c', '#d9ad5c', '#e8c477', '#c8964a'],
  [WATER]: ['#1e5bb8', '#2f7ee6', '#4aa0f7', '#2b6fd6'],
  [OIL]: ['#241a13', '#3a2a1e', '#4a3626', '#2e211a'],
  [STONE]: ['#565c66', '#6a707c', '#858c99', '#727986'],
  [WOOD]: ['#5e3d20', '#7a4f2a', '#96683c', '#6a4423'],
  [FIRE]: ['#8c1a06', '#e03c0c', '#ff8a24', '#fff3b0'],
  [SMOKE]: ['#0a0b0e', '#1d2026', '#383c45', '#565b66'],
};

const LUTS: Record<number, Uint32Array> = Object.fromEntries(
  Object.entries(RAMPS).map(([material, stops]) => [material, buildRampLut(stops)]),
);

/** Materials a falling grain is heavier than, so it can swap places with them. */
const sinksThrough = (material: number): boolean =>
  material === EMPTY || material === WATER || material === OIL;

export default defineToy({
  id: 'falling-sand',
  name: 'Falling Sand',
  blurb:
    'Paint sand, water, oil and fire. Left-drag to draw, right-drag to erase, wheel to resize.',
  author: 'OK Studio',
  tags: ['cellular-automata', '2d', 'sandbox'],
  accent: '#e8c477',
  surface: '2d',
  tickRate: 60,
  controls: [
    {
      id: 'material',
      type: 'select',
      label: 'Material',
      default: 'sand',
      options: [
        { value: 'sand', label: 'Sand' },
        { value: 'water', label: 'Water' },
        { value: 'oil', label: 'Oil' },
        { value: 'wood', label: 'Wood' },
        { value: 'stone', label: 'Stone' },
        { value: 'fire', label: 'Fire' },
        { value: 'smoke', label: 'Smoke' },
        { value: 'eraser', label: 'Eraser' },
      ],
    },
    { id: 'brush', type: 'range', label: 'Brush', min: 1, max: 40, step: 1, default: 7 },
    {
      id: 'grain',
      type: 'range',
      label: 'Grain',
      min: 2,
      max: 8,
      step: 1,
      default: 3,
      help: 'Pixels per cell. Bigger grains mean a coarser but much faster sim.',
    },
    {
      id: 'faucet',
      type: 'toggle',
      label: 'Faucet',
      default: false,
      help: 'Pour the selected material from the top of the screen.',
    },
    { id: 'clear', type: 'action', label: 'Clear everything' },
  ],
  setup(ctx) {
    const { c2d, params, rng, pointer } = ctx;

    // The sim runs on its own low-resolution buffer and is blitted up at draw
    // time. Everything below is in cell units, not pixels.
    let cellSize = 0;
    let gridW = 0;
    let gridH = 0;
    let cells = new Uint8Array(0);
    let life = new Uint8Array(0);
    let tint = new Uint8Array(0);
    let flow = new Int8Array(0);

    const buffer = document.createElement('canvas');
    const bufferCtx = buffer.getContext('2d', { alpha: false });
    if (!bufferCtx) throw new Error('Trinket: could not create the sand back buffer.');
    let image = bufferCtx.createImageData(1, 1);
    let pixels = new Uint32Array(image.data.buffer);

    let frame = 0;

    const allocate = (): void => {
      const size = Math.round(params.num('grain'));
      const width = Math.max(8, Math.floor(ctx.width / size));
      const height = Math.max(8, Math.floor(ctx.height / size));
      if (size === cellSize && width === gridW && height === gridH) return;

      const previous = { cells, life, tint, flow, w: gridW, h: gridH };
      cellSize = size;
      gridW = width;
      gridH = height;
      const count = width * height;
      cells = new Uint8Array(count);
      life = new Uint8Array(count);
      tint = new Uint8Array(count);
      flow = new Int8Array(count);
      for (let i = 0; i < count; i++) tint[i] = rng.int(0, 256);

      // Carry the old contents over so resizing the window does not wipe a
      // picture someone has been building for ten minutes.
      if (previous.w > 0 && previous.h > 0) {
        const copyW = Math.min(previous.w, width);
        const copyH = Math.min(previous.h, height);
        for (let y = 0; y < copyH; y++) {
          // Anchor to the bottom edge: that is where the material has settled.
          const fromRow = (previous.h - copyH + y) * previous.w;
          const toRow = (height - copyH + y) * width;
          for (let x = 0; x < copyW; x++) {
            cells[toRow + x] = previous.cells[fromRow + x];
            life[toRow + x] = previous.life[fromRow + x];
          }
        }
      }

      buffer.width = width;
      buffer.height = height;
      image = bufferCtx.createImageData(width, height);
      pixels = new Uint32Array(image.data.buffer);
    };

    allocate();

    params.onAction('clear', () => {
      cells.fill(EMPTY);
      life.fill(0);
    });

    const put = (index: number, material: number): void => {
      cells[index] = material;
      // Fire and smoke burn down from a full life; everything else ignores it.
      life[index] =
        material === FIRE ? rng.int(120, 200) : material === SMOKE ? rng.int(90, 170) : 0;
      if (material === EMPTY) flow[index] = 0;
    };

    const paint = (cx: number, cy: number, radius: number, material: number): void => {
      const r2 = radius * radius;
      const minX = Math.max(0, Math.floor(cx - radius));
      const maxX = Math.min(gridW - 1, Math.ceil(cx + radius));
      const minY = Math.max(0, Math.floor(cy - radius));
      const maxY = Math.min(gridH - 1, Math.ceil(cy + radius));
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = x - cx;
          const dy = y - cy;
          if (dx * dx + dy * dy > r2) continue;
          // Loose materials get a ragged edge; solids get a clean one.
          if (material !== EMPTY && material !== STONE && material !== WOOD && rng.next() < 0.25) {
            continue;
          }
          put(y * gridW + x, material);
        }
      }
    };

    /**
     * A small starting scene: a stone basin holding water, a dune of sand, and
     * a couple of wooden posts to set alight. An empty black screen gives no
     * clue that any of this is here.
     */
    const seedScene = (): void => {
      const fill = (x0: number, y0: number, x1: number, y1: number, material: number): void => {
        for (let y = Math.max(0, y0); y <= Math.min(gridH - 1, y1); y++) {
          for (let x = Math.max(0, x0); x <= Math.min(gridW - 1, x1); x++) {
            put(y * gridW + x, material);
          }
        }
      };

      const floor = gridH - Math.max(2, Math.round(gridH * 0.02));
      fill(0, floor, gridW - 1, gridH - 1, STONE);

      // Basin on the left, two thirds full of water.
      const left = Math.round(gridW * 0.12);
      const right = Math.round(gridW * 0.4);
      const lip = floor - Math.round(gridH * 0.3);
      const wall = Math.max(2, Math.round(gridW * 0.006));
      fill(left, lip, left + wall, floor - 1, STONE);
      fill(right - wall, lip, right, floor - 1, STONE);
      fill(left + wall + 1, lip + Math.round(gridH * 0.08), right - wall - 1, floor - 1, WATER);

      // Dune on the right, a half sine so it settles instead of collapsing.
      const duneLeft = Math.round(gridW * 0.55);
      const duneRight = Math.round(gridW * 0.95);
      for (let x = duneLeft; x <= duneRight; x++) {
        const t = (x - duneLeft) / (duneRight - duneLeft);
        const height = Math.round(Math.sin(t * Math.PI) * gridH * 0.3);
        fill(x, floor - height, x, floor - 1, SAND);
      }

      // Posts, standing in the gap between the two.
      const post = Math.round(gridW * 0.47);
      fill(post, floor - Math.round(gridH * 0.26), post + wall, floor - 1, WOOD);
    };

    seedScene();

    /** Bresenham-free interpolation so a fast drag paints a line, not dots. */
    const paintStroke = (material: number, radius: number): void => {
      const x0 = pointer.px / cellSize;
      const y0 = pointer.py / cellSize;
      const x1 = pointer.x / cellSize;
      const y1 = pointer.y / cellSize;
      const steps = Math.max(
        1,
        Math.ceil(Math.hypot(x1 - x0, y1 - y0) / Math.max(1, radius * 0.5)),
      );
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        paint(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, radius, material);
      }
    };

    const swap = (a: number, b: number): void => {
      const material = cells[a];
      const cellLife = life[a];
      cells[a] = cells[b];
      life[a] = life[b];
      cells[b] = material;
      life[b] = cellLife;
    };

    /** Slide a liquid sideways up to `reach` cells, stopping at the first blocker. */
    const spread = (index: number, x: number, reach: number, passable: number): boolean => {
      let dir = flow[index];
      if (dir === 0) dir = rng.next() < 0.5 ? -1 : 1;

      for (let attempt = 0; attempt < 2; attempt++) {
        let best = 0;
        for (let step = 1; step <= reach; step++) {
          const nx = x + dir * step;
          if (nx < 0 || nx >= gridW) break;
          const target = index + dir * step;
          if (cells[target] !== EMPTY && !(passable !== EMPTY && cells[target] === passable)) break;
          best = step;
        }
        if (best > 0) {
          const target = index + dir * best;
          flow[target] = dir;
          swap(index, target);
          return true;
        }
        // Blocked: turn around and try the other way before giving up.
        dir = -dir as -1 | 1;
      }
      flow[index] = dir;
      return false;
    };

    /** Heavy things and liquids, scanned bottom-up so nothing falls twice per tick. */
    const settlePass = (): void => {
      // Alternate the horizontal scan direction or piles drift steadily one way.
      const leftToRight = (frame & 1) === 0;
      for (let y = gridH - 2; y >= 0; y--) {
        const row = y * gridW;
        for (let n = 0; n < gridW; n++) {
          const x = leftToRight ? n : gridW - 1 - n;
          const index = row + x;
          const material = cells[index];
          if (material === EMPTY || material === STONE || material === WOOD) continue;
          if (material === FIRE || material === SMOKE) continue;

          const below = index + gridW;

          if (material === SAND) {
            if (sinksThrough(cells[below])) {
              swap(index, below);
              continue;
            }
            const first = rng.next() < 0.5 ? -1 : 1;
            let moved = false;
            for (const dir of [first, -first]) {
              const nx = x + dir;
              if (nx < 0 || nx >= gridW) continue;
              if (sinksThrough(cells[below + dir])) {
                swap(index, below + dir);
                moved = true;
                break;
              }
            }
            if (moved) continue;
            continue;
          }

          // Liquids. Water is denser than oil, so it sinks through it; oil only
          // falls into genuinely empty space, which floats it back to the top.
          const through = material === WATER ? OIL : EMPTY;
          if (cells[below] === EMPTY || (through !== EMPTY && cells[below] === through)) {
            swap(index, below);
            continue;
          }
          const first = rng.next() < 0.5 ? -1 : 1;
          let fell = false;
          for (const dir of [first, -first]) {
            const nx = x + dir;
            if (nx < 0 || nx >= gridW) continue;
            const target = below + dir;
            if (cells[target] === EMPTY || (through !== EMPTY && cells[target] === through)) {
              swap(index, target);
              fell = true;
              break;
            }
          }
          if (fell) continue;

          // Oil is thicker, so it levels out more slowly than water.
          spread(index, x, material === WATER ? 5 : 2, through);
        }
      }
    };

    /** Fire and smoke rise, so they get a top-down pass of their own. */
    const risePass = (): void => {
      const leftToRight = (frame & 1) === 1;
      for (let y = 0; y < gridH; y++) {
        const row = y * gridW;
        for (let n = 0; n < gridW; n++) {
          const x = leftToRight ? n : gridW - 1 - n;
          const index = row + x;
          const material = cells[index];
          if (material !== FIRE && material !== SMOKE) continue;

          if (material === FIRE) {
            let doused = false;
            // Spread to anything flammable, and die on contact with water.
            for (let dy = -1; dy <= 1 && !doused; dy++) {
              const ny = y + dy;
              if (ny < 0 || ny >= gridH) continue;
              for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx;
                if (nx < 0 || nx >= gridW) continue;
                if (dx === 0 && dy === 0) continue;
                const neighbour = ny * gridW + nx;
                const target = cells[neighbour];
                if (target === WATER) {
                  doused = true;
                  break;
                }
                if (target === WOOD && rng.next() < 0.012) put(neighbour, FIRE);
                else if (target === OIL && rng.next() < 0.22) put(neighbour, FIRE);
              }
            }
            if (doused) {
              put(index, SMOKE);
              continue;
            }
            life[index] = Math.max(0, life[index] - 3);
            if (life[index] === 0) {
              // Most of a flame just goes out; a little of it becomes soot.
              if (rng.next() < 0.4) put(index, SMOKE);
              else put(index, EMPTY);
              continue;
            }
          } else {
            life[index] = Math.max(0, life[index] - 1);
            if (life[index] === 0) {
              put(index, EMPTY);
              continue;
            }
          }

          if (y === 0) {
            put(index, EMPTY);
            continue;
          }

          // Rise, wandering sideways so plumes curl instead of forming columns.
          const above = index - gridW;
          const drift = rng.next();
          if (cells[above] === EMPTY && drift > 0.35) {
            swap(index, above);
          } else {
            const dir = drift < 0.175 ? -1 : drift < 0.35 ? 1 : rng.next() < 0.5 ? -1 : 1;
            const nx = x + dir;
            if (nx >= 0 && nx < gridW && cells[above + dir] === EMPTY) {
              swap(index, above + dir);
            } else if (nx >= 0 && nx < gridW && cells[index + dir] === EMPTY) {
              swap(index, index + dir);
            }
          }
        }
      }
    };

    const update = (): void => {
      frame++;
      allocate();

      const material = MATERIAL_BY_NAME[params.str('material')] ?? SAND;

      // The wheel is the fastest way to resize a brush without leaving the canvas.
      if (pointer.wheel !== 0) {
        const next = clamp(params.num('brush') - Math.sign(pointer.wheel), 1, 40);
        params.set('brush', next);
      }

      const radius = params.num('brush') / Math.max(1, cellSize / 3);
      if (pointer.inside && pointer.down) {
        paintStroke(pointer.secondary ? EMPTY : material, Math.max(0.6, radius));
      }

      if (params.bool('faucet') && material !== EMPTY) {
        const cx = Math.floor(gridW / 2);
        const width = Math.max(1, Math.round(gridW * 0.012));
        for (let x = cx - width; x <= cx + width; x++) {
          if (x < 0 || x >= gridW) continue;
          if (cells[x] === EMPTY && rng.next() < 0.6) put(x, material);
        }
      }

      settlePass();
      risePass();
    };

    const render = (): void => {
      const fireLut = LUTS[FIRE];
      const smokeLut = LUTS[SMOKE];
      for (let i = 0; i < cells.length; i++) {
        const material = cells[i];
        if (material === FIRE) {
          pixels[i] = fireLut[Math.min(255, life[i] + 55)];
        } else if (material === SMOKE) {
          pixels[i] = smokeLut[Math.min(255, life[i])];
        } else {
          pixels[i] = LUTS[material][tint[i]];
        }
      }
      bufferCtx.putImageData(image, 0, 0);

      // Nearest-neighbour on purpose: the whole look depends on visible cells.
      c2d.imageSmoothingEnabled = false;
      c2d.drawImage(buffer, 0, 0, gridW, gridH, 0, 0, ctx.width, ctx.height);

      // Brush outline, so the cursor always shows what it is about to affect.
      if (pointer.inside) {
        const radiusPx = (params.num('brush') / Math.max(1, cellSize / 3)) * cellSize;
        c2d.beginPath();
        c2d.arc(pointer.x, pointer.y, Math.max(2, radiusPx), 0, Math.PI * 2);
        c2d.strokeStyle = 'rgba(255,255,255,0.35)';
        c2d.lineWidth = Math.max(1, ctx.dpr);
        c2d.stroke();
      }
    };

    const instance: ToyInstance = {
      update,
      render,
      resize: allocate,
    };
    return instance;
  },
});
