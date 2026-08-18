import {
  createLoop,
  createParamStore,
  createPointerTracker,
  createRng,
  type Loop,
  type ParamStore,
  type ToyContext,
  type ToyDefinition,
  type ToyInstance,
} from '@sdk';

export interface ToyHost {
  readonly definition: ToyDefinition;
  readonly params: ParamStore;
  readonly canvas: HTMLCanvasElement;
  readonly loop: Loop;
  /** Rebuild the toy from scratch, keeping the current parameter values. */
  restart(): void;
  /** Restore defaults and rebuild. */
  reset(): void;
  dispose(): void;
}

/** Cap the buffer so a 4K display does not quietly ask a CPU sim for 8M cells. */
const MAX_BUFFER_PIXELS = 2_600_000;

/**
 * Mounts one toy into a container: canvas, context, pointer, params, loop.
 *
 * Every toy activation gets a fresh host, and disposing it is expected to give
 * back everything, including the GL context. That keeps toy switching leak-free
 * even though each toy manages its own GPU resources.
 */
export function mountToy(
  container: HTMLElement,
  definition: ToyDefinition,
  seed = 0x5eed1e,
): ToyHost {
  const canvas = document.createElement('canvas');
  canvas.className = 'toy-canvas';
  container.appendChild(canvas);

  const params = createParamStore(definition.controls ?? []);
  const pointer = createPointerTracker(canvas);
  const started = performance.now();

  const context = {
    canvas,
    surface: definition.surface,
    width: 1,
    height: 1,
    cssWidth: 1,
    cssHeight: 1,
    dpr: 1,
    pointer: pointer.state,
    params: params.view,
    rng: createRng(seed),
    get time(): number {
      return (performance.now() - started) / 1000;
    },
  } as unknown as ToyContext & { width: number; height: number };

  if (definition.surface === '2d') {
    const c2d = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!c2d) throw new Error('Trinket: this browser refused a 2D canvas context.');
    (context as { c2d: CanvasRenderingContext2D }).c2d = c2d;
  } else {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      // Fidget toys are visual first; ask for the discrete GPU when there is one.
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    if (!gl) {
      throw new Error(
        'Trinket: WebGL2 is unavailable, so this toy cannot run. Try updating your graphics drivers.',
      );
    }
    (context as { gl: WebGL2RenderingContext }).gl = gl;
  }

  let instance: ToyInstance | null = null;
  let disposed = false;

  const sizeBuffer = (): boolean => {
    const rect = container.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.round(rect.width));
    const cssHeight = Math.max(1, Math.round(rect.height));

    let dpr = window.devicePixelRatio || 1;
    // Scale the ratio down rather than the layout, so the canvas still fills
    // the window but the simulation grid stays affordable.
    const requested = cssWidth * cssHeight * dpr * dpr;
    if (requested > MAX_BUFFER_PIXELS) {
      dpr *= Math.sqrt(MAX_BUFFER_PIXELS / requested);
    }

    const width = Math.max(1, Math.floor(cssWidth * dpr));
    const height = Math.max(1, Math.floor(cssHeight * dpr));
    if (width === context.width && height === context.height) return false;

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    context.width = width;
    context.height = height;
    (context as { cssWidth: number }).cssWidth = cssWidth;
    (context as { cssHeight: number }).cssHeight = cssHeight;
    (context as { dpr: number }).dpr = dpr;
    return true;
  };

  const build = (): void => {
    instance?.dispose?.();
    sizeBuffer();
    // The union has to be narrowed for the caller's sake, not the callee's:
    // setup already knows which surface it declared.
    instance = (definition.setup as (ctx: ToyContext) => ToyInstance)(context);
  };

  const observer = new ResizeObserver(() => {
    if (disposed) return;
    if (sizeBuffer()) instance?.resize?.();
  });
  observer.observe(container);

  const loop = createLoop(
    {
      beforeTick: () => pointer.commit(),
      update: (dt) => instance?.update?.(dt),
      render: (alpha) => instance?.render(alpha),
    },
    definition.tickRate ?? 60,
  );

  build();
  loop.start();

  // Pause when the window is hidden. A backgrounded fidget toy should not keep
  // a GPU busy, and rAF alone does not always stop in a desktop webview.
  const onVisibility = (): void => {
    if (disposed) return;
    if (document.hidden) loop.stop();
    else loop.start();
  };
  document.addEventListener('visibilitychange', onVisibility);

  return {
    definition,
    params,
    canvas,
    loop,
    restart: build,
    reset(): void {
      params.reset();
      build();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      loop.stop();
      document.removeEventListener('visibilitychange', onVisibility);
      observer.disconnect();
      instance?.dispose?.();
      instance = null;
      pointer.dispose();
      // Release the GPU context explicitly. Waiting for GC to do it means a few
      // toy switches can exhaust the browser's context budget.
      if (definition.surface === 'webgl') {
        const gl = (context as { gl?: WebGL2RenderingContext }).gl;
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
      }
      canvas.remove();
    },
  };
}
