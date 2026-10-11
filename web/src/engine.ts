import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GeometryPass, ScreenPass, makeTarget } from './passes';
import { createTeachingScene } from './scenes';
import { lightingUniforms, makeLut } from './materials';
import { compiledComposite, sources } from './lessons';
import type { BufferView, Lesson, RenderPass, SceneKind, TeachingScene } from './types';
import { finaleDefaults, type FinaleSettings } from './finale';

export const defaults: Record<string, number> = {
  bloom: 0, normalStrength: 0, rim: 0, rimPower: 3, fresnel: 0, reflectance: 0.08,
  shadows: 1, lightIntensity: 1.25, blinn: 1, shininess: 40, cel: 0, bands: 4,
  space: 0, frequency: 8, repeat: 2, filter: 1, radius: 4, threshold: 0.9,
  strength: 2.5, sensitivity: 1.5, rayDistance: 16, ior: 1.33, foamWidth: 0.7,
  flow: 1, amount: 1, fogDistance: 14, focus: 10, aperture: 3, levels: 5, block: 10, gammaMode: 0,
};
const lightingKeys = ['shadows', 'lightIntensity', 'blinn', 'shininess', 'cel', 'bands', 'fresnel', 'reflectance', 'rim', 'rimPower'];
const uniformName = (key: string) => 'u' + key[0].toUpperCase() + key.slice(1);
type Uniforms = Record<string, THREE.IUniform>;

export class ShaderEngine {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
  readonly controls: OrbitControls;
  readonly float: boolean;
  readonly ready: Promise<void>;
  readonly effects: FinaleSettings = finaleDefaults();
  private assetsReady = false;
  readonly buffers: Record<string, BufferView> = {};
  readonly params: Record<string, number> = { ...defaults };
  readonly stats = { frames: 0, framebufferChecks: 0, shaderErrors: [] as string[] };
  enabled = true;
  paused = false;
  quality = 1;
  buffer = 'Final image';
  time = 0;
  sceneKind: SceneKind;
  private teaching: TeachingScene;
  private opaque: GeometryPass;
  private water: GeometryPass;
  private bright: ScreenPass;
  private blurX: ScreenPass;
  private blurY: ScreenPass;
  private mask: ScreenPass;
  private reflection: ScreenPass;
  private refraction: ScreenPass;
  private foam: ScreenPass;
  private composite: ScreenPass;
  private display: ScreenPass;
  private chain?: ScreenPass;
  private edges?: ScreenPass;
  private passes: RenderPass[];
  private shadow = makeTarget(false);
  private shadowMaterial: THREE.RawShaderMaterial;
  private lightCamera = new THREE.OrthographicCamera(-7, 7, 7, -7, 0.1, 25);
  private lightMatrix = new THREE.Matrix4();
  private lightWorld = new THREE.Vector3(-3, 7, 4);
  private previousVP = new THREE.Matrix4();
  private historyValid = false;
  private lut = makeLut();
  private width = 0;
  private height = 0;

  constructor(private canvas: HTMLCanvasElement, readonly lesson: Lesson, forceNoFloat = false) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
      const error = [gl.getProgramInfoLog(program), gl.getShaderInfoLog(vertex), gl.getShaderInfoLog(fragment)].join('\n');
      this.stats.shaderErrors.push(error); console.error(error);
    };
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    this.float = !forceNoFloat && !!gl.getExtension('EXT_color_buffer_float') && gl.getParameter(gl.MAX_DRAW_BUFFERS) >= 4 && gl.getParameter(gl.MAX_COLOR_ATTACHMENTS) >= 4;
    this.sceneKind = lesson.scene;
    this.teaching = lesson.createScene();
    this.ready = (this.teaching.ready ?? Promise.resolve()).then(() => { this.assetsReady = true; this.resetCamera(); });
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 3; this.controls.maxDistance = 25;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.resetCamera();
    this.opaque = new GeometryPass('opaque', this.teaching, 0, this.float);
    this.water = new GeometryPass('water', this.teaching, 1, this.float);
    this.shadow.setSize(1024, 1024);
    this.shadow.depthTexture = new THREE.DepthTexture(1024, 1024, THREE.UnsignedIntType);
    this.shadowMaterial = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: sources['geometry.vert'], fragmentShader: sources['shadow.frag'] });
    this.lightCamera.position.copy(this.lightWorld); this.lightCamera.lookAt(0, 0, 0); this.lightCamera.updateMatrixWorld();
    if (lesson.mode === 31) {
      this.lightWorld.set(-4, 10, 5); this.lightCamera.position.copy(this.lightWorld);
      this.lightCamera.lookAt(0, 2, 0); this.lightCamera.far = 35;
      this.lightCamera.updateProjectionMatrix(); this.lightCamera.updateMatrixWorld();
    }
    this.lightMatrix.multiplyMatrices(this.lightCamera.projectionMatrix, this.lightCamera.matrixWorldInverse);
    const texture = this.opaque.target.texture;
    const filterUniforms = (): Uniforms => ({ uInput: { value: texture }, uDirection: { value: new THREE.Vector2(1, 0) }, uRadius: { value: 6 }, uThreshold: { value: 0.9 }, uFilter: { value: 1 } });
    this.bright = new ScreenPass('bright', ['opaque.color'], sources['filter.frag'], filterUniforms(), this.float);
    this.blurX = new ScreenPass('blur.horizontal', ['bright or opaque.color'], sources['filter.frag'], filterUniforms(), this.float);
    this.blurY = new ScreenPass('blur.vertical', ['blur.horizontal'], sources['filter.frag'], filterUniforms(), this.float);
    const analysisUniforms = (): Uniforms => ({
      uPosition: { value: this.opaque.outputs.position ?? texture }, uNormal: { value: this.opaque.outputs.normal ?? texture },
      uWaterPosition: { value: this.water.outputs.position ?? texture }, uWaterNormal: { value: this.water.outputs.normal ?? texture },
      uProjection: { value: this.camera.projectionMatrix }, uInverseView: { value: this.camera.matrixWorld },
      uOperation: { value: 0 }, uRadius: { value: 1 }, uStrength: { value: 2.5 }, uSensitivity: { value: 1.5 },
      uRayDistance: { value: 16 }, uIor: { value: 1.33 }, uFoamWidth: { value: 0.7 }, uTime: { value: 0 },
    });
    this.mask = new ScreenPass('effect-mask', ['opaque.position', 'opaque.normal'], sources['analysis.frag'], analysisUniforms(), this.float);
    this.reflection = new ScreenPass('reflection-hit', ['opaque.position', 'water.position', 'water.normal'], sources['analysis.frag'], analysisUniforms(), this.float);
    this.refraction = new ScreenPass('refraction-hit', ['opaque.position', 'water.position', 'water.normal'], sources['analysis.frag'], analysisUniforms(), this.float);
    this.foam = new ScreenPass('foam-mask', ['opaque.position', 'water.position'], sources['analysis.frag'], analysisUniforms(), this.float);
    const compositeUniforms: Uniforms = {
      ...lightingUniforms(), ...analysisUniforms(), uInput: { value: texture }, uBlur: { value: this.blurY.target.texture },
      uMaterial: { value: this.opaque.outputs.material ?? texture }, uMask: { value: this.mask.target.texture },
      uReflection: { value: this.reflection.target.texture }, uRefraction: { value: this.refraction.target.texture }, uFoam: { value: this.foam.target.texture },
      uLut: { value: this.lut }, uPreviousViewProjection: { value: this.previousVP }, uEnabled: { value: 1 }, uMode: { value: lesson.mode },
      uWater: { value: 0 }, ...Object.fromEntries(Object.entries(defaults).map(([k, value]) => [uniformName(k), { value }])),
      uReflectEnabled: { value: 1 }, uRefractEnabled: { value: 1 }, uFoamEnabled: { value: 1 },
    };
    this.composite = new ScreenPass('composite', ['opaque.*', 'blur.vertical', 'effect-mask', 'reflection-hit', 'refraction-hit', 'foam-mask'], compiledComposite, compositeUniforms, this.float);
    this.display = new ScreenPass('display', ['selected buffer'], sources['display.frag'], { uInput: { value: this.composite.target.texture }, uEncoding: { value: 0 }, uGammaMode: { value: 0 } }, false);
    this.passes = [this.opaque, this.water, this.bright, this.blurX, this.blurY, this.mask, this.reflection, this.refraction, this.foam, this.composite, this.display];
    if (lesson.mode === 31) {
      this.chain = new ScreenPass('final.chain', ['previous color'], compiledComposite, this.composite.material.uniforms, this.float);
      this.edges = new ScreenPass('final.edges', ['opaque.position', 'opaque.normal'], sources['analysis.frag'], analysisUniforms(), this.float);
      this.passes.push(this.chain, this.edges);
    }
    this.resetParameters(); this.populateBuffers(); this.resize();
  }

  get available(): boolean { return !this.lesson.advanced || this.float; }
  get passGraph() { return this.passes.map(p => ({ name: p.name, inputs: p.inputs, outputs: Object.keys(p.outputs) })); }

  private populateBuffers() {
    for (const key of Object.keys(this.buffers)) delete this.buffers[key];
    this.buffers['Final image'] = { texture: this.composite.target.texture, encoding: 0 };
    this.buffers['Scene color'] = { texture: this.opaque.target.texture, encoding: 0 };
    this.buffers['Scene depth'] = { texture: this.opaque.target.depthTexture!, encoding: 5 };
    this.buffers['Shadow depth'] = { texture: this.shadow.depthTexture!, encoding: 4 };
    if (this.float) {
      this.buffers['View positions'] = { texture: this.opaque.outputs.position, encoding: 1 };
      this.buffers['View normals'] = { texture: this.opaque.outputs.normal, encoding: 2 };
      this.buffers['Albedo / emission'] = { texture: this.opaque.outputs.material, encoding: 0 };
    }
    if ([0, 8, 9, 23, 26, 31].includes(this.lesson.mode)) this.buffers['Blurred color'] = { texture: this.blurY.target.texture, encoding: 0 };
    if ([0, 9, 31].includes(this.lesson.mode) && this.float) this.buffers['Bright mask'] = { texture: this.bright.target.texture, encoding: 0 };
    if ([15, 22, 31].includes(this.lesson.mode) && this.float) this.buffers['Effect mask'] = { texture: this.mask.target.texture, encoding: 3 };
    if (this.edges) this.buffers['Outline mask'] = { texture: this.edges.target.texture, encoding: 3 };
    if ((this.sceneKind === 'water' || this.sceneKind === 'mill') && this.float) {
      this.buffers['Water positions'] = { texture: this.water.outputs.position, encoding: 1 };
      this.buffers['Water normals'] = { texture: this.water.outputs.normal, encoding: 2 };
      this.buffers['Reflection hit'] = { texture: this.reflection.target.texture, encoding: 3 };
      this.buffers['Refraction hit'] = { texture: this.refraction.target.texture, encoding: 3 };
      this.buffers['Foam mask'] = { texture: this.foam.target.texture, encoding: 3 };
    }
    if (!this.buffers[this.buffer]) this.buffer = 'Final image';
  }

  changeScene(kind: SceneKind) {
    if (kind === this.sceneKind) return;
    if (kind === 'water' && !this.float) return;
    this.opaque.dispose(); this.water.dispose(); this.teaching.dispose();
    this.sceneKind = kind; this.teaching = createTeachingScene(kind);
    this.opaque = new GeometryPass('opaque', this.teaching, 0, this.float);
    this.water = new GeometryPass('water', this.teaching, 1, this.float);
    this.passes[0] = this.opaque; this.passes[1] = this.water;
    const texture = this.opaque.target.texture;
    for (const pass of [this.mask, this.reflection, this.refraction, this.foam, this.composite]) {
      const u = pass.material.uniforms;
      u.uPosition.value = this.opaque.outputs.position ?? texture;
      u.uNormal.value = this.opaque.outputs.normal ?? texture;
      u.uWaterPosition.value = this.water.outputs.position ?? texture;
      u.uWaterNormal.value = this.water.outputs.normal ?? texture;
    }
    this.composite.material.uniforms.uInput.value = texture;
    this.composite.material.uniforms.uMaterial.value = this.opaque.outputs.material ?? texture;
    this.bright.material.uniforms.uInput.value = texture;
    this.width = 0; this.resize(); this.populateBuffers(); this.resetCamera();
  }

  resetParameters() {
    Object.assign(this.params, defaults);
    Object.assign(this.effects, finaleDefaults());
    this.params.fresnel = this.lesson.mode === 10 ? 1 : 0;
    this.params.rim = this.lesson.mode === 11 ? 1 : 0;
    this.params.cel = this.lesson.mode === 12 ? 1 : 0;
    this.lesson.controls.forEach(c => { this.params[c.key] = c.value; });
    this.enabled = true; this.time = 0; this.historyValid = false;
  }
  resetCamera() {
    if (this.sceneKind === 'mill') {
      this.camera.position.set(-11, 9, 13); this.controls.target.set(0, 2.5, 0);
    } else {
      this.camera.position.set(7.5, 5.8, 9.5); this.controls.target.set(0, 0.7, 0);
    }
    this.controls.update(); this.historyValid = false;
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2) * this.quality;
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (width === this.width && height === this.height) return;
    this.width = width; this.height = height;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    this.passes.forEach(p => p.resize(width, height));
    this.historyValid = false;
    const gl = this.renderer.getContext();
    for (const pass of this.passes) {
      const target = (pass as ScreenPass | GeometryPass).target;
      this.renderer.setRenderTarget(target);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`Unsupported framebuffer: ${pass.name}`);
      this.stats.framebufferChecks++;
    }
    this.renderer.setRenderTarget(null);
  }

  render(delta: number) {
    if (!this.available || !this.assetsReady) return;
    this.resize(); this.controls.update(); this.camera.updateMatrixWorld();
    if (!this.paused) this.time += Math.min(delta, 0.05);
    this.teaching.update(this.time);
    const viewProjection = new THREE.Matrix4().multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    if (!this.historyValid) { this.previousVP.copy(viewProjection); this.historyValid = true; }
    const lightView = this.lightWorld.clone().applyMatrix4(this.camera.matrixWorldInverse);
    const mode = this.lesson.mode;
    const setLighting = (u: Uniforms) => {
      for (const key of lightingKeys) if (u[uniformName(key)]) u[uniformName(key)].value = this.params[key];
      u.uShadow.value = this.shadow.depthTexture;
      u.uLightMatrix.value = this.lightMatrix;
      u.uLightPosition.value = lightView;
    };
    for (const material of this.teaching.materials) {
      const u = material.uniforms; setLighting(u);
      const water = u.uWater.value > 0;
      u.uMode.value = this.enabled ? mode : 0;
      for (const key of ['normalStrength', 'repeat', 'frequency', 'space', 'flow']) u[uniformName(key)].value = this.params[key];
      if (water) u.uNormalStrength.value = 0.85;
      if (mode === 3) u.uUseTexture.value = 1;
      if (!this.enabled) {
        if (!water || mode === 0) u.uNormalStrength.value = 0;
        u.uFresnel.value = 0; u.uRim.value = 0; u.uCel.value = 0;
        if (mode === 3) u.uUseTexture.value = 0;
        if (mode === 4) u.uMode.value = 3;
        if (mode === 5) u.uBlinn.value = 0;
        if (mode === 21 && water) u.uFlow.value = 0;
      }
      if (mode === 31) {
        u.uMode.value = 0; u.uRepeat.value = 1;
        u.uNormalStrength.value = this.enabled && this.effects.normal ? this.params.normalStrength : 0;
        u.uShadows.value = this.enabled && this.effects.shadows ? 1 : 0;
        u.uFresnel.value = this.enabled && this.effects.fresnel ? 0.15 : 0;
        u.uRim.value = this.enabled && this.effects.rim ? 0.06 : 0;
        u.uCel.value = this.enabled && this.effects.cel ? 1 : 0;
        u.uFlow.value = this.enabled && this.effects.flow ? this.params.flow : 0;
      }
    }
    const context = { renderer: this.renderer, camera: this.camera };
    this.teaching.scene.overrideMaterial = mode === 31 ? null : this.shadowMaterial;
    if (mode === 31) for (const material of this.teaching.materials) {
      material.uniforms.uShadowPass.value = 1;
      material.uniforms.uShadow.value = material.uniforms.uChecker.value;
    }
    this.renderer.setRenderTarget(this.shadow); this.renderer.setClearColor(0xffffff, 1); this.renderer.clear();
    this.renderer.render(this.teaching.scene, this.lightCamera);
    this.teaching.scene.overrideMaterial = null;
    if (mode === 31) for (const material of this.teaching.materials) {
      material.uniforms.uShadowPass.value = 0; material.uniforms.uShadow.value = this.shadow.depthTexture;
    }
    this.opaque.render(context);
    const waterActive = (this.sceneKind === 'water' || this.sceneKind === 'mill') && this.float;
    if (waterActive) this.water.render(context);
    if (mode === 31) {
      this.renderFinale(context, lightView);
      this.previousVP.copy(viewProjection); this.stats.frames++;
      if (this.stats.shaderErrors.length) throw new Error('Final scene shader compilation failed.');
      return;
    }
    const bloomActive = (mode === 9 || mode === 0) && this.float;
    const blurActive = bloomActive || [8, 23, 26].includes(mode);
    if (blurActive) {
      const b = this.bright.material.uniforms;
      b.uFilter.value = 4; b.uThreshold.value = this.params.threshold;
      if (bloomActive) this.bright.render(context);
      const x = this.blurX.material.uniforms;
      const y = this.blurY.material.uniforms;
      const filter = mode === 8 ? this.params.filter : 1;
      x.uInput.value = bloomActive ? this.bright.target.texture : this.opaque.target.texture;
      x.uDirection.value.set(1, 0); x.uFilter.value = filter;
      x.uRadius.value = filter === 3 ? Math.min(4, this.params.radius) : (mode === 8 ? this.params.radius : 8);
      this.blurX.render(context);
      y.uInput.value = this.blurX.target.texture; y.uDirection.value.set(0, 1);
      y.uFilter.value = filter <= 1 ? filter : 0; y.uRadius.value = filter <= 1 ? x.uRadius.value : 0;
      this.blurY.render(context);
    }
    for (const [pass, operation] of [[this.mask, mode === 22 ? 1 : 0], [this.reflection, 2], [this.refraction, 3], [this.foam, 4]] as const) {
      if (pass === this.mask ? ![15, 22].includes(mode) : !waterActive) continue;
      const u = pass.material.uniforms;
      u.uOperation.value = operation; u.uTime.value = this.time;
      for (const key of ['radius', 'strength', 'sensitivity', 'rayDistance', 'ior', 'foamWidth']) u[uniformName(key)].value = this.params[key];
      pass.render(context);
    }
    const u = this.composite.material.uniforms;
    for (const [key, value] of Object.entries(this.params)) if (u[uniformName(key)]) u[uniformName(key)].value = value;
    setLighting(u); u.uTime.value = this.time; u.uEnabled.value = this.enabled ? 1 : 0;
    u.uWater.value = waterActive ? 1 : 0;
    if (!this.float) u.uBloom.value = 0;
    this.composite.render(context);
    const selected = this.buffers[this.buffer] ?? this.buffers['Final image'];
    this.display.material.uniforms.uInput.value = selected.texture;
    this.display.material.uniforms.uEncoding.value = selected.encoding;
    this.display.material.uniforms.uGammaMode.value = mode === 30 && this.enabled && this.buffer === 'Final image' ? this.params.gammaMode : 0;
    this.display.render(context, true);
    this.previousVP.copy(viewProjection);
    this.stats.frames++;
    if (this.stats.shaderErrors.length) throw new Error('Shader compilation failed. See the browser console for the compiler report.');
  }

  dispose() {
    this.controls.dispose(); this.teaching.dispose(); this.passes.forEach(p => p.dispose());
    this.shadow.dispose(); this.shadowMaterial.dispose(); this.lut.dispose(); this.renderer.dispose();
  }

  private renderFinale(context: { renderer: THREE.WebGLRenderer; camera: THREE.Camera }, lightView: THREE.Vector3) {
    const on = (key: keyof FinaleSettings) => this.enabled && this.effects[key];
    const u = this.composite.material.uniforms;
    for (const [key, value] of Object.entries(this.params)) if (u[uniformName(key)]) u[uniformName(key)].value = value;
    u.uLightPosition.value = lightView; u.uLightMatrix.value = this.lightMatrix; u.uShadow.value = this.shadow.depthTexture;
    u.uShadows.value = on('shadows') ? 1 : 0; u.uCel.value = on('cel') ? 1 : 0;
    u.uRim.value = on('rim') ? 0.06 : 0; u.uFresnel.value = on('fresnel') ? 0.15 : 0;
    u.uTime.value = this.time; u.uEnabled.value = 1; u.uWater.value = 0;
    // No color from the previous frame may enter this frame's composition.
    // blurY still contains the previous sharpen/blur result at this point.
    u.uBlur.value = this.opaque.target.texture;
    let color = this.opaque.target.texture;
    let next = this.composite;
    const step = (mode: number) => {
      u.uMode.value = mode; u.uInput.value = color;
      next.render(context); color = next.target.texture;
      next = next === this.composite ? this.chain! : this.composite;
    };
    const analyze = (pass: ScreenPass, operation: number) => {
      const a = pass.material.uniforms;
      a.uOperation.value = operation; a.uTime.value = this.time;
      a.uRadius.value = 0.55; a.uStrength.value = 1.8; a.uSensitivity.value = 0.8;
      a.uRayDistance.value = 16; a.uIor.value = 1.33; a.uFoamWidth.value = this.params.foamWidth;
      pass.render(context);
    };
    const blur = (source: THREE.Texture, radius: number, kind = 1) => {
      const x = this.blurX.material.uniforms, y = this.blurY.material.uniforms;
      x.uInput.value = source; x.uRadius.value = kind === 3 ? Math.min(radius, 4) : radius;
      x.uFilter.value = kind; x.uDirection.value.set(1, 0); this.blurX.render(context);
      y.uInput.value = this.blurX.target.texture; y.uRadius.value = kind <= 1 ? radius : 0;
      y.uFilter.value = kind <= 1 ? kind : 0; y.uDirection.value.set(0, 1); this.blurY.render(context);
      u.uBlur.value = this.blurY.target.texture;
    };
    if (on('deferred')) step(13);
    // Keep inspection buffers current even when their contribution is disabled.
    analyze(this.mask, 0); analyze(this.edges!, 1);
    analyze(this.reflection, 2); analyze(this.refraction, 3); analyze(this.foam, 4);
    u.uReflectEnabled.value = on('reflection') ? 1 : 0;
    u.uRefractEnabled.value = on('refraction') ? 1 : 0;
    u.uFoamEnabled.value = on('foam') ? 1 : 0;
    u.uWater.value = 1; u.uBloom.value = 0; step(0); u.uWater.value = 0;
    if (on('ssao')) { u.uMask.value = this.mask.target.texture; step(15); }
    if (on('outline')) { u.uMask.value = this.edges!.target.texture; step(22); }
    if (on('fog')) step(14);
    const bright = this.bright.material.uniforms;
    bright.uInput.value = color; bright.uFilter.value = 4; bright.uThreshold.value = 0.8;
    this.bright.render(context);
    blur(this.bright.target.texture, 6);
    if (on('bloom')) { u.uBloom.value = this.params.bloom; step(9); }
    if (on('motion')) { u.uAmount.value = 0.5; step(16); }
    if (on('dof')) { blur(color, 5); step(23); }
    if (on('blur')) { blur(color, this.params.radius, this.params.filter); step(8); }
    if (on('chromatic')) { u.uAmount.value = 0.06; step(17); }
    if (on('posterize')) step(24);
    if (on('pixelize')) step(25);
    if (on('sharpen')) { blur(color, 2); u.uAmount.value = 0.15; step(26); }
    if (on('dilation')) { u.uRadius.value = 1; step(27); }
    if (on('grain')) { u.uAmount.value = 0.025; step(28); }
    if (on('lut')) { u.uAmount.value = 0.18; step(29); }
    this.buffers['Final image'].texture = color;
    const selected = this.buffers[this.buffer] ?? this.buffers['Final image'];
    const display = this.display.material.uniforms;
    display.uInput.value = selected.texture; display.uEncoding.value = selected.encoding;
    display.uGammaMode.value = this.enabled && this.buffer === 'Final image' ? this.params.gammaMode : 0;
    this.display.render(context, true);
  }
}
