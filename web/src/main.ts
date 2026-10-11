import './style.css';
import { lessons } from './lessons';
import { ShaderEngine } from './engine';
import type { SceneKind } from './types';
import { finaleDefaults, finaleEffects, type FinaleEffect } from './finale';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const query = new URLSearchParams(location.search);
const embedded = document.body.dataset.embed === 'true';
const lessonId = embedded ? query.get('lesson') ?? 'showcase' : document.body.dataset.lesson;
const lesson = lessons.find(l => l.id === lessonId) ?? lessons[0];
const isFinale = lesson.mode === 31;
document.body.classList.toggle('finale', isFinale);
document.title = `${lesson.title} · Shader Fieldnotes`;
const navigation = element('navigation');
navigation.replaceChildren();
for (const group of new Set(lessons.map(l => l.group))) {
  const heading = document.createElement('div'); heading.className = 'nav-group'; heading.textContent = group; navigation.append(heading);
  for (const entry of lessons.filter(l => l.group === group)) {
  const link = document.createElement('a');
  link.href = `./${entry.id === 'showcase' ? 'index' : entry.id}.html`;
  link.textContent = entry.title;
  if (lesson.id === entry.id) { link.className = 'active'; link.setAttribute('aria-current', 'page'); }
  navigation.append(link);
  }
}
const sourceSelect = element<HTMLSelectElement>('source-select');
sourceSelect.replaceChildren(...Object.keys(lesson.shaderSources).map(name => new Option(name, name)));
const updateSource = () => { element('source').textContent = lesson.shaderSources[sourceSelect.value]; };
sourceSelect.addEventListener('change', updateSource); updateSource();
const status = element('status');
const canvas = element<HTMLCanvasElement>('canvas');
const sceneSelect = element<HTMLSelectElement>('scene');
if (isFinale) { sceneSelect.replaceChildren(new Option('Original tutorial mill', 'mill')); sceneSelect.disabled = true; }
const bufferSelect = element<HTMLSelectElement>('buffer');
const qualitySelect = element<HTMLSelectElement>('quality');
const enabledInput = element<HTMLInputElement>('enabled');
const pauseButton = element<HTMLButtonElement>('pause');
const parameterPanel = element('parameters');
let engine: ShaderEngine | null = null;
let stopped = false;
let visible = true;
let last = performance.now();
let frame = 0;
let failed = false;

const errorMessage = (message: string) => { status.hidden = false; status.textContent = message; status.classList.add('error'); };
function updateBuffers() {
  if (!engine) return;
  bufferSelect.replaceChildren(...Object.keys(engine.buffers).map(name => new Option(name, name)));
  bufferSelect.value = engine.buffer;
  element('scene-label').textContent = ({ material: 'MATERIAL LAB', occlusion: 'OCCLUSION STUDY', water: 'WATER & REFLECTIONS', mill: 'THE ORIGINAL MILL · COMBINED PIPELINE' })[engine.sceneKind];
}
function parameterControls() {
  parameterPanel.replaceChildren();
  let sliders: HTMLElement = parameterPanel;
  if (isFinale) {
    const label = document.createElement('label'); label.className = 'field'; label.textContent = 'Rendering preset';
    const preset = document.createElement('select'); preset.id = 'final-preset';
    preset.append(new Option('Cinematic', 'cinematic'), new Option('All techniques', 'all'), new Option('Clean', 'clean'), new Option('Custom', 'custom'));
    label.append(preset); parameterPanel.append(label);
    const effects = document.createElement('div'); effects.className = 'effect-switches';
    for (const [key, title] of finaleEffects) {
      const label = document.createElement('label');
      const input = document.createElement('input'); input.type = 'checkbox'; input.id = `effect-${key}`;
      input.checked = engine?.effects[key] ?? false;
      input.addEventListener('change', () => { if (engine) engine.effects[key] = input.checked; preset.value = 'custom'; });
      label.append(input, document.createTextNode(title)); effects.append(label);
    }
    parameterPanel.append(effects);
    preset.addEventListener('change', () => {
      if (!engine || preset.value === 'custom') return;
      Object.assign(engine.effects, finaleDefaults(preset.value === 'all'));
      if (preset.value === 'clean') for (const key of Object.keys(engine.effects) as FinaleEffect[]) engine.effects[key] = false;
      for (const [key] of finaleEffects) element<HTMLInputElement>(`effect-${key}`).checked = engine.effects[key];
    });
    const details = document.createElement('details'); details.className = 'fine-tune';
    const summary = document.createElement('summary'); summary.textContent = 'Fine-tune parameters'; details.append(summary);
    sliders = document.createElement('div'); details.append(sliders); parameterPanel.append(details);
  }
  for (const control of lesson.controls) {
    const label = document.createElement('label'); label.className = 'slider-field';
    const caption = document.createElement('span'); caption.textContent = control.label;
    const output = document.createElement('output'); output.id = `value-${control.key}`;
    const input = document.createElement('input');
    input.type = 'range'; input.id = `parameter-${control.key}`;
    input.min = String(control.min); input.max = String(control.max); input.step = String(control.step);
    input.value = String(engine?.params[control.key] ?? control.value); output.textContent = input.value;
    input.setAttribute('aria-label', control.label); output.htmlFor = input.id;
    input.addEventListener('input', () => {
      if (engine) engine.params[control.key] = Number(input.value);
      output.textContent = input.value;
    });
    label.append(caption, output, input); sliders.append(label);
  }
  if (lesson.mode === 8) {
    const note = document.createElement('p'); note.className = 'source-note';
    note.textContent = 'Kuwahara caps the radius at 4. Median uses 3×3 samples with adjustable spacing.'; parameterPanel.append(note);
  }
}
async function initialize() {
  failed = false;
  document.querySelectorAll('.capability-note').forEach(note => note.remove());
  try {
    if (query.has('no-webgl')) throw new Error('WebGL2 is unavailable. You can still read the explanations and shader source.');
    engine = new ShaderEngine(canvas, lesson, query.has('no-float'));
    const current = engine;
    status.hidden = false; status.textContent = isFinale ? 'Loading the original mill model and textures…' : 'Preparing the renderer…';
    await current.ready;
    if (engine !== current) return;
    sceneSelect.value = engine.sceneKind;
    const waterOption = sceneSelect.querySelector<HTMLOptionElement>('[value="water"]');
    if (waterOption) waterOption.disabled = !engine.float;
    if (!engine.available) errorMessage('This lesson needs floating-point render targets and four color attachments. Your device does not provide them. The explanation and source remain available; try a Foundations lesson.');
    else status.hidden = true;
    if (!engine.float && engine.available) {
      const note = document.createElement('p'); note.className = 'capability-note';
      note.textContent = 'Basic rendering mode: HDR, water, and geometry buffers are unavailable on this device.';
      parameterPanel.after(note);
    }
    if (query.has('still')) { engine.paused = true; engine.time = 1; pauseButton.textContent = 'Resume animation'; }
    enabledInput.checked = engine.enabled;
    qualitySelect.value = String(engine.quality);
    pauseButton.textContent = engine.paused ? 'Resume animation' : 'Pause animation';
    parameterControls(); updateBuffers();
    document.body.dataset.ready = engine.available ? 'true' : 'unsupported';
  } catch (error) {
    engine?.dispose(); engine = null;
    errorMessage(error instanceof Error ? error.message : 'The renderer could not start.');
    document.body.dataset.ready = 'unsupported';
    parameterControls();
  }
}
initialize();
sceneSelect.addEventListener('change', () => {
  engine?.changeScene(sceneSelect.value as SceneKind); updateBuffers();
});
bufferSelect.addEventListener('change', () => { if (engine) engine.buffer = bufferSelect.value; });
qualitySelect.addEventListener('change', () => { if (engine) engine.quality = Number(qualitySelect.value); });
enabledInput.addEventListener('change', () => { if (engine) engine.enabled = enabledInput.checked; });
pauseButton.addEventListener('click', () => {
  if (!engine) return;
  engine.paused = !engine.paused; pauseButton.textContent = engine.paused ? 'Resume animation' : 'Pause animation';
});
element('reset').addEventListener('click', () => {
  if (!engine) return;
  engine.resetParameters(); engine.resetCamera(); engine.buffer = 'Final image'; engine.quality = 1;
  engine.changeScene(lesson.scene); sceneSelect.value = lesson.scene;
  qualitySelect.value = '1'; enabledInput.checked = true; parameterControls(); updateBuffers();
});
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault(); stopped = true;
  errorMessage('The graphics context was lost. Waiting for the browser to restore it…');
  document.body.dataset.ready = 'lost';
});
canvas.addEventListener('webglcontextrestored', () => {
  engine?.dispose(); engine = null; status.classList.remove('error');
  initialize(); stopped = false; last = performance.now();
});
const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; });
observer.observe(canvas);
function animate(now: number) {
  const delta = (now - last) / 1000; last = now;
  if (engine && !stopped && !failed && visible && !document.hidden) {
    try { engine.render(delta); }
    catch (error) { failed = true; errorMessage(String(error)); document.body.dataset.ready = 'error'; }
  }
  frame = requestAnimationFrame(animate);
}
frame = requestAnimationFrame(animate);
window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); observer.disconnect(); engine?.dispose(); });
// A tiny diagnostic surface for browser tests and curious learners; no external services.
Object.defineProperty(window, '__shaderLab', { get: () => engine });
