precision highp float;
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
in vec3 position;
in vec3 normal;
in vec2 uv;
in vec4 tangent;
in vec3 color;
out vec3 vColor;
out vec3 vPosition;
out vec3 vWorld;
out vec3 vModel;
out vec3 vNormal;
out vec3 vTangent;
out float vHandedness;
out vec2 vUv;
void main() {
  vColor = color;
  vModel = position;
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
  vNormal = normalize(normalMatrix * normal);
  vTangent = normalize(mat3(modelViewMatrix) * tangent.xyz);
  vHandedness = tangent.w;
  vUv = uv;
  gl_Position = projectionMatrix * vec4(vPosition, 1.0);
}
