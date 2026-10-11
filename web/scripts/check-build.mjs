import { readFile, readdir, access, writeFile, unlink, mkdir, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
await mkdir('dist/licenses', { recursive: true });
await copyFile('licenses/lettier-BSD-3-Clause.txt', 'dist/licenses/lettier-BSD-3-Clause.txt');
await copyFile('node_modules/three/LICENSE', 'dist/licenses/three-LICENSE.txt');
await copyFile('THIRD_PARTY_NOTICES.md', 'dist/licenses/THIRD_PARTY_NOTICES.md');
// Vite preserves its input directory; flatten generated pages after its HTML plugin runs.
for (const file of await readdir('dist/.pages')) {
  if (!/^[a-z-]+\.html$/.test(file)) throw new Error(`Unexpected generated filename: ${file}`);
  const html = await readFile(`dist/.pages/${file}`, 'utf8');
  await writeFile(`dist/${file}`, html.replaceAll('../assets/', './assets/'));
  await unlink(`dist/.pages/${file}`);
}
const files = (await readdir('dist')).filter(f => f.endsWith('.html'));
const catalog = JSON.parse(await readFile('content/catalog.json', 'utf8'));
if (files.length !== catalog.length + 1) throw new Error(`Expected ${catalog.length + 1} HTML pages, found ${files.length}`);
for (const file of files) {
  const html = await readFile(`dist/${file}`, 'utf8');
  if (!html.includes('id="explanation"><p>')) throw new Error(`Missing static prose in ${file}`);
  for (const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    const url = match[1];
    if (/^(https?:|data:)/.test(url)) continue;
    if (url.startsWith('/')) throw new Error(`Nonportable URL ${url}`);
    await access(resolve(dirname(`dist/${file}`), url.split('?')[0]));
  }
}
console.log(`Verified ${files.length} pages, explanations, and relative local links.`);
