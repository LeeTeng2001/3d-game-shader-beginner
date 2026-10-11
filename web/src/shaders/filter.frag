precision highp float;
uniform sampler2D uInput;
uniform vec2 uDirection;
uniform float uRadius;
uniform float uThreshold;
uniform int uFilter; // 0: box, 1: Gaussian, 2: median, 3: Kuwahara, 4: extract
in vec2 vUv;
out vec4 outColor;
float luminance(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main() {
  vec2 texel = 1.0 / vec2(textureSize(uInput, 0));
  if (uFilter == 4) {
    vec3 c = texture(uInput, vUv).rgb;
    float l = luminance(c);
    outColor = vec4(c * max(l - uThreshold, 0.0) / max(l, 0.0001), 1.0);
    return;
  }
  if (uFilter == 2) {
    vec3 samples[9];
    int index = 0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      samples[index++] = texture(uInput, vUv + vec2(x, y) * texel * max(1.0, uRadius)).rgb;
    }
    for (int i = 0; i < 9; i++) for (int j = 0; j < 8; j++) {
      if (luminance(samples[j]) > luminance(samples[j + 1])) {
        vec3 temporary = samples[j]; samples[j] = samples[j + 1]; samples[j + 1] = temporary;
      }
    }
    outColor = vec4(samples[4], 1.0); return;
  }
  if (uFilter == 3) {
    float best = 1e20;
    vec3 result = vec3(0.0);
    for (int quadrant = 0; quadrant < 4; quadrant++) {
      vec2 direction = vec2((quadrant % 2) == 0 ? -1.0 : 1.0, quadrant < 2 ? -1.0 : 1.0);
      vec3 sum = vec3(0.0), squared = vec3(0.0);
      float count = 0.0;
      for (int y = 0; y <= 4; y++) for (int x = 0; x <= 4; x++) {
        if (float(x) > uRadius || float(y) > uRadius) continue;
        vec3 c = texture(uInput, vUv + vec2(x, y) * direction * texel).rgb;
        sum += c; squared += c * c; count += 1.0;
      }
      vec3 mean = sum / count;
      float variance = luminance(abs(squared / count - mean * mean));
      if (variance < best) { best = variance; result = mean; }
    }
    outColor = vec4(result, 1.0); return;
  }
  vec3 sum = vec3(0.0);
  float weights = 0.0;
  float sigma = max(uRadius * 0.5, 0.5);
  for (int i = -12; i <= 12; i++) {
    if (abs(float(i)) > uRadius) continue;
    float weight = uFilter == 0 ? 1.0 : exp(-float(i * i) / (2.0 * sigma * sigma));
    sum += texture(uInput, vUv + uDirection * texel * float(i)).rgb * weight;
    weights += weight;
  }
  outColor = vec4(sum / max(weights, 0.0001), 1.0);
}
