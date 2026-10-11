# Shader Fieldnotes — browser companion

A standalone Three.js / TypeScript edition of the shader techniques in this repository. It contains 30 technique lessons, a combined playground, the original tutorial mill as a final scene, and an iframe entry point. The technique lessons use procedural scenes. The final scene loads the supplied model and textures from local glTF assets; no Panda3D runtime, web fonts, or CDN scripts are required.

## Run locally

Install Node.js 22.12 or newer, then from this directory:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. To build and preview the distributable site:

```sh
npm run build
npm run preview
```

`dist/` contains the complete static site. Serve it over HTTP; opening HTML directly with `file://` will not load JavaScript modules reliably. No backend is required. The build validates every local HTML link and asset URL. Its relative URLs work at `/` or beneath a path such as `/3d-game-shaders-for-beginners/`.

The existing `../docs/`, `../sections/`, and native demo are preserved. To host both editions in one site, copy this build into a separate directory such as `docs/browser/` as part of your deployment. Do not overwrite the existing documentation.

## GitHub Pages

The repository workflow `.github/workflows/pages.yml` builds this companion and publishes only `web/dist` to GitHub Pages. In the repository's **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source. Then run **Deploy shader companion to GitHub Pages** from the Actions tab. Subsequent changes to `web/` on `main` deploy automatically.

For this fork, the expected site URL is `https://leeteng2001.github.io/3d-game-shader-beginner/`; the finale is at `final-scene.html` beneath that URL. Relative asset paths already support this repository subpath. The complete model and textures are uploaded with the site. No server, Panda3D installation, environment secrets, or committed build output is needed.

This workflow makes the browser companion the Pages homepage. It leaves the original documentation files in Git untouched. The first deployment requires the repository Pages setting above; adding the workflow alone does not enable Pages. See GitHub's [custom workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Embed in documentation

```html
<iframe
  src="./browser/embed.html?lesson=normal-mapping"
  title="Interactive normal mapping lesson"
  loading="lazy"
  style="width:100%;height:620px;border:0"
></iframe>
```

Use a lesson ID from `content/catalog.json`. At narrow phone widths, allow approximately 800px of iframe height for controls or let the iframe scroll. Full lesson pages use ordinary links, so browser navigation, bookmarks, and static hosting do not require route rewrites.

## Learning controls

- Drag to orbit; right-drag to pan; scroll to zoom. Touch uses one finger to orbit and two to pan/zoom.
- Pause freezes scene animation, flow, and grain; the camera remains interactive.
- Effect enabled compares a lesson with its base rendering. Deferred rendering compares against the matching forward-lit reference. Water comparisons retain the pool surface; disabling flow holds its normal pattern stationary.
- Inspect buffer exposes scene color, linearized scene depth, shadow depth, view positions/normals, albedo/emission, and effect-specific masks or hits.
- Render resolution scales the canvas independently of page layout. Device pixel ratio is capped at 2.
- Reset restores lesson parameters, camera, scene, buffer, resolution, and motion history; it keeps the current pause preference.

The GLSL panel shows the actual compiled source bodies, including the shared lighting functions. Three.js supplies the GLSL version directive and standard engine shader defines. Editing shaders happens locally; the site intentionally has no live editor.

## Architecture

`content/catalog.json` defines lesson IDs, grouping, modes, stages, capabilities, and summaries. `content/lessons.md` contains original explanations. `scripts/pages.mjs` generates 33 real HTML documents with readable prose even without JavaScript. Run `npm run dev` again after changing lesson Markdown or catalog metadata; Vite hot-reloads application and shader changes normally.

`src/lessons.ts` attaches scene factories, control definitions, and shader source to that metadata. A `Lesson` exposes these together with `requiredCapabilities` and the explanation URL. `src/scenes.ts` owns procedural scene resources and disposes them as a unit.

`src/engine.ts` schedules explicit passes from `src/passes.ts`. Each pass names its inputs and outputs and implements render, resize, and dispose. The rendering order is:

1. Light-space depth map, then opaque forward color and geometry attachments.
2. Separate water geometry when selected.
3. Required bright extraction, horizontal/vertical filtering, SSAO/edge masks, reflection/refraction traces, and foam mask.
4. Deferred lighting or lesson composition, then exactly one display conversion.

Opaque and water geometry each use at most four attachments: color, signed view-space position with validity alpha, view-space normal, and linear albedo with emission in alpha. Water hit textures store UV in red/green and confidence in blue. Foam is a separate pass. Basic devices use one unsigned-byte color attachment instead of the float geometry buffers.

Coordinates are Y-up, right-handed. Visible view-space Z is negative. Shaders use column-vector multiplication; projection performs perspective division before mapping to UV. Tangents are orthogonalized and their `w` handedness determines the bitangent. Color textures are sRGB, data textures have no color encoding, and all intermediate color is linear. The display shader owns the final sRGB transfer; no extra Three.js tone mapping is active. HDR values above display range clip intentionally.

## Final mill scene

The last section, `final-scene.html`, combines the techniques on the supplied tutorial model. Choose **Cinematic**, **All techniques**, or **Clean**, then adjust 24 independent effect switches. Phong/Blinn–Phong and the four blur algorithms remain selectable alternatives. Inspect intermediate buffers or compare the entire chain with the effect switch.

The glTF model and textures in `public/mill/` total approximately 32 MB and load only when this scene is selected. The wheel rotates; the banner, shutters, and weather vane retain their bind poses. Audio and original skeletal animations are not included. `src/mill.ts` batches static meshes, preserves texture cutouts in shadow rendering, and disposes loaded GPU resources.

The converted assets are included, so ordinary installation and builds need no native tools. To regenerate them, first use Panda3D's `bam2egg` utility to export `mill-scene.bam`, `banner.bam`, `shutters.bam`, and `weather-vane.bam` to matching ASCII `.egg` files under `demonstration/eggs/mill-scene/`, then run `npm run convert:mill`. These intermediate exports are not included in the browser companion. The converter uses Node.js, converts world-space coordinates to Y-up, and writes glTF plus an asset notice. The original artwork's license scope remains unchanged; see `public/mill/ASSET_NOTICE.txt` before distributing it.

## Capabilities and limitations

WebGL2 is required. Advanced lessons additionally require `EXT_color_buffer_float`, four draw buffers, and complete framebuffers. Missing features leave the explanations and source readable and keep supported basic lessons working. Capability checks also run for allocated framebuffer configurations. Context restoration rebuilds the renderer and resets the lesson.

This is an educational implementation, not pixel parity with the original mill. Screen-space rays cannot find hidden/offscreen objects and use an explicit tinted/environment fallback. SSAO is a 24-sample visible-surface approximation. Motion blur accounts for camera movement only. Depth of field uses a depth-weighted blur and can bleed across boundaries. Median filtering uses 3×3 luminance-ranked samples; Kuwahara uses four regions with radius capped at 4. Shadows use a fixed bias and 3×3 PCF. Water uses a flat surface with flowing normals, not simulated fluid geometry.

## Tests

```sh
npx playwright install chromium firefox
npm run build
npm test
```

Browser binaries are development-only. Tests render all lessons, check shader compilation and nonuniform pixels, exercise controls, buffer inspection, scene disposal, resolution, missing capabilities, mobile layout, and context loss. Pixel checks use fixed time and deterministic textures. Additional tests verify effect differences, valid reflection/refraction hits, foam, forward/deferred agreement, and camera motion blur.

If stable Google Chrome and Microsoft Edge are installed, `npm run test:installed` runs the same suite against those browsers. They are optional and are not installed by the project.

`?still` pauses at a deterministic time. `?no-float` and `?no-webgl` exercise fallback states. These flags are diagnostics, not capability detection substitutes. `window.__shaderLab` exposes the current engine, pass graph, and counters for local inspection.

See [COVERAGE.md](COVERAGE.md) for the complete chapter and shader mapping and [VALIDATION.md](VALIDATION.md) for the checks performed on this checkout.

## Attribution

The shader curriculum, original algorithms, and supplied mill artwork are by David Lettier. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and `licenses/lettier-BSD-3-Clause.txt`. Companion explanations are newly written and link to the original chapters. The mill artwork is not covered by the software's BSD license; conversion does not grant additional rights.
