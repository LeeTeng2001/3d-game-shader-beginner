// Shared by the forward geometry shader and the deferred lighting pass.
float visibility(vec3 world) {
  if (uShadows < 0.5) return 1.0;
  vec4 q = uLightMatrix * vec4(world, 1.0);
  vec3 p = q.xyz / q.w * 0.5 + 0.5;
  if (any(lessThan(p, vec3(0.0))) || any(greaterThan(p, vec3(1.0)))) return 1.0;
  float sum = 0.0;
  vec2 texel = 1.0 / vec2(textureSize(uShadow, 0));
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    float depth = texture(uShadow, p.xy + vec2(x, y) * texel).r;
    sum += p.z - 0.0025 <= depth ? 1.0 : 0.0;
  }
  return sum / 9.0;
}
vec3 illuminate(vec3 albedo, vec3 n, vec3 position, vec3 world, float emission) {
  vec3 l = normalize(uLightPosition - position);
  vec3 v = normalize(-position);
  float diffuse = max(dot(n, l), 0.0);
  if (uCel > 0.5) diffuse = floor(diffuse * uBands) / max(uBands - 1.0, 1.0);
  float highlight = uBlinn > 0.5 ? dot(n, normalize(l + v)) : dot(reflect(-l, n), v);
  float specular = pow(max(highlight, 0.0), uShininess) * step(0.001, diffuse);
  float shadow = visibility(world);
  vec3 color = albedo * (0.16 + diffuse * shadow * uLightIntensity) + vec3(0.35 * specular * shadow);
  // Rounding can make the dot of unit vectors slightly greater than one.
  // pow with a negative base is undefined in GLSL, even for integer exponents.
  float grazing = 1.0 - clamp(dot(n, v), 0.0, 1.0);
  float fresnel = uReflectance + (1.0 - uReflectance) * pow(grazing, 5.0);
  color += uFresnel * fresnel * vec3(0.25, 0.6, 0.8);
  color += uRim * pow(grazing, uRimPower) * vec3(0.25, 0.85, 0.9);
  return color + albedo * emission;
}
