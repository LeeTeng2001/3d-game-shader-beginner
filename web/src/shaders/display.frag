precision highp float;
uniform sampler2D uInput;
uniform int uEncoding; // 0: color, 1: position, 2: normal, 3: mask, 4: shadow depth
uniform float uGammaMode;
in vec2 vUv;
out vec4 outColor;
vec3 toSrgb(vec3 linearColor) {
  return mix(12.92 * linearColor, 1.055 * pow(max(linearColor, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), linearColor));
}
void main() {
  vec4 sampleColor = texture(uInput, vUv);
  vec3 color = max(sampleColor.rgb, vec3(0.0));
  if (uEncoding == 1) color = (sampleColor.xyz * 0.06 + 0.5) * sampleColor.a;
  if (uEncoding == 2) color = (sampleColor.xyz * 0.5 + 0.5) * sampleColor.a;
  if (uEncoding == 4) color = vec3(sampleColor.r);
  if (uEncoding == 5) {
    float ndc = sampleColor.r * 2.0 - 1.0;
    float distance = (2.0 * 0.1 * 60.0) / (60.0 + 0.1 - ndc * (60.0 - 0.1));
    color = vec3(1.0 - clamp(distance / 25.0, 0.0, 1.0));
  }
  if (uEncoding == 0) {
    // A single display encoding. Values above one clip; no hidden tone mapper.
    if (uGammaMode < 0.5) color = toSrgb(color);
    else if (uGammaMode > 1.5) color = toSrgb(toSrgb(color));
  }
  outColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
