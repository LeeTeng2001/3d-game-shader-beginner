# Migration coverage

The browser edition demonstrates every original chapter technique on new scenes. “Complete” below means a working teaching implementation, not visual parity with the mill or an engine-compatible translation of every legacy helper.

## Delivery stages

| Stage | Status | Delivered |
| --- | --- | --- |
| 1 — foundation | Complete | Static companion, scene controls, real source, reference frames, GLSL, texturing, forward lighting/shadows, Phong/Blinn–Phong, normal mapping, render-to-texture, blur, bloom |
| 2 — lighting and filters | Complete | Fresnel, rim, cel, deferred, fog, SSAO, camera motion blur, chromatic aberration, outlining, depth of field, posterization, pixelization, sharpen, dilation, grain, LUT, gamma; box/Gaussian/median/Kuwahara variants |
| 3 — water | Complete | Separate water geometry, reflected/refracted ray hits, hit-color lookup, Fresnel composition, flow normals, foam mask and pattern; procedural animation and particles |

## Chapter mapping

Except for setup/build/run, each original `sections/<id>.md` maps to the same `<id>.html` in the browser distribution. There are 30 technique lessons.

| Original chapters | Browser destination / implementation |
| --- | --- |
| setup, building-the-demo, running-the-demo | `README.md`: Node setup, build, hosting, embed, controls; `index.html` showcase |
| reference-frames, glsl, texturing | Geometry shader coordinate/UV/texture branches |
| lighting, blinn-phong | Shared lighting functions, shadow depth and PCF |
| fresnel-factor, rim-lighting, cel-shading | Shared lighting functions and dedicated controls |
| normal-mapping | Procedural normal texture, tangent basis and handedness |
| render-to-texture | Named color/depth/geometry buffers and fullscreen passes |
| deferred-rendering | Four-attachment geometry then fullscreen lighting; forward comparison |
| fog | View-depth atmospheric blend |
| blur | Separable box/Gaussian, 3×3 median, four-region Kuwahara |
| bloom | Bright extraction, Gaussian spread, additive composition |
| ssao | Projected hemisphere sample kernel and visible-surface comparison |
| motion-blur | Previous view-projection reprojection and history reset |
| chromatic-aberration | Radial channel displacement |
| screen-space-reflection, screen-space-refraction | View-space ray march with crossing refinement, confidence, and miss fallback |
| foam | Separate shallow-depth mask and procedural pattern |
| flow-mapping | Two-phase advected normal sampling |
| outlining | Neighbor depth and normal discontinuities |
| depth-of-field | Depth-weighted sharp/blur blend |
| posterization, pixelization, sharpen, dilation | Explicit fullscreen image operations |
| film-grain | Deterministic pixel/time hash |
| lookup-table | Generated 16³ color LUT with trilinear sampling |
| gamma-correction | Correct, omitted, and doubled sRGB display encoding |

## Original shader mapping

Paths in the left column are relative to `demonstration/shaders/`. Browser shader files are in `web/src/shaders/`.

| Original shader(s) | Browser equivalent |
| --- | --- |
| vertex/base.vert | `geometry.vert`: explicit model/view/projection, UV, normal and tangent bindings |
| vertex/basic.vert | `fullscreen.vert`: fullscreen pass coordinates |
| vertex/discard.vert; fragment/discard.frag | Layer selection in `GeometryPass`: omitted geometry is never drawn; the engine-specific discard material is unnecessary |
| fragment/base.frag | `geometry.frag` + `lighting.glsl`: forward lighting, texturing, shading controls |
| fragment/base-combine.frag | `composite.frag`: reflection, refraction, foam, and surface composition |
| fragment/scene-combine.frag | `composite.frag`: background, bloom and fog |
| fragment/geometry-buffer-0.frag | `geometry.frag`: opaque position and normal attachments |
| fragment/geometry-buffer-1.frag | Separate water `GeometryPass` + `analysis.frag` foam pass; split to respect four-attachment limit |
| fragment/geometry-buffer-2.frag | Procedural mesh particles use the ordinary opaque geometry pass; transparent smoke compositing is intentionally not reproduced |
| fragment/position.frag | Position buffer view via `display.frag` |
| fragment/normal.frag | Normal buffer view via `display.frag` |
| fragment/material-diffuse.frag | Albedo buffer via `geometry.frag` / `display.frag` |
| fragment/material-specular.frag | Explicit shininess and highlight-model uniforms in shared lighting; no hidden Panda3D material binding |
| fragment/box-blur.frag | `filter.frag`: separable box and Gaussian variants |
| fragment/median-filter.frag | `filter.frag`: median branch |
| fragment/kuwahara-filter.frag | `filter.frag`: Kuwahara branch |
| fragment/bloom.frag | `filter.frag`: bright extraction; blur passes; `composite.frag` additive combine |
| fragment/ssao.frag | `analysis.frag`: hemisphere occlusion branch |
| fragment/fog.frag | `composite.frag`: distance fog branch |
| fragment/motion-blur.frag | `composite.frag`: camera reprojection branch |
| fragment/chromatic-aberration.frag | `composite.frag`: channel displacement branch |
| fragment/screen-space-reflection.frag | `analysis.frag`: reflected ray hit UV and confidence |
| fragment/screen-space-refraction.frag | `analysis.frag`: refracted ray hit UV and confidence |
| fragment/reflection.frag; fragment/reflection-color.frag | `composite.frag`: hit-color lookup, miss fallback, Fresnel weighting |
| fragment/refraction.frag | `composite.frag`: refracted hit-color lookup and water tint |
| fragment/foam-mask.frag | `analysis.frag`: shallow/intersection mask |
| fragment/foam.frag | `analysis.frag` pattern + `composite.frag` foam blend |
| fragment/outline.frag | `analysis.frag` depth/normal edges + `composite.frag` ink blend |
| fragment/depth-of-field.frag | `filter.frag` blur + `composite.frag` focus blend |
| fragment/posterize.frag | `composite.frag`: color quantization |
| fragment/pixelize.frag | `composite.frag`: snapped sampling coordinates |
| fragment/sharpen.frag | `composite.frag`: unsharp mask |
| fragment/dilation.frag | `composite.frag`: brightest-neighbor selection |
| fragment/film-grain.frag | `composite.frag`: pixel/time noise |
| fragment/lookup-table.frag | `materials.ts` generated 3D LUT + `composite.frag` sampling |
| fragment/gamma-correction.frag | `display.frag`: explicit sRGB transfer and teaching error modes |

Flow mapping, Fresnel, rim lighting, cel shading, and normal mapping were embedded in the original base/geometry shaders rather than separate files. They remain explicit geometry/shared-lighting branches here.

## Final combined scene

`final-scene.html` is the last lesson and uses the original mill model and textures, converted to glTF by `scripts/convert-mill.mjs`. Its 24 switches compose lighting, water, ambient occlusion, atmosphere, bloom, camera blur, focus blur, and image filters through explicit passes. Phong/Blinn–Phong and filter variants remain selectable alternatives. Presets provide cinematic, all-techniques, and clean comparisons; the buffer inspector exposes intermediate results.

The water wheel animates. Banner, shutters, and weather vane geometry is included in bind pose. Original skeletal animation, font, sound, smoke sprites, and pixel parity remain outside scope. Asset attribution and original license restrictions are preserved separately from the shader software license.
