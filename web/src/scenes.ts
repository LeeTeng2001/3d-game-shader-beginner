import * as THREE from 'three';
import { makeMaterial, proceduralTextures } from './materials';
import type { SceneKind, TeachingScene } from './types';
import { createMillScene } from './mill';

export function createTeachingScene(kind: SceneKind): TeachingScene {
  if (kind === 'mill') return createMillScene();
  const scene = new THREE.Scene();
  const textures = proceduralTextures();
  const materials: THREE.RawShaderMaterial[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const material = (color: string, options = {}) => {
    const m = makeMaterial(color, textures, options); materials.push(m); return m;
  };
  const add = (geometry: THREE.BufferGeometry, mat: THREE.RawShaderMaterial, x: number, y: number, z: number) => {
    geometry.computeTangents(); geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(x, y, z); scene.add(mesh); return mesh;
  };
  const floor = add(new THREE.BoxGeometry(10, 0.18, 8), material('#94a5a6', { texture: true }), 0, -0.16, 0);
  floor.name = 'floor';
  const ceramic = material('#62cfcc');
  const copper = material('#df925c');
  const cream = material('#e9dac0');
  add(new THREE.CylinderGeometry(1.25, 1.35, 0.35, 64), material('#354b58'), -1.6, 0.09, 0.3);
  const sphere = add(new THREE.SphereGeometry(1.0, 48, 32), ceramic, -1.6, 1.28, 0.3);
  const knot = add(new THREE.TorusKnotGeometry(0.65, 0.23, 100, 16), copper, 1.1, 1.35, 0.2);
  add(new THREE.BoxGeometry(1.8, 0.5, 1.7), material('#435867'), 1.1, 0.15, 0.2);
  const glow = add(new THREE.SphereGeometry(0.23, 24, 16), material('#ffd487', { emission: 5 }), 0.2, 2.2, -1.6);
  add(new THREE.TorusGeometry(0.55, 0.035, 12, 60), cream, 0.2, 2.2, -1.6);
  if (kind === 'occlusion') {
    for (let i = 0; i < 6; i++) {
      const height = 0.6 + i * 0.38;
      add(new THREE.BoxGeometry(0.65, height, 0.8), i % 2 ? copper : cream, -2.3 + i * 0.85, height / 2, -2.25);
    }
    add(new THREE.BoxGeometry(7, 2.8, 0.25), material('#6c8388'), 0, 1.3, -3.2);
  }
  if (kind === 'water') {
    floor.position.y = -0.5;
    const water = add(new THREE.PlaneGeometry(9.6, 7.6, 1, 1), material('#267d87', { water: true }), 0, 0.18, 0);
    water.rotation.x = -Math.PI / 2;
    water.layers.set(1); water.name = 'water-surface';
    // Sloped banks and rocks intersect the pool, providing shallow foam regions.
    const bank = add(new THREE.BoxGeometry(3.2, 0.3, 6), material('#92958a', { texture: true }), -3.8, -0.05, 0);
    bank.rotation.z = -0.14;
    for (let i = 0; i < 5; i++) {
      const rock = add(new THREE.SphereGeometry(0.6, 24, 16), cream, -2.3 + i * 1.1, -0.04, 2.0);
      rock.scale.set(1, 0.7, 0.85);
    }
  }
  const particleMaterial = material('#eab875', { emission: 1.4 });
  const particles = Array.from({ length: 12 }, (_, i) => {
    const mesh = add(new THREE.SphereGeometry(0.022 + (i % 3) * 0.008, 8, 6), particleMaterial, 0, 0, 0);
    return mesh;
  });
  return {
    scene, materials,
    update(time) {
      knot.rotation.set(time * 0.12, time * 0.2, 0.15);
      sphere.rotation.y = time * 0.08;
      glow.position.y = 2.2 + Math.sin(time) * 0.15;
      particles.forEach((p, i) => p.position.set(Math.sin(i * 2.4 + time * 0.13) * 2.8, 0.4 + ((i * 0.23 + time * 0.14) % 2.6), Math.cos(i * 1.7) * 2));
      for (const m of materials) m.uniforms.uTime.value = time;
      scene.updateMatrixWorld(true);
    },
    dispose() {
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
      textures.checker.dispose(); textures.normal.dispose();
    },
  };
}
