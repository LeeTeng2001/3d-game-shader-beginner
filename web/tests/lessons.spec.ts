import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const catalog = JSON.parse(readFileSync(new URL('../content/catalog.json', import.meta.url), 'utf8')) as Array<Array<string | number | boolean>>;
const maximum = (values: number[]) => values.reduce((a, b) => Math.max(a, b), -Infinity);

async function ready(page: Page) {
  await page.waitForFunction(() => ['true', 'unsupported', 'error'].includes(document.body.dataset.ready ?? ''));
  const state = await page.locator('body').getAttribute('data-ready');
  if (state === 'unsupported') return false;
  expect(state).toBe('true');
  await page.waitForFunction(() => (window as any).__shaderLab?.stats.frames >= 2);
  return true;
}
async function pixels(page: Page) {
  return page.evaluate(() => {
    const engine = (window as any).__shaderLab;
    engine.paused = true; engine.render(0);
    const gl = engine.renderer.getContext();
    const width = gl.drawingBufferWidth, height = gl.drawingBufferHeight;
    const data = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    const sample = [];
    for (let i = 0; i < data.length; i += 64) sample.push(data[i], data[i + 1], data[i + 2]);
    return sample;
  });
}

for (const row of catalog) {
  const id = String(row[0]);
  test(`${id}: compiles, renders, and exposes real source`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
    await page.goto(`/${id === 'showcase' ? 'index' : id}.html?still`);
    const available = await ready(page);
    if (!available) {
      await expect(page.locator('#explanation')).not.toBeEmpty();
      test.skip(true, 'This browser does not expose the required GPU capabilities.');
    }
    const image = await pixels(page);
    expect(maximum(image)).toBeGreaterThan(80);
    expect(new Set(image).size).toBeGreaterThan(id === 'posterization' ? 4 : 40);
    await expect(page.locator('#source')).toContainText('void main()');
    const shaderErrors = await page.evaluate(() => (window as any).__shaderLab.stats.shaderErrors);
    expect(shaderErrors).toEqual([]); expect(errors).toEqual([]);
    await page.locator('#buffer').selectOption('Shadow depth');
    const shadow = await pixels(page);
    expect(new Set(shadow).size).toBeGreaterThan(5);
    if (id === 'showcase' || id === 'foam' || id === 'final-scene') {
      await page.locator('#buffer').selectOption('Final image'); await pixels(page);
      await page.screenshot({ path: `test-results/${id}-preview.png`, fullPage: true });
    }
  });
}

test('controls, reset, resize, source selection, and scene disposal', async ({ page }) => {
  await page.goto('/index.html?still');
  test.skip(!(await ready(page)), 'No WebGL2');
  await page.locator('#parameter-bloom').fill('1.5');
  await expect(page.locator('#value-bloom')).toHaveText('1.5');
  await page.locator('#enabled').uncheck();
  expect(await page.evaluate(() => (window as any).__shaderLab.enabled)).toBe(false);
  await page.locator('#quality').selectOption('0.5');
  await page.setViewportSize({ width: 1100, height: 850 });
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => (window as any).__shaderLab.renderer.domElement.width)).toBeLessThan(500);
  await page.locator('#source-select').selectOption('geometry.vert');
  await expect(page.locator('#source')).toContainText('modelViewMatrix');
  for (const scene of ['water', 'occlusion', 'material', 'water', 'material']) {
    await page.locator('#scene').selectOption(scene); await pixels(page);
  }
  await page.locator('#reset').click();
  await expect(page.locator('#value-bloom')).toHaveText('0.35');
  await expect(page.locator('#enabled')).toBeChecked();
  await expect(page.locator('#buffer')).toHaveValue('Final image');
  const info = await page.evaluate(() => ({ errors: (window as any).__shaderLab.stats.shaderErrors, geometries: (window as any).__shaderLab.renderer.info.memory.geometries }));
  expect(info.errors).toEqual([]); expect(info.geometries).toBeLessThan(45);
});

for (const id of ['bloom', 'normal-mapping', 'lighting', 'texturing', 'blinn-phong', 'blur', 'ssao', 'outlining', 'depth-of-field', 'posterization', 'screen-space-reflection', 'screen-space-refraction', 'foam', 'flow-mapping', 'lookup-table']) {
  test(`${id}: enabling the effect changes the rendered pixels`, async ({ page }) => {
    await page.goto(`/${id}.html?still`); test.skip(!(await ready(page)), 'Required GPU capability unavailable');
    const on = await pixels(page);
    await page.locator('#enabled').uncheck();
    const off = await pixels(page);
    const difference = on.reduce((sum, value, i) => sum + Math.abs(value - off[i]), 0) / on.length;
    expect(difference).toBeGreaterThan(0.05);
  });
}

test('missing capabilities leave readable lessons and basic rendering', async ({ page }) => {
  await page.goto('/ssao.html?no-float');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'unsupported');
  await expect(page.locator('#status')).toContainText('floating-point');
  await expect(page.locator('#explanation')).toContainText('hemisphere');
  await page.goto('/texturing.html?no-float&still');
  test.skip(!(await ready(page)), 'No WebGL2');
  expect(maximum(await pixels(page))).toBeGreaterThan(80);
  await page.goto('/glsl.html?no-webgl');
  await expect(page.locator('#status')).toContainText('WebGL2 is unavailable');
  await expect(page.locator('#source')).toContainText('void main()');
});

test('context loss recovers and the embed selects its lesson', async ({ page }) => {
  await page.goto('/embed.html?lesson=foam&still'); test.skip(!(await ready(page)), 'No WebGL2');
  await expect(page.locator('.sidebar')).toBeHidden();
  expect(await page.evaluate(() => (window as any).__shaderLab.lesson.id)).toBe('foam');
  await page.evaluate(() => {
    const gl = (window as any).__shaderLab.renderer.getContext();
    const extension = gl.getExtension('WEBGL_lose_context');
    extension.loseContext(); setTimeout(() => extension.restoreContext(), 400);
  });
  await page.waitForTimeout(1000);
  expect(await ready(page)).toBe(true);
  expect(maximum(await pixels(page))).toBeGreaterThan(80);
});

test('mobile layout stays within viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/index.html?still'); await ready(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
  await expect(page.locator('#canvas')).toBeVisible();
});

test('water traces find geometry and foam produces a nonempty mask', async ({ page }) => {
  await page.goto('/index.html?still'); test.skip(!(await ready(page)), 'No WebGL2');
  await page.locator('#scene').selectOption('water');
  for (const name of ['Reflection hit', 'Refraction hit', 'Foam mask']) {
    await page.locator('#buffer').selectOption(name);
    const data = await pixels(page);
    // Hit blue is confidence, not the red/green UV coordinate or alpha clear value.
    const confidence = data.filter((_, i) => i % 3 === 2);
    expect(maximum(confidence), name).toBeGreaterThan(10);
  }
});

test('deferred lighting agrees with forward lighting', async ({ page }) => {
  await page.goto('/deferred-rendering.html?still'); test.skip(!(await ready(page)), 'Float targets unavailable');
  const deferred = await pixels(page);
  await page.locator('#enabled').uncheck(); const forward = await pixels(page);
  const difference = deferred.reduce((sum, value, i) => sum + Math.abs(value - forward[i]), 0) / deferred.length;
  expect(difference).toBeLessThan(1.5);
});

test('camera motion produces blur and resetting clears history', async ({ page }) => {
  await page.goto('/motion-blur.html?still'); test.skip(!(await ready(page)), 'Float targets unavailable');
  const difference = await page.evaluate(() => {
    const engine = (window as any).__shaderLab;
    engine.paused = true;
    const gl = engine.renderer.getContext();
    const read = () => {
      const data = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, data); return data;
    };
    engine.render(0); engine.camera.position.x += 1.5; engine.render(0); const blurred = read();
    engine.enabled = false; engine.render(0); const sharp = read();
    let total = 0;
    for (let i = 0; i < sharp.length; i += 16) total += Math.abs(blurred[i] - sharp[i]);
    return total / (sharp.length / 16);
  });
  expect(difference).toBeGreaterThan(0.1);
  await page.locator('#reset').click();
  expect(await page.evaluate(() => (window as any).__shaderLab.stats.shaderErrors)).toEqual([]);
});

test('all blur algorithms compile and produce different results', async ({ page }) => {
  await page.goto('/blur.html?still'); test.skip(!(await ready(page)), 'No WebGL2');
  const images: number[][] = [];
  for (const filter of ['0', '1', '2', '3']) {
    await page.locator('#parameter-filter').fill(filter);
    images.push(await pixels(page));
  }
  for (let i = 1; i < images.length; i++) {
    const difference = images[0].reduce((total, v, j) => total + Math.abs(v - images[i][j]), 0) / images[0].length;
    expect(difference).toBeGreaterThan(0.01);
  }
});

test('neutral LUT is identity and gamma modes visibly differ', async ({ page }) => {
  await page.goto('/lookup-table.html?still'); test.skip(!(await ready(page)), 'No WebGL2');
  await page.evaluate(() => {
    const lut = (window as any).__shaderLab.lut;
    for (let b = 0; b < 16; b++) for (let g = 0; g < 16; g++) for (let r = 0; r < 16; r++) {
      lut.image.data.set([r * 17, g * 17, b * 17, 255], ((b * 16 + g) * 16 + r) * 4);
    }
    lut.needsUpdate = true;
  });
  const graded = await pixels(page); await page.locator('#enabled').uncheck(); const original = await pixels(page);
  expect(graded.reduce((total, v, i) => total + Math.abs(v - original[i]), 0) / graded.length).toBeLessThan(1);
  await page.goto('/gamma-correction.html?still'); await ready(page);
  const correct = await pixels(page);
  for (const mode of ['1', '2']) {
    await page.locator('#parameter-gammaMode').fill(mode); const wrong = await pixels(page);
    expect(correct.reduce((total, v, i) => total + Math.abs(v - wrong[i]), 0) / correct.length).toBeGreaterThan(5);
  }
});

test('all named buffers render and a subpath supports links and embeds', async ({ page }) => {
  const missing: string[] = [];
  page.on('response', r => { if (r.status() >= 400) missing.push(r.url()); });
  await page.goto('/course/index.html?still'); test.skip(!(await ready(page)), 'No WebGL2');
  await page.locator('#quality').selectOption('0.5');
  await page.locator('#scene').selectOption('water');
  const names = await page.locator('#buffer option').evaluateAll(options => options.map(o => (o as HTMLOptionElement).value));
  for (const name of names) {
    await page.locator('#buffer').selectOption(name); const image = await pixels(page);
    expect(maximum(image), name).toBeGreaterThan(0);
  }
  await page.getByRole('link', { name: 'Bloom', exact: true }).click();
  expect(page.url()).toContain('/course/bloom.html'); expect(await ready(page)).toBe(true);
  await page.goto('/course/embed.html?lesson=glsl&still'); expect(await ready(page)).toBe(true);
  await expect(page.locator('.sidebar')).toBeHidden();
  expect(missing).toEqual([]);
});

test('final scene loads the original assets and combines all effects without feedback', async ({ page }) => {
  const failures: string[] = [];
  page.on('console', message => { if (message.type() === 'error') failures.push(message.text()); });
  page.on('pageerror', error => failures.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
  await page.goto('/course/final-scene.html?still');
  test.skip(!(await ready(page)), 'Float render targets unavailable');
  await page.locator('#quality').selectOption('0.5');
  const asset = await page.evaluate(() => (window as any).__shaderLab.teaching.scene.userData.asset);
  expect(asset.triangles).toBe(126168);
  expect(asset.meshes).toBeGreaterThan(400);
  await expect(page.locator('#scene')).toHaveValue('mill');
  await expect(page.locator('#scene')).toBeDisabled();
  await page.locator('#final-preset').selectOption('clean');
  const clean = await pixels(page);
  await page.locator('#final-preset').selectOption('all');
  const all = await pixels(page);
  const toggles = await page.locator('.effect-switches input').evaluateAll(inputs => inputs.every(input => (input as HTMLInputElement).checked));
  expect(toggles).toBe(true);
  expect(all.reduce((total, value, i) => total + Math.abs(value - clean[i]), 0) / all.length).toBeGreaterThan(1);
  await page.locator('.fine-tune summary').click();
  for (const filter of ['0', '1', '2', '3']) {
    await page.locator('#parameter-filter').fill(filter);
    expect(maximum(await pixels(page))).toBeGreaterThan(50);
  }
  await page.locator('#effect-reflection').uncheck();
  await expect(page.locator('#final-preset')).toHaveValue('custom');
  await page.locator('#reset').click();
  await expect(page.locator('#final-preset')).toHaveValue('cinematic');
  await expect(page.locator('#effect-reflection')).toBeChecked();
  expect(await page.evaluate(() => (window as any).__shaderLab.stats.shaderErrors)).toEqual([]);
  expect(failures).toEqual([]);
});

test('final scene wheel animates and the complete model is initially in frame', async ({ page }) => {
  await page.goto('/final-scene.html?still'); test.skip(!(await ready(page)), 'Float targets unavailable');
  const result = await page.evaluate(async () => {
    const engine = (window as any).__shaderLab;
    const wheel = engine.teaching.scene.getObjectByName('original-waterwheel');
    const before = wheel.rotation.x;
    engine.time = 2; engine.render(0);
    const after = wheel.rotation.x;
    return { before, after, calls: engine.renderer.info.render.calls, target: engine.controls.target.y };
  });
  expect(result.after).not.toBe(result.before);
  expect(result.target).toBe(2.5);
  await page.screenshot({ path: 'test-results/final-scene-framed.png', fullPage: true });
});

test('final scene remains visible after orbiting and panning away from the world origin', async ({ page }) => {
  await page.setViewportSize({ width: 887, height: 588 });
  await page.goto('/final-scene.html?still');
  test.skip(!(await ready(page)), 'Float targets unavailable');
  await page.locator('#quality').selectOption('0.5');
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    await page.evaluate(angle => {
      const engine = (window as any).__shaderLab;
      engine.controls.target.set(0, 3, 0);
      engine.camera.position.set(Math.sin(angle) * 9, 5, Math.cos(angle) * 9);
      engine.camera.lookAt(engine.controls.target);
      engine.controls.update();
    }, angle);
    const image = await pixels(page);
    // Full-screen passes must draw even when the world origin is outside the
    // camera frustum. A culled display quad leaves a completely black canvas.
    expect(image.filter(value => value > 10).length / image.length).toBeGreaterThan(0.5);
    expect(new Set(image).size).toBeGreaterThan(40);
  }
});

test('mill loading errors leave source and explanation readable', async ({ page }) => {
  await page.route('**/mill/mill.gltf', route => route.fulfill({ status: 404, body: 'Missing model' }));
  await page.goto('/final-scene.html');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'unsupported');
  await expect(page.locator('#status')).toBeVisible();
  await expect(page.locator('#explanation')).toContainText('original mill');
  await expect(page.locator('#source')).toContainText('void main()');
});
