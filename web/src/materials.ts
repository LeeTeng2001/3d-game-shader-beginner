import * as THREE from 'three';
import vertex from './shaders/geometry.vert?raw';
import fragment from './shaders/geometry.frag?raw';
import lighting from './shaders/lighting.glsl?raw';

export const geometryFragment = fragment.replace('/* LIGHTING */', lighting);
export function lightingUniforms() {
  return {
    uShadow: { value: null as THREE.Texture | null }, uLightMatrix: { value: new THREE.Matrix4() },
    uLightPosition: { value: new THREE.Vector3(4, 8, 5) }, uShadows: { value: 1 },
    uLightIntensity: { value: 1.25 }, uBlinn: { value: 1 }, uShininess: { value: 40 },
    uCel: { value: 0 }, uBands: { value: 4 }, uFresnel: { value: 0 }, uReflectance: { value: 0.08 },
    uRim: { value: 0 }, uRimPower: { value: 3 },
  };
}
export function proceduralTextures() {
  const size = 64;
  const checker = new Uint8Array(size * size * 4);
  const normals = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    const c = ((x >> 3) + (y >> 3)) % 2 ? 235 : 115;
    checker.set([c, c, c, 255], i);
    const nx = Math.cos(x / size * Math.PI * 8) * 0.4;
    const ny = Math.sin(y / size * Math.PI * 8) * 0.4;
    const n = new THREE.Vector3(nx, ny, 1).normalize();
    normals.set([(n.x * 0.5 + 0.5) * 255, (n.y * 0.5 + 0.5) * 255, (n.z * 0.5 + 0.5) * 255, 255], i);
  }
  const make = (data: Uint8Array) => {
    const texture = new THREE.DataTexture(data, size, size);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  };
  const color = make(checker); color.colorSpace = THREE.SRGBColorSpace;
  return { checker: color, normal: make(normals) };
}
export function makeMaterial(color: string, textures: { checker: THREE.Texture; normal: THREE.Texture }, options: { texture?: boolean; emission?: number; water?: boolean } = {}) {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: vertex, fragmentShader: geometryFragment,
    uniforms: {
      ...lightingUniforms(),
      uChecker: { value: textures.checker }, uNormalMap: { value: textures.normal },
      uColor: { value: new THREE.Color(color) }, uEmission: { value: options.emission ?? 0 },
      uUseTexture: { value: options.texture ? 1 : 0 }, uNormalStrength: { value: 0 },
      uRepeat: { value: 2 }, uTime: { value: 0 }, uMode: { value: 0 },
      uWater: { value: options.water ? 1 : 0 }, uFlow: { value: 1 }, uFrequency: { value: 8 }, uSpace: { value: 0 },
      uAlphaCutoff: { value: 0 }, uNormalGreen: { value: 1 },
      uShadowPass: { value: 0 },
      uSpecularMap: { value: textures.checker }, uUseSpecular: { value: 0 },
    },
  });
}
export function makeLut(identity = false) {
  const size = 16;
  const data = new Uint8Array(size ** 3 * 4);
  for (let b = 0; b < size; b++) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++) {
    const channels = identity ? [r / 15, g / 15, b / 15] : [Math.pow(r / 15, 0.85) * 1.05, g / 15 * 0.93, b / 15 * 0.68];
    const offset = ((b * size + g) * size + r) * 4;
    data.set([...channels.map(v => Math.min(255, Math.round(v * 255))), 255], offset);
  }
  const texture = new THREE.Data3DTexture(data, size, size, size);
  texture.format = THREE.RGBAFormat;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.unpackAlignment = 1; texture.needsUpdate = true;
  return texture;
}
