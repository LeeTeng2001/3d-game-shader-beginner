precision highp float;
precision highp sampler3D;
uniform sampler2D uInput;
uniform sampler2D uBlur;
uniform sampler2D uPosition;
uniform sampler2D uNormal;
uniform sampler2D uMaterial;
uniform sampler2D uMask;
uniform sampler2D uWaterPosition;
uniform sampler2D uWaterNormal;
uniform sampler2D uReflection;
uniform sampler2D uRefraction;
uniform sampler2D uFoam;
uniform sampler2D uShadow;
uniform sampler3D uLut;
uniform mat4 uInverseView;
uniform mat4 uPreviousViewProjection;
uniform mat4 uLightMatrix;
uniform vec3 uLightPosition;
uniform int uMode;
uniform float uEnabled;
uniform float uTime;
uniform float uAmount;
uniform float uBloom;
uniform float uFogDistance;
uniform float uFocus;
uniform float uAperture;
uniform float uLevels;
uniform float uBlock;
uniform float uRadius;
uniform float uWater;
uniform float uReflectEnabled;
uniform float uRefractEnabled;
uniform float uFoamEnabled;
uniform float uShadows;
uniform float uLightIntensity;
uniform float uBlinn;
uniform float uShininess;
uniform float uCel;
uniform float uBands;
uniform float uFresnel;
uniform float uReflectance;
uniform float uRim;
uniform float uRimPower;
in vec2 vUv;
out vec4 outColor;
/* LIGHTING */
void main() {
  vec2 size = vec2(textureSize(uInput, 0));
  vec2 texel = 1.0 / size;
  vec4 source = texture(uInput, vUv);
  vec3 backdrop = mix(vec3(0.015, 0.025, 0.04), vec3(0.055, 0.085, 0.11), vUv.y);
  vec3 original = mix(backdrop, source.rgb, source.a);
  vec3 color = original;
  vec4 p = texture(uPosition, vUv);
  vec3 blurred = texture(uBlur, vUv).rgb;
  if (uMode == 8) color = blurred;
  // Zero times NaN is still NaN: disabled bloom must not consume a blur buffer.
  if ((uMode == 9 || uMode == 0) && uBloom > 0.0) color += blurred * uBloom;
  if (uMode == 13 && p.a > 0.5) {
    vec4 material = texture(uMaterial, vUv);
    vec3 world = (uInverseView * vec4(p.xyz, 1.0)).xyz;
    color = illuminate(material.rgb, normalize(texture(uNormal, vUv).xyz), p.xyz, world, material.a);
  }
  if (uMode == 14 && p.a > 0.5) color = mix(color, vec3(0.25, 0.38, 0.43), smoothstep(uFogDistance * 0.2, uFogDistance, -p.z));
  if (uMode == 15) color *= texture(uMask, vUv).r;
  if (uMode == 16 && p.a > 0.5) {
    vec4 previous = uPreviousViewProjection * uInverseView * vec4(p.xyz, 1.0);
    vec2 oldUv = previous.w > 0.0001 ? previous.xy / previous.w * 0.5 + 0.5 : vUv;
    vec2 velocity = clamp((vUv - oldUv) * uAmount, vec2(-0.15), vec2(0.15));
    vec3 sum = vec3(0.0);
    for (int i = 0; i < 12; i++) sum += texture(uInput, clamp(vUv - velocity * float(i) / 11.0, vec2(0.0), vec2(1.0))).rgb;
    color = sum / 12.0;
  }
  if (uMode == 17) {
    vec2 offset = (vUv - 0.5) * uAmount * 0.05;
    color.r = texture(uInput, vUv + offset).r;
    color.b = texture(uInput, vUv - offset).b;
  }
  if (uMode == 22) color *= 1.0 - texture(uMask, vUv).r * 0.95;
  if (uMode == 23 && p.a > 0.5) {
    float coc = clamp(abs(-p.z - uFocus) / max(-p.z, 0.1) * uAperture, 0.0, 1.0);
    color = mix(color, blurred, coc);
  }
  if (uMode == 24) color = floor(color * (uLevels - 1.0) + 0.5) / (uLevels - 1.0);
  if (uMode == 25) color = texture(uInput, (floor(vUv * size / uBlock) + 0.5) * uBlock / size).rgb;
  if (uMode == 26) color = max(color + (color - blurred) * uAmount, vec3(0.0));
  if (uMode == 27) {
    float best = dot(color, vec3(0.2126, 0.7152, 0.0722));
    for (int y = -6; y <= 6; y++) for (int x = -6; x <= 6; x++) {
      if (abs(float(x)) > uRadius || abs(float(y)) > uRadius) continue;
      vec3 sampleColor = texture(uInput, vUv + vec2(x, y) * texel).rgb;
      float brightness = dot(sampleColor, vec3(0.2126, 0.7152, 0.0722));
      if (brightness > best) { best = brightness; color = sampleColor; }
    }
  }
  if (uMode == 28) {
    float noise = fract(sin(dot(floor(vUv * size) + floor(uTime * 24.0), vec2(12.9898, 78.233))) * 43758.5453);
    color = max(color + (noise - 0.5) * uAmount * 0.25, vec3(0.0));
  }
  if (uMode == 29) {
    vec3 coordinate = (clamp(color, 0.0, 1.0) * 15.0 + 0.5) / 16.0;
    color = mix(color, texture(uLut, coordinate).rgb, uAmount);
  }
  if (uWater > 0.5) {
    vec4 water = texture(uWaterPosition, vUv);
    if (water.a > 0.5 && (p.a < 0.5 || water.z >= p.z - 0.01)) {
      vec3 n = normalize(texture(uWaterNormal, vUv).xyz);
      vec3 view = normalize(-water.xyz);
      float fresnel = 0.02 + 0.98 * pow(1.0 - clamp(dot(n, view), 0.0, 1.0), 5.0);
      vec3 reflectionHit = texture(uReflection, vUv).rgb;
      vec3 refractionHit = texture(uRefraction, vUv).rgb;
      vec3 reflected = mix(vec3(0.22, 0.4, 0.48), texture(uInput, reflectionHit.xy).rgb, reflectionHit.z);
      vec3 refracted = mix(original, texture(uInput, refractionHit.xy).rgb, refractionHit.z) * vec3(0.58, 0.88, 0.9);
      bool reflectOn = (uMode == 18 || uMode == 21 || uMode == 0) && uReflectEnabled > 0.5;
      bool refractOn = (uMode == 19 || uMode == 21 || uMode == 0) && uRefractEnabled > 0.5;
      vec3 waterColor = mix(original, vec3(0.015, 0.17, 0.2), 0.38);
      if (refractOn) waterColor = refracted;
      if (reflectOn) waterColor = mix(waterColor, reflected, clamp(fresnel + 0.18, 0.0, 1.0));
      if ((uMode == 20 || uMode == 0) && uFoamEnabled > 0.5) waterColor = mix(waterColor, vec3(0.9, 1.0, 0.97), texture(uFoam, vUv).r);
      float glint = pow(max(dot(n, normalize(normalize(uLightPosition - water.xyz) + view)), 0.0), 100.0);
      color = waterColor + vec3(0.9) * glint;
      // Keep the water surface when comparing one water technique. Flow's baseline
      // uses the same composition with a stationary normal pattern supplied upstream.
      original = uMode == 21 ? color : mix(original, vec3(0.015, 0.17, 0.2), 0.38) + vec3(0.9) * glint;
    }
  }
  outColor = vec4(mix(original, color, uEnabled), 1.0);
}
