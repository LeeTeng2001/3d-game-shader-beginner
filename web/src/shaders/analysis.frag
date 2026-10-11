precision highp float;
uniform sampler2D uPosition;
uniform sampler2D uNormal;
uniform sampler2D uWaterPosition;
uniform sampler2D uWaterNormal;
uniform mat4 uProjection;
uniform mat4 uInverseView;
uniform int uOperation; // 0: SSAO, 1: outline, 2: reflection, 3: refraction, 4: foam
uniform float uRadius;
uniform float uStrength;
uniform float uSensitivity;
uniform float uRayDistance;
uniform float uIor;
uniform float uFoamWidth;
uniform float uTime;
in vec2 vUv;
out vec4 outColor;
vec2 projectPoint(vec3 p) {
  vec4 q = uProjection * vec4(p, 1.0);
  return q.xy / q.w * 0.5 + 0.5;
}
bool outside(vec2 uv) { return any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0))); }
void main() {
  vec4 p = texture(uPosition, vUv);
  vec3 n = texture(uNormal, vUv).xyz;
  vec2 texel = 1.0 / vec2(textureSize(uPosition, 0));
  outColor = vec4(0.0, 0.0, 0.0, 1.0);
  if (uOperation == 0) {
    if (p.a < 0.5) { outColor = vec4(1.0); return; }
    n = normalize(n);
    vec3 tangent = normalize(cross(n, abs(n.y) < 0.9 ? vec3(0, 1, 0) : vec3(1, 0, 0)));
    mat3 basis = mat3(tangent, cross(n, tangent), n);
    float occlusion = 0.0;
    for (int i = 0; i < 24; i++) {
      float f = (float(i) + 0.5) / 24.0;
      float angle = float(i) * 2.399963;
      vec3 direction = vec3(cos(angle) * sqrt(1.0 - f * f), sin(angle) * sqrt(1.0 - f * f), f);
      vec3 samplePoint = p.xyz + basis * direction * uRadius * mix(0.1, 1.0, f * f);
      vec2 uv = projectPoint(samplePoint);
      if (outside(uv)) continue;
      vec4 surface = texture(uPosition, uv);
      float range = smoothstep(0.0, 1.0, uRadius / max(abs(p.z - surface.z), 0.001));
      occlusion += surface.a * step(samplePoint.z + 0.035, surface.z) * range;
    }
    outColor = vec4(vec3(clamp(1.0 - occlusion / 24.0 * uStrength, 0.0, 1.0)), 1.0); return;
  }
  if (uOperation == 1) {
    float edge = 0.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 uv = vUv + vec2(x, y) * texel;
      vec4 q = texture(uPosition, uv);
      vec3 otherNormal = texture(uNormal, uv).xyz;
      float depthEdge = abs(p.z - q.z) / max(abs(p.z), 1.0);
      float normalEdge = length(n - otherNormal) * 0.25;
      edge = max(edge, max(depthEdge, normalEdge));
    }
    outColor = vec4(vec3(smoothstep(0.08, 0.2, edge * uSensitivity)), 1.0); return;
  }
  vec4 water = texture(uWaterPosition, vUv);
  if (water.a < 0.5 || (p.a > 0.5 && p.z > water.z + 0.01)) return;
  vec3 normal = normalize(texture(uWaterNormal, vUv).xyz);
  if (uOperation == 4) {
    vec3 worldWater = (uInverseView * vec4(water.xyz, 1.0)).xyz;
    vec3 worldFloor = (uInverseView * vec4(p.xyz, 1.0)).xyz;
    float depth = max(worldWater.y - worldFloor.y, 0.0);
    float shallow = (1.0 - smoothstep(0.0, uFoamWidth, depth)) * p.a;
    float pattern = 0.5 + 0.5 * sin(worldWater.x * 18.0 + sin(worldWater.z * 12.0) + uTime * 1.7);
    outColor = vec4(vec3(shallow * smoothstep(0.2, 0.65, pattern)), 1.0); return;
  }
  vec3 incident = normalize(water.xyz);
  vec3 ray = uOperation == 2 ? reflect(incident, normal) : refract(incident, normal, 1.0 / uIor);
  vec3 start = water.xyz + ray * 0.07;
  float previousDepth = 0.0;
  for (int i = 1; i <= 64; i++) {
    float distance = float(i) / 64.0 * uRayDistance;
    vec3 point = start + ray * distance;
    if (point.z > -0.1) break;
    vec2 uv = projectPoint(point);
    if (outside(uv)) break;
    vec4 surface = texture(uPosition, uv);
    float delta = surface.z - point.z;
    if (surface.a > 0.5 && delta > 0.0 && delta < 0.3 && previousDepth <= 0.0) {
      float lo = max(0.0, distance - uRayDistance / 64.0), hi = distance;
      for (int refinement = 0; refinement < 5; refinement++) {
        float middle = (lo + hi) * 0.5;
        vec3 probe = start + ray * middle;
        vec2 probeUv = projectPoint(probe);
        vec4 sampleSurface = texture(uPosition, probeUv);
        if (sampleSurface.a > 0.5 && sampleSurface.z > probe.z) hi = middle; else lo = middle;
      }
      uv = projectPoint(start + ray * hi);
      float edge = min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y));
      float confidence = smoothstep(0.0, 0.08, edge) * (1.0 - distance / uRayDistance);
      outColor = vec4(uv, confidence, 1.0); return;
    }
    previousDepth = surface.a > 0.5 ? delta : 0.0;
  }
}
