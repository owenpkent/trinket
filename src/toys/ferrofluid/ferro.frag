#version 300 es
precision highp float;

// Anisotropic metaballs. Each blob's falloff is stretched along the line to the
// magnet, so a mass that would otherwise be a puddle grows spikes toward the
// cursor. That single change is what separates this from the lava lamp.

#define MAX_PARTICLES 64

uniform vec2 uRes;
uniform int uCount;
// xy = centre in device pixels, z = radius, w = magnetic influence in 0..1
uniform vec4 uParts[MAX_PARTICLES];
uniform vec2 uMagnet;
uniform float uSpike;
uniform vec3 uSheen;
uniform vec3 uWarm;
uniform float uTime;

out vec4 fragColor;

void main() {
  // Physics uses y-down screen coordinates; gl_FragCoord is y-up.
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float shortEdge = min(uRes.x, uRes.y);

  float field = 0.0;
  vec2 grad = vec2(0.0);
  float charge = 0.0;

  for (int i = 0; i < MAX_PARTICLES; i++) {
    if (i >= uCount) break;
    vec4 part = uParts[i];

    vec2 toMagnet = uMagnet - part.xy;
    float magnetDistance = length(toMagnet);
    // Field lines point at the magnet. With no magnet in play the axis is
    // arbitrary, and the stretch factor below is 1 anyway.
    vec2 axis = magnetDistance > 1e-3 ? toMagnet / magnetDistance : vec2(0.0, -1.0);
    vec2 perp = vec2(-axis.y, axis.x);
    float stretch = 1.0 + uSpike * part.w;

    vec2 d = p - part.xy;
    float along = dot(d, axis) / stretch;
    float across = dot(d, perp);
    float q = along * along + across * across + 1.0;
    float r2 = part.z * part.z;

    field += r2 / q;
    charge += (r2 / q) * part.w;
    // Gradient of the stretched metric, so lighting follows the spikes.
    vec2 dq = 2.0 * (along / stretch) * axis + 2.0 * across * perp;
    grad += (-r2 / (q * q)) * dq;
  }

  float influence = field > 1e-4 ? charge / field : 0.0;
  float inside = smoothstep(0.94, 1.06, field);

  // The gradient magnitude at the surface goes as 2/radius, so the scale that
  // turns it into a usable normal has to be on the order of a blob radius. Using
  // the full short edge tips every normal into the view plane, which lights the
  // whole mass as if it were rim, and the result is a flat matte balloon.
  vec3 normal = normalize(vec3(-grad * shortEdge * 0.03, 1.0));
  vec3 view = vec3(0.0, 0.0, 1.0);
  vec3 keyLight = normalize(vec3(-0.42, -0.66, 0.62));
  vec3 rimLight = normalize(vec3(0.55, 0.35, 0.35));

  float key = max(dot(normal, keyLight), 0.0);
  float rim = pow(1.0 - max(dot(normal, view), 0.0), 3.6);
  float gloss = pow(max(dot(reflect(-keyLight, normal), view), 0.0), 90.0);
  float sheenSpec = pow(max(dot(reflect(-rimLight, normal), view), 0.0), 22.0);

  // Ferrofluid is essentially black. Everything you see on it is a reflection,
  // so the base stays near zero and the highlights do all the work. Raising the
  // diffuse term is the fastest way to turn this back into a matte balloon.
  vec3 body = vec3(0.008, 0.009, 0.013);
  body += uSheen * 0.055 * key;
  body += uSheen * rim * 0.42;
  body += uWarm * gloss * 2.4;
  body += uSheen * sheenSpec * 0.30;
  // Charged goo gets a faint glow along its spikes.
  body += uSheen * influence * 0.10;

  // Backdrop: a dark room with a soft pool of light where the magnet is.
  vec2 uv = p / uRes;
  vec3 background = mix(vec3(0.030, 0.034, 0.046), vec3(0.010, 0.011, 0.017), uv.y);
  float lamp = 1.0 - smoothstep(0.0, shortEdge * 0.5, distance(p, uMagnet));
  background += uSheen * lamp * lamp * 0.10;

  // Contact shadow under the mass, which is what makes it sit on the floor
  // instead of floating in front of the backdrop.
  float shadow = smoothstep(0.06, 0.9, field) * (1.0 - inside);
  background *= 1.0 - shadow * 0.75;

  vec3 color = mix(background, body, inside);
  // Dither, below the quantisation floor, to keep the dark gradient clean.
  color += (fract(sin(dot(gl_FragCoord.xy + uTime, vec2(12.989, 78.233))) * 43758.545) - 0.5) / 255.0;

  fragColor = vec4(color, 1.0);
}
