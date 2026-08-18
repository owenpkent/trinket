#version 300 es
precision highp float;

// Metaball lamp. The CPU owns the physics and hands us a list of warm circles;
// everything that makes it look like wax happens here.

#define MAX_BLOBS 48

uniform vec2 uRes;
uniform int uCount;
// xy = centre in device pixels, z = radius, w = temperature in 0..1
uniform vec4 uBlobs[MAX_BLOBS];
uniform vec3 uHot;
uniform vec3 uCool;
uniform vec3 uGlass;
uniform float uGlow;
uniform float uTime;

out vec4 fragColor;

// Cheap value hash, used only to dither away gradient banding.
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  // The simulation uses y-down screen coordinates; gl_FragCoord is y-up.
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float shortEdge = min(uRes.x, uRes.y);

  float field = 0.0;
  float tempSum = 0.0;
  vec2 grad = vec2(0.0);

  for (int i = 0; i < MAX_BLOBS; i++) {
    if (i >= uCount) break;
    vec4 blob = uBlobs[i];
    vec2 d = p - blob.xy;
    // The +1.0 keeps the field finite at the exact centre of a blob.
    float d2 = dot(d, d) + 1.0;
    float r2 = blob.z * blob.z;
    float contribution = r2 / d2;
    field += contribution;
    tempSum += contribution * blob.w;
    // Analytic gradient of the same sum, so the surface normal costs one extra
    // multiply-add per blob instead of three more field evaluations.
    grad += (-2.0 * r2) * d / (d2 * d2);
  }

  float temp = field > 1e-4 ? tempSum / field : 0.0;
  float inside = smoothstep(0.92, 1.08, field);

  // Fake a rounded surface from the field gradient.
  vec3 normal = normalize(vec3(-grad * shortEdge * 0.35, 1.0));
  vec3 lightDir = normalize(vec3(-0.45, -0.65, 0.72));
  float diffuse = clamp(dot(normal, lightDir) * 0.5 + 0.5, 0.0, 1.0);
  float specular = pow(max(dot(reflect(-lightDir, normal), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);

  vec3 waxTint = mix(uCool, uHot, smoothstep(0.15, 0.85, temp));
  // Thicker wax is more saturated and glows a little from within.
  float thickness = clamp((field - 1.0) * 0.55, 0.0, 1.0);
  vec3 wax = waxTint * (0.42 + 0.75 * diffuse + 0.5 * thickness);
  wax += waxTint * uGlow * 0.35 * thickness;
  wax += vec3(specular) * (0.35 + 0.4 * uGlow);

  // Vessel: a cool vertical gradient with a warm pool at the heater.
  float heightT = p.y / uRes.y;
  vec3 background = uGlass * mix(0.28, 0.95, heightT);
  float heaterPulse = 0.85 + 0.15 * sin(uTime * 0.7);
  background += uHot * smoothstep(0.62, 1.0, heightT) * 0.28 * uGlow * heaterPulse;

  // Halo around the wax, which is what sells the backlit-glass look.
  float halo = smoothstep(0.18, 1.0, field) * (1.0 - inside);
  background += waxTint * halo * uGlow * 0.85;

  vec2 centered = (p / uRes) * 2.0 - 1.0;
  background *= 1.0 - 0.35 * dot(centered, centered) * 0.5;

  vec3 color = mix(background, wax, inside);
  // One step of dither, below the quantisation floor, kills the banding the
  // vertical gradient would otherwise show on a dark display.
  color += (hash(gl_FragCoord.xy + uTime) - 0.5) / 255.0;

  fragColor = vec4(color, 1.0);
}
