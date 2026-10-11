import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, proceduralTextures } from './materials';
import type { TeachingScene } from './types';

export function createMillScene(): TeachingScene {
  const scene = new THREE.Scene();
  const materials: THREE.RawShaderMaterial[] = [];
  const textures = proceduralTextures();
  const ownedTextures = new Set<THREE.Texture>(Object.values(textures));
  const geometries = new Set<THREE.BufferGeometry>();
  let disposed = false;
  let wheel: THREE.Mesh | undefined;
  const url = new URL('./mill/mill.gltf', location.href).href;
  const ready = import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => new GLTFLoader().loadAsync(url)).then(async gltf => {
    const root = gltf.scene;
    const meshList: THREE.Mesh[] = [];
    root.traverse(object => { if (object instanceof THREE.Mesh) meshList.push(object); });
    const bounds = new THREE.Box3().setFromObject(root);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const scale = 10 / Math.max(size.x, size.z);
    const placement = new THREE.Matrix4().makeScale(scale, scale, scale);
    placement.setPosition(-center.x * scale, -bounds.min.y * scale - 0.25, -center.z * scale);
    const materialCache = new Map<string, THREE.RawShaderMaterial>();
    const pendingTextures = new Map<string, Promise<THREE.Texture>>();
    const textureLoader = new THREE.TextureLoader();
    const loadMap = (name: string) => {
      if (!pendingTextures.has(name)) pendingTextures.set(name, textureLoader.loadAsync(new URL(`./mill/tex/${name}`, location.href).href).then(texture => {
        texture.flipY = false; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.colorSpace = THREE.NoColorSpace; ownedTextures.add(texture); return texture;
      }));
      return pendingTextures.get(name)!;
    };
    const batches = new Map<THREE.RawShaderMaterial, THREE.BufferGeometry[]>();
    for (const mesh of meshList) {
      const original = mesh.material as THREE.MeshStandardMaterial;
      for (const value of Object.values(original)) if (value instanceof THREE.Texture) ownedTextures.add(value);
      const name = String(mesh.userData.eggGroup ?? mesh.name);
      const water = name.endsWith('/water-lp');
      const emissive = /house-windows/.test(name);
      const key = `${original.uuid}:${water}:${emissive}`;
      let material = materialCache.get(key);
      if (!material) {
        material = makeMaterial('#ffffff', { checker: original.map ?? textures.checker, normal: original.normalMap ?? textures.normal }, { texture: !!original.map, water, emission: emissive ? 2.2 : 0 });
        material.side = THREE.DoubleSide;
        material.uniforms.uAlphaCutoff.value = 0.35;
        material.uniforms.uNormalGreen.value = -1;
        if (original.userData.specular) {
          material.uniforms.uSpecularMap.value = await loadMap(original.userData.specular);
          material.uniforms.uUseSpecular.value = 1;
        }
        material.userData.mill = true;
        materials.push(material); materialCache.set(key, material);
      }
      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(placement);
      // The existing tutorial contains a few singular UV triangles. Three.js
      // computes the remaining tangents; the shader guards degenerate bases.
      geometry.computeTangents();
      if (name.endsWith('/wheel-lp')) {
        const pivot = new THREE.Vector3(...(mesh.userData.pivot as [number, number, number])).applyMatrix4(placement);
        geometry.translate(-pivot.x, -pivot.y, -pivot.z);
        wheel = new THREE.Mesh(geometry, material); wheel.position.copy(pivot); wheel.name = 'original-waterwheel'; scene.add(wheel); geometries.add(geometry);
      } else {
        const list = batches.get(material) ?? []; list.push(geometry); batches.set(material, list);
      }
      mesh.geometry.dispose();
    }
    for (const [material, parts] of batches) {
      const geometry = mergeGeometries(parts);
      if (!geometry) throw new Error('Could not combine the original mill geometry.');
      parts.forEach(g => g.dispose()); geometries.add(geometry);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = material.uniforms.uWater.value ? 'original-water' : 'original-mill';
      if (material.uniforms.uWater.value) mesh.layers.set(1);
      scene.add(mesh);
    }
    new Set(meshList.map(mesh => mesh.material as THREE.Material)).forEach(m => m.dispose());
    scene.userData.asset = { meshes: meshList.length, scale, source: 'mill-scene.egg + banner + shutters + weather-vane', triangles: 126168 };
    if (disposed) release();
  });
  function release() {
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); ownedTextures.forEach(t => t.dispose()); scene.clear();
  }
  return { scene, materials, ready,
    update(time) {
      if (wheel) wheel.rotation.x = -time * 0.65;
      for (const m of materials) m.uniforms.uTime.value = time;
      scene.updateMatrixWorld(true);
    },
    dispose() { disposed = true; release(); },
  };
}
