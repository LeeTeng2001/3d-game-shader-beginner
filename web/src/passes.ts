import * as THREE from 'three';
import fullscreen from './shaders/fullscreen.vert?raw';
import type { PassContext, RenderPass, TeachingScene } from './types';

export function makeTarget(float: boolean, count = 1) {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    count, type: float ? THREE.HalfFloatType : THREE.UnsignedByteType,
    format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    depthBuffer: true, generateMipmaps: false,
  });
  target.textures.forEach(t => { t.colorSpace = THREE.NoColorSpace; });
  return target;
}

export class ScreenPass implements RenderPass {
  readonly target: THREE.WebGLRenderTarget;
  readonly material: THREE.RawShaderMaterial;
  readonly outputs: Record<string, THREE.Texture>;
  private readonly scene = new THREE.Scene();
  private readonly geometry = new THREE.PlaneGeometry(2, 2);
  constructor(public name: string, public inputs: string[], fragment: string, uniforms: Record<string, THREE.IUniform>, float: boolean) {
    this.target = makeTarget(float);
    this.target.depthBuffer = false;
    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: fullscreen, fragmentShader: fragment, uniforms,
      depthTest: false, depthWrite: false,
    });
    const quad = new THREE.Mesh(this.geometry, this.material);
    // The vertex shader writes clip-space coordinates. Its world-space bounds
    // must not be culled against the orbiting scene camera.
    quad.frustumCulled = false;
    this.scene.add(quad);
    this.outputs = { [name]: this.target.texture };
    this.target.texture.name = name;
  }
  render({ renderer, camera }: PassContext, screen = false) {
    renderer.setRenderTarget(screen ? null : this.target);
    renderer.render(this.scene, camera);
  }
  resize(width: number, height: number) { this.target.setSize(width, height); }
  dispose() { this.target.dispose(); this.material.dispose(); this.geometry.dispose(); }
}

export class GeometryPass implements RenderPass {
  readonly target: THREE.WebGLRenderTarget;
  readonly inputs: string[] = ['shadow'];
  readonly outputs: Record<string, THREE.Texture>;
  constructor(public name: string, private teaching: TeachingScene, private layer: number, float: boolean) {
    this.target = makeTarget(float, float ? 4 : 1);
    this.target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
    this.outputs = Object.fromEntries(this.target.textures.map((t, i) => {
      const key = ['color', 'position', 'normal', 'material'][i];
      t.name = `${name}.${key}`; return [key, t];
    }));
  }
  render({ renderer, camera }: PassContext) {
    const oldMask = camera.layers.mask;
    camera.layers.set(this.layer);
    renderer.setRenderTarget(this.target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(this.teaching.scene, camera);
    camera.layers.mask = oldMask;
  }
  resize(width: number, height: number) { this.target.setSize(width, height); }
  dispose() { this.target.dispose(); }
}
