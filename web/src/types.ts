import type { Scene, RawShaderMaterial, Camera, WebGLRenderer, WebGLRenderTarget, Texture } from 'three';

export type SceneKind = 'material' | 'occlusion' | 'water' | 'mill';
export interface ControlDefinition {
  key: string; label: string; min: number; max: number; step: number; value: number;
}
export interface LessonDefinition {
  id: string; title: string; group: string; summary: string; scene: SceneKind;
  mode: number; stage: number; advanced: boolean; controls: ControlDefinition[];
  explanation: string; sourceKeys: string[];
}
export interface TeachingScene {
  scene: Scene; materials: RawShaderMaterial[];
  ready?: Promise<void>;
  update(time: number): void; dispose(): void;
}
export interface Lesson extends LessonDefinition {
  createScene: () => TeachingScene;
  shaderSources: Record<string, string>;
  requiredCapabilities: string[];
}
export interface PassContext { renderer: WebGLRenderer; camera: Camera; }
export interface RenderPass {
  name: string; inputs: string[]; outputs: Record<string, Texture>;
  render(context: PassContext): void;
  resize(width: number, height: number): void;
  dispose(): void;
}
export interface BufferView { texture: Texture; encoding: number; }
export type Target = WebGLRenderTarget;
