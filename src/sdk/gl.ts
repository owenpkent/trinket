/**
 * Just enough WebGL2 to run a full-screen fragment shader.
 *
 * Several toys are "CPU does the physics, GPU does the look" and need nothing
 * more than one triangle and a pile of uniforms. Anything heavier should reach
 * for the raw context, which the toy already has.
 */

/**
 * Covers the viewport with a single oversized triangle generated from
 * gl_VertexID, so there are no buffers and no attributes to manage.
 */
const FULLSCREEN_VERT = `#version 300 es
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Trinket: could not create shader.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown error';
    gl.deleteShader(shader);
    const kind = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
    throw new Error(`Trinket: ${kind} shader failed to compile.\n${log}`);
  }
  return shader;
}

export function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error('Trinket: could not create program.');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  // The shaders are reference-counted by the program, so drop our handles now.
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'unknown error';
    gl.deleteProgram(program);
    throw new Error(`Trinket: program failed to link.\n${log}`);
  }
  return program;
}

export interface FullscreenShader {
  readonly program: WebGLProgram;
  /** Cached uniform location. Returns null for names the linker dropped. */
  uniform(name: string): WebGLUniformLocation | null;
  /** Bind the program and set the viewport. Set uniforms after this. */
  use(width: number, height: number): void;
  /** Draw the covering triangle. */
  draw(): void;
  dispose(): void;
}

export function createFullscreenShader(
  gl: WebGL2RenderingContext,
  fragmentSource: string,
): FullscreenShader {
  const program = createProgram(gl, FULLSCREEN_VERT, fragmentSource);
  const locations = new Map<string, WebGLUniformLocation | null>();
  // WebGL2 requires a bound vertex array even when no attributes are enabled.
  const vao = gl.createVertexArray();

  return {
    program,
    uniform(name) {
      if (!locations.has(name)) {
        locations.set(name, gl.getUniformLocation(program, name));
      }
      return locations.get(name) ?? null;
    },
    use(width, height) {
      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
    },
    draw() {
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
      locations.clear();
    },
  };
}
