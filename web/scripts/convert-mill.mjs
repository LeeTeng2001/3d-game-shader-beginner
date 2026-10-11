import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

// Focused converter for this repository's bam2egg exports, not a general EGG importer.
// EGG vertices are in WORLD space even below Group transforms. Applying those
// transforms again would explode the scene. Instances/dynamic pools are rejected.
// https://docs.panda3d.org/1.10/python/pipeline/egg-files/syntax
const source = resolve('../demonstration/eggs/mill-scene');
const output = resolve('public/mill');
await mkdir(output + '/tex', { recursive: true });
const textures = new Map(), pools = new Map(), buckets = new Map();
let polygons = 0;
for (const file of ['mill-scene', 'banner', 'shutters', 'weather-vane']) {
  const text = await readFile(`${source}/${file}.egg`, 'utf8');
  const lexer = /"(?:\\.|[^"\\])*"|<[^>]+>|[{}]|[^\s{}<>]+/g;
  let token;
  const next = () => { token = lexer.exec(text)?.[0]; };
  const unquote = value => value?.replace(/^"|"$/g, '') ?? '';
  function genericBody(tag, name) {
    const node = { tag, name, values: [], children: [] };
    while (token && token !== '}') {
      if (token.startsWith('<')) node.children.push(generic());
      else { node.values.push(unquote(token)); next(); }
    }
    if (token !== '}') throw new Error(`Unterminated ${tag}`);
    next(); return node;
  }
  function header() {
    const tag = token.slice(1, -1); next(); const names = [];
    while (token && token !== '{') { names.push(unquote(token)); next(); }
    if (token !== '{') throw new Error(`Missing body for ${tag}`);
    next(); return [tag, names.join(' ')];
  }
  function generic() { return genericBody(...header()); }
  function child(node, tag) { return node.children.find(c => c.tag === tag); }
  function walk(poolName = '', group = { name: file, pivot: null }) {
    const [tag, name] = header();
    if (['Instance', 'DynamicVertexPool', 'TriangleStrip', 'TriangleFan'].includes(tag)) throw new Error(`Unsupported EGG construct ${tag}`);
    if (tag === 'VertexPool' || tag === 'Group') {
      const pool = tag === 'VertexPool' ? `${file}:${name}` : poolName;
      if (tag === 'VertexPool') pools.set(pool, []);
      const current = tag === 'Group' ? { name: `${group.name}/${name}`, pivot: null } : group;
      while (token && token !== '}') walk(pool, current);
      next(); return;
    }
    const node = genericBody(tag, name);
    if (tag === 'Texture') textures.set(`${file}:${name}`, basename(node.values[0].replaceAll('\\', '/')));
    if (tag === 'Transform') {
      const translate = child(node, 'Translate');
      if (translate) group.pivot = translate.values.map(Number);
    }
    if (tag === 'Vertex') {
      const p = node.values.map(Number);
      const n = child(node, 'Normal')?.values.map(Number) ?? [0, 0, 1];
      const uv = child(node, 'UV')?.values.map(Number) ?? [0, 0];
      const color = child(node, 'RGBA')?.values.map(Number) ?? [1, 1, 1, 1];
      pools.get(poolName)[Number(name)] = { p: [p[0], p[2], -p[1]], n: [n[0], n[2], -n[1]], uv: [uv[0], 1 - uv[1]], color: color.slice(0, 3) };
    }
    if (tag === 'Polygon') {
      const ref = child(node, 'VertexRef');
      const pool = `${file}:${child(ref, 'Ref').values[0]}`;
      const refs = node.children.filter(c => c.tag === 'TRef').map(c => textures.get(`${file}:${c.values[0]}`));
      const key = `${group.name}:${refs.join('|')}`;
      if (!buckets.has(key)) buckets.set(key, { name: group.name, pivot: group.pivot, refs, pool, indices: [] });
      const bucket = buckets.get(key), indices = ref.values.map(Number);
      if (indices.length !== 3) throw new Error(`Expected exported triangles, found ${indices.length} vertices`);
      bucket.indices.push(...indices); polygons++;
    }
    // Skeletal tables/joints describe animation; their geometry is already in world-space bind pose.
  }
  next(); while (token) walk();
}
const gltf = { asset: { version: '2.0', generator: 'Shader Fieldnotes EGG converter', copyright: 'Original mill artwork: David Lettier; original repository asset terms apply.' }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], materials: [], textures: [], images: [], samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }], buffers: [], bufferViews: [], accessors: [] };
const chunks = []; let offset = 0;
function accessor(values, components, index = false) {
  const array = index ? new Uint32Array(values) : new Float32Array(values);
  if (![...array].every(Number.isFinite)) throw new Error('Nonfinite geometry');
  const buffer = Buffer.from(array.buffer);
  const view = gltf.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: buffer.length, target: index ? 34963 : 34962 }) - 1;
  chunks.push(buffer); offset += buffer.length;
  const min = Array(components).fill(Infinity), max = Array(components).fill(-Infinity);
  for (let i = 0; i < array.length; i++) { const c = i % components; min[c] = Math.min(min[c], array[i]); max[c] = Math.max(max[c], array[i]); }
  return gltf.accessors.push({ bufferView: view, componentType: index ? 5125 : 5126, count: array.length / components, type: ['SCALAR', 'VEC2', 'VEC3', 'VEC4'][components - 1], min, max }) - 1;
}
const imageIds = new Map(), materialIds = new Map();
async function textureId(filename) {
  if (!filename) return undefined;
  if (imageIds.has(filename)) return imageIds.get(filename);
  await copyFile(`${source}/tex/${filename}`, `${output}/tex/${filename}`);
  const image = gltf.images.push({ uri: `tex/${filename}` }) - 1;
  const texture = gltf.textures.push({ source: image, sampler: 0 }) - 1;
  imageIds.set(filename, texture); return texture;
}
for (const bucket of buckets.values()) {
  const pool = pools.get(bucket.pool);
  const remap = new Map(), position = [], normal = [], uv = [], colors = [], indices = [];
  for (const index of bucket.indices) {
    if (!pool?.[index]) throw new Error(`Missing vertex ${bucket.pool}:${index}`);
    if (!remap.has(index)) {
      const v = pool[index]; remap.set(index, remap.size);
      position.push(...v.p); normal.push(...v.n); uv.push(...v.uv); colors.push(...v.color);
    }
    indices.push(remap.get(index));
  }
  const key = bucket.refs.join('|');
  if (!materialIds.has(key)) {
    const [diffuse, normalMap, specular, reflection, refraction] = await Promise.all(bucket.refs.map(textureId));
    const material = { name: bucket.refs[0] ?? 'mill', pbrMetallicRoughness: { baseColorTexture: diffuse === undefined ? undefined : { index: diffuse }, metallicFactor: 0, roughnessFactor: 0.6 }, normalTexture: normalMap === undefined ? undefined : { index: normalMap }, doubleSided: true, alphaMode: 'MASK', alphaCutoff: 0.35, extras: { specular: bucket.refs[2], reflection: bucket.refs[3], refraction: bucket.refs[4], textureIndices: [specular, reflection, refraction] } };
    materialIds.set(key, gltf.materials.push(material) - 1);
  }
  const mesh = gltf.meshes.push({ name: bucket.name, primitives: [{ attributes: { POSITION: accessor(position, 3), NORMAL: accessor(normal, 3), TEXCOORD_0: accessor(uv, 2), COLOR_0: accessor(colors, 3) }, indices: accessor(indices, 1, true), material: materialIds.get(key) }] }) - 1;
  const pivot = bucket.pivot ? [bucket.pivot[0], bucket.pivot[2], -bucket.pivot[1]] : undefined;
  const node = gltf.nodes.push({ name: bucket.name.replaceAll('/', '_'), mesh, extras: { eggGroup: bucket.name, pivot, water: bucket.name.endsWith('/water-lp') } }) - 1;
  gltf.scenes[0].nodes.push(node);
}
gltf.buffers.push({ uri: 'mill.bin', byteLength: offset });
await writeFile(`${output}/mill.bin`, Buffer.concat(chunks));
await writeFile(`${output}/mill.gltf`, JSON.stringify(gltf));
await writeFile(`${output}/ASSET_NOTICE.txt`, 'Original mill model and textures: David Lettier, 3D Game Shaders For Beginners.\nConverted locally from the tutorial assets at the user\'s request.\nThe original README explicitly excludes artwork from its software license.\nThis conversion does not grant a new license for the model or textures.\nSource: https://github.com/lettier/3d-game-shaders-for-beginners\n');
console.log(`Converted ${polygons.toLocaleString()} triangles, ${gltf.meshes.length} meshes, ${gltf.materials.length} materials; ${(offset / 1048576).toFixed(1)} MiB geometry.`);
