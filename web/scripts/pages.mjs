import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { marked } from 'marked';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const markdown = await readFile(new URL('../content/lessons.md', import.meta.url), 'utf8');
const sections = Object.fromEntries([...markdown.matchAll(/^## ([\w-]+)\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)].map(m => [m[1], m[2]]));
await mkdir('.pages', { recursive: true });
const escape = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
for (const entry of [...catalog, ['embed', 'Embedded playground', '', '', 0, 1, false, 'An embeddable shader lesson.']]) {
  const [id, title, , , , stage, , summary] = entry;
  const lesson = id === 'embed' ? 'showcase' : id;
  if (!sections[lesson]) throw new Error(`Missing explanation: ${lesson}`);
  const name = id === 'showcase' ? 'index' : id;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${escape(summary)}"><title>${escape(title)} · Shader Fieldnotes</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23e6b565'/%3E%3Cpath d='M8 22L16 7l8 15z' fill='%23151a20'/%3E%3C/svg%3E">
</head><body data-lesson="${lesson}" data-embed="${id === 'embed'}">
<div class="app"><aside class="sidebar"><a class="brand" href="./index.html"><span class="brand-mark">◈</span><span>SHADER<br>FIELDNOTES</span></a><p class="sidebar-caption">A hands-on guide to pixels.</p><nav id="navigation" aria-label="Lessons">${catalog.map(([slug, label]) => `<a href="./${slug === 'showcase' ? 'index' : slug}.html">${escape(label)}</a>`).join('')}</nav><div class="sidebar-footer">THREE.JS / GLSL ES 300<br>Open the source. Follow the light.</div></aside>
<main><header class="topbar"><span>3D GAME SHADERS <span class="muted">/ BROWSER EDITION</span></span><a href="https://github.com/lettier/3d-game-shaders-for-beginners" target="_blank" rel="noreferrer">Original project ↗</a></header>
<section class="intro"><div class="eyebrow">INTERACTIVE NOTEBOOK <span>VOL. 0${stage}</span></div><h1>${escape(title)}</h1><p class="summary">${escape(summary)}</p></section>
<section class="workspace" aria-label="Interactive shader demonstration"><div class="viewport-column"><div class="viewport-toolbar"><span class="live-dot"></span><span id="scene-label">MATERIAL LAB</span><span class="renderer-label">LIVE RENDER</span></div><div id="viewport"><canvas id="canvas" aria-label="Interactive 3D shader scene"></canvas><div id="status" role="status" aria-live="polite">Preparing the renderer…</div><div class="canvas-caption">DRAG TO ORBIT <span>SCROLL TO ZOOM · RIGHT-DRAG TO PAN</span></div></div><div class="transport"><button id="pause" type="button">Pause animation</button><button id="reset" type="button">↺ Reset</button><label class="comparison"><input id="enabled" type="checkbox" checked> Effect enabled</label></div></div>
<aside class="controls-panel"><div class="panel-heading">THE CONTROLS <span>01</span></div><label class="field">Scene<select id="scene"><option value="material">Material laboratory</option><option value="occlusion">Occlusion study</option><option value="water">Water & reflections</option></select></label><label class="field">Inspect buffer<select id="buffer"><option>Final image</option></select></label><label class="field">Render resolution<select id="quality"><option value="1">Full</option><option value="0.75">75%</option><option value="0.5">50%</option></select></label><div id="parameters"></div><p class="control-tip">Change one value at a time.<br>Watch what the light does.</p></aside></section>
<div class="below"><article class="lesson-copy"><div class="panel-heading">WHAT YOU’RE SEEING <span>02</span></div><div id="explanation">${marked.parse(sections[lesson])}</div><a class="chapter-link" href="https://github.com/lettier/3d-game-shaders-for-beginners/blob/master/sections/${lesson === 'showcase' || lesson === 'final-scene' ? 'glsl' : lesson}.md" target="_blank" rel="noreferrer">Read the original chapter ↗</a></article><section class="source-panel"><div class="panel-heading">UNDER THE SURFACE <span>03</span></div><label class="field">Compiled source<select id="source-select"></select></label><details id="source-details"><summary>Read the GLSL <span>↗</span></summary><pre><code id="source"></code></pre></details><p class="source-note">These are the actual shader files used by this renderer.</p></section></div><footer class="page-footer">LEARN BY LOOKING. UNDERSTAND BY CHANGING.<span>Original scenes · Portable GLSL · No engine install</span></footer></main></div>
<noscript><p class="noscript">The explanations are available without JavaScript. Enable JavaScript to run the interactive scenes.</p></noscript><script type="module" src="/src/main.ts"></script></body></html>`;
  await writeFile(`.pages/${name}.html`, html);
}
console.log(`Generated ${catalog.length + 1} static lesson pages.`);
