import catalog from '../content/catalog.json';
import type { ControlDefinition, Lesson, SceneKind } from './types';
import { createTeachingScene } from './scenes';
import { geometryFragment } from './materials';
import geometryVertex from './shaders/geometry.vert?raw';
import fullscreenVertex from './shaders/fullscreen.vert?raw';
import lighting from './shaders/lighting.glsl?raw';
import composite from './shaders/composite.frag?raw';
import analysis from './shaders/analysis.frag?raw';
import filter from './shaders/filter.frag?raw';
import display from './shaders/display.frag?raw';
import shadow from './shaders/shadow.frag?raw';
import { finaleControls } from './finale';

export const compiledComposite = composite.replace('/* LIGHTING */', lighting);
export const sources: Record<string, string> = {
  'geometry.vert': geometryVertex, 'geometry.frag': geometryFragment,
  'fullscreen.vert': fullscreenVertex, 'composite.frag': compiledComposite,
  'analysis.frag': analysis, 'filter.frag': filter, 'display.frag': display, 'shadow.frag': shadow,
};
const control = (key: string, label: string, min: number, max: number, step: number, value: number): ControlDefinition => ({ key, label, min, max, step, value });
const controls: Record<number, ControlDefinition[]> = {
  0: [control('bloom', 'Bloom amount', 0, 2, 0.05, 0.35), control('normalStrength', 'Normal strength', 0, 2, 0.05, 0.25), control('rim', 'Rim lighting', 0, 1, 1, 1), control('shadows', 'Shadows', 0, 1, 1, 1)],
  1: [control('space', 'Coordinate space · model / world / view', 0, 2, 1, 0)],
  2: [control('frequency', 'Pattern frequency', 1, 30, 1, 8)],
  3: [control('repeat', 'Texture repeat', 1, 12, 1, 2)],
  4: [control('lightIntensity', 'Light intensity', 0, 3, 0.05, 1.25), control('shadows', 'Shadows', 0, 1, 1, 1)],
  5: [control('blinn', 'Highlight model · Phong / Blinn', 0, 1, 1, 1), control('shininess', 'Shininess', 2, 128, 1, 40)],
  6: [control('normalStrength', 'Normal strength', 0, 2, 0.05, 1)],
  7: [],
  8: [control('filter', 'Filter · box / Gaussian / median / Kuwahara', 0, 3, 1, 1), control('radius', 'Radius', 1, 12, 1, 4)],
  9: [control('threshold', 'Threshold', 0.1, 3, 0.05, 0.9), control('bloom', 'Bloom amount', 0, 2, 0.05, 0.7)],
  10: [control('reflectance', 'Base reflectance', 0, 1, 0.01, 0.08)],
  11: [control('rimPower', 'Rim power', 1, 10, 0.1, 3)],
  12: [control('bands', 'Light bands', 2, 8, 1, 4)],
  13: [control('lightIntensity', 'Light intensity', 0, 3, 0.05, 1.25)],
  14: [control('fogDistance', 'Fog distance', 4, 25, 0.5, 14)],
  15: [control('radius', 'Occlusion radius', 0.1, 3, 0.05, 1), control('strength', 'Strength', 0, 5, 0.1, 2.5)],
  16: [control('amount', 'Shutter scale', 0, 3, 0.05, 1)],
  17: [control('amount', 'Channel separation', 0, 2, 0.02, 0.5)],
  18: [control('rayDistance', 'Ray distance', 2, 30, 0.5, 16)],
  19: [control('ior', 'Index of refraction', 1, 2, 0.01, 1.33)],
  20: [control('foamWidth', 'Foam width', 0.05, 1.5, 0.05, 0.7)],
  21: [control('flow', 'Flow speed', 0, 3, 0.05, 1)],
  22: [control('sensitivity', 'Edge sensitivity', 0.2, 5, 0.1, 1.5)],
  23: [control('focus', 'Focus distance', 2, 20, 0.1, 10), control('aperture', 'Aperture', 0, 6, 0.1, 3)],
  24: [control('levels', 'Color levels', 2, 16, 1, 5)],
  25: [control('block', 'Block size', 1, 40, 1, 10)],
  26: [control('amount', 'Sharpen amount', 0, 3, 0.05, 1.5)],
  27: [control('radius', 'Radius', 1, 6, 1, 3)],
  28: [control('amount', 'Grain amount', 0, 2, 0.05, 0.6)],
  29: [control('amount', 'Grade amount', 0, 1, 0.02, 1)],
  30: [control('gammaMode', 'Conversion · correct / missing / double', 0, 2, 1, 0)],
};
export const lessons: Lesson[] = catalog.map(row => {
  const [id, title, group, scene, mode, stage, advanced, summary] = row as [string, string, string, SceneKind, number, number, boolean, string];
  const sourceKeys = mode === 0 || mode === 31 ? Object.keys(sources) : mode >= 14 && mode <= 23 ? ['analysis.frag', 'composite.frag', 'geometry.frag', 'geometry.vert', 'fullscreen.vert', 'display.frag', 'filter.frag']
    : mode === 8 || mode === 9 ? ['filter.frag', 'composite.frag', 'geometry.frag', 'geometry.vert', 'fullscreen.vert', 'display.frag']
    : mode >= 24 ? ['composite.frag', 'display.frag', 'fullscreen.vert', 'geometry.frag', 'geometry.vert', 'filter.frag']
    : ['geometry.frag', 'geometry.vert', 'shadow.frag', 'composite.frag', 'fullscreen.vert', 'display.frag'];
  return {
    id, title, group, scene, mode, stage, advanced, summary, controls: mode === 31 ? finaleControls : controls[mode],
    explanation: `./${id === 'showcase' ? 'index' : id}.html#explanation`, sourceKeys,
    shaderSources: Object.fromEntries(sourceKeys.map(key => [key, sources[key]])),
    createScene: () => createTeachingScene(scene), requiredCapabilities: advanced ? ['WebGL2', 'EXT_color_buffer_float', '4 draw buffers'] : ['WebGL2'],
  };
});
