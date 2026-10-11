precision highp float;
uniform sampler2D uChecker;
uniform sampler2D uNormalMap;
uniform sampler2D uShadow;
uniform sampler2D uSpecularMap;
uniform float uUseSpecular;
uniform float uAlphaCutoff;
uniform float uShadowPass;
uniform float uNormalGreen;
uniform mat4 uLightMatrix;
uniform vec3 uLightPosition;
uniform vec3 uColor;
uniform float uEmission;
uniform float uUseTexture;
uniform float uNormalStrength;
uniform float uRepeat;
uniform float uTime;
uniform float uWater;
uniform float uFlow;
uniform float uFrequency;
uniform float uSpace;
uniform int uMode;
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
in vec3 vPosition;
in vec3 vWorld;
in vec3 vModel;
in vec3 vNormal;
in vec3 vTangent;
in float vHandedness;
in vec2 vUv;
in vec3 vColor;
layout(location = 0) out vec4 sceneColor;
layout(location = 1) out vec4 positionBuffer;
layout(location = 2) out vec4 normalBuffer;
layout(location = 3) out vec4 materialBuffer;
/* LIGHTING */
void main() {
  vec2 uv = vUv * uRepeat;
  vec4 texel = texture(uChecker, uv);
  if (uUseTexture > 0.5 && texel.a < uAlphaCutoff) discard;
  if (uShadowPass > 0.5) {
    sceneColor = vec4(vec3(gl_FragCoord.z), 1.0);
    positionBuffer = normalBuffer = materialBuffer = vec4(0.0);
    return;
  }
  vec3 mapped = texture(uNormalMap, uv).xyz * 2.0 - 1.0;
  if (uWater > 0.5) {
    vec2 velocity = vec2(sin(vWorld.z * 0.8), cos(vWorld.x * 0.7)) * 0.24;
    float phase = fract(uTime * uFlow * 0.18);
    float phase2 = fract(phase + 0.5);
    vec3 a = texture(uNormalMap, uv - velocity * phase).xyz * 2.0 - 1.0;
    vec3 b = texture(uNormalMap, uv - velocity * phase2).xyz * 2.0 - 1.0;
    mapped = mix(a, b, abs(phase * 2.0 - 1.0));
  }
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  vec3 rawTangent = vTangent - n * dot(n, vTangent);
  vec3 t = length(rawTangent) > 0.001 ? normalize(rawTangent) : normalize(cross(n, abs(n.y) < 0.9 ? vec3(0,1,0) : vec3(1,0,0)));
  vec3 b = normalize(cross(n, t)) * vHandedness;
  mapped.xy *= uNormalStrength;
  mapped.y *= uNormalGreen;
  n = normalize(mat3(t, b, n) * normalize(mapped));
  vec3 albedo = uColor * vColor;
  if (uUseTexture > 0.5) albedo *= texel.rgb;
  vec3 color = illuminate(albedo, n, vPosition, vWorld, uEmission);
  if (uUseSpecular > 0.5) {
    // Keep the tutorial's specular texture visible without opaque engine bindings.
    vec3 s = texture(uSpecularMap, uv).rgb;
    vec3 l = normalize(uLightPosition - vPosition);
    float highlight = pow(max(dot(n, normalize(l + normalize(-vPosition))), 0.0), max(2.0, s.g * 127.75));
    color += s.r * highlight * visibility(vWorld) * 0.25;
  }
  if (uMode == 1) {
    vec3 p = uSpace < 0.5 ? vModel : (uSpace < 1.5 ? vWorld : vPosition);
    color = fract(p * 0.2 + 0.5);
  }
  if (uMode == 2) color = vec3(vUv, 0.5 + 0.5 * sin(vUv.x * uFrequency * 6.283185));
  if (uMode == 3) color = albedo;
  sceneColor = vec4(color, 1.0);
  positionBuffer = vec4(vPosition, 1.0);
  normalBuffer = vec4(n, 1.0);
  materialBuffer = vec4(albedo, uEmission);
}
