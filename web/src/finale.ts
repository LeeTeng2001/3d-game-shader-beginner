import type { ControlDefinition } from './types';

export const finaleEffects = [
  ['normal', 'Normal mapping', true], ['shadows', 'Shadows', true], ['fresnel', 'Fresnel', true], ['rim', 'Rim lighting', true], ['cel', 'Cel shading', false],
  ['deferred', 'Deferred lighting', true], ['ssao', 'Ambient occlusion', true], ['reflection', 'Screen-space reflection', true], ['refraction', 'Screen-space refraction', true], ['flow', 'Flow mapping', true], ['foam', 'Shoreline foam', true],
  ['fog', 'Fog', true], ['bloom', 'Bloom', true], ['motion', 'Camera motion blur', true], ['dof', 'Depth of field', false], ['outline', 'Outlining', false],
  ['blur', 'Blur / median / Kuwahara', false], ['chromatic', 'Chromatic aberration', true], ['posterize', 'Posterization', false], ['pixelize', 'Pixelization', false], ['sharpen', 'Sharpen', true], ['dilation', 'Dilation', false], ['grain', 'Film grain', true], ['lut', 'Color grading', true],
] as const;
export type FinaleEffect = typeof finaleEffects[number][0];
export type FinaleSettings = Record<FinaleEffect, boolean>;
export function finaleDefaults(all = false): FinaleSettings {
  return Object.fromEntries(finaleEffects.map(([key, , on]) => [key, all || on])) as FinaleSettings;
}
const c = (key: string, label: string, min: number, max: number, step: number, value: number): ControlDefinition => ({ key, label, min, max, step, value });
export const finaleControls = [
  c('lightIntensity', 'Sun intensity', 0.1, 3, 0.05, 1.3), c('blinn', 'Highlight model · Phong / Blinn', 0, 1, 1, 1),
  c('bloom', 'Bloom amount', 0, 1.5, 0.05, 0.25), c('normalStrength', 'Normal strength', 0, 2, 0.05, 0.65),
  c('flow', 'Water flow speed', 0, 3, 0.1, 0.7), c('foamWidth', 'Foam width', 0.02, 1, 0.02, 0.2),
  c('fogDistance', 'Fog distance', 8, 50, 1, 40), c('focus', 'Focus distance', 3, 30, 0.1, 19), c('aperture', 'Aperture', 0, 3, 0.1, 0.6),
  c('filter', 'Blur · box / Gaussian / median / Kuwahara', 0, 3, 1, 1), c('radius', 'Filter radius', 1, 8, 1, 1),
  c('levels', 'Posterization levels', 3, 32, 1, 24), c('block', 'Pixel block size', 1, 12, 1, 2), c('gammaMode', 'Output · correct / missing / double gamma', 0, 2, 1, 0),
];
