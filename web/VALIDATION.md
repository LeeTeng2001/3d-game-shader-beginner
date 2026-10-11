# Validation record

Validated on Windows on 2026-10-11 with Node.js 22.17.0 and Playwright 1.58.2.

## Build and content

- Strict TypeScript check and production build pass.
- All 33 HTML pages contain pre-rendered explanations. Every local asset and page link resolves and uses portable relative URLs.
- The static build includes the original BSD notice, Three.js MIT license, and attribution notes.
- Every original chapter and `.vert` / `.frag` filename appears in the migration coverage mapping.
- Dependency installation reported zero vulnerabilities at installation time; this is not a permanent security guarantee.
- Original C++ changes and untracked native project files were preserved. All implementation files are under `web/`.

## Browser checks

| Browser | Result |
| --- | --- |
| Playwright Firefox | Original companion suite: **56 passed**; added mill scene checks: **4 passed**, none skipped |
| Installed Google Chrome | Full updated suite including the final mill scene: **60 passed**, none skipped |
| Installed Microsoft Edge | Original representative suite: **7 passed**; added mill scene checks: **4 passed**, none skipped |
| Playwright Chromium with SwiftShader | All 31 lesson/showcase shaders rendered successfully across full and targeted runs; effect comparisons, filters, LUT/gamma, fallback states, mobile layout, and context restoration checked |

The full Firefox run covers every lesson plus:

- Effect-on/off pixel differences, including lighting, texturing, Phong/Blinn–Phong, water reflection/refraction, foam, and flow.
- All four blur algorithms producing distinct output.
- Neutral LUT preserving the image; missing/double gamma encoding changing it visibly.
- Nonzero reflection/refraction confidence and foam masks.
- Deferred lighting matching the forward reference within a small numerical tolerance.
- Camera motion producing blur and camera reset clearing history.
- Parameter controls, scene switching, resource disposal, resolution, source selection, reset, and resizing.
- Context loss and restoration; simulated missing float targets and missing WebGL2.
- Root hosting and `/course/` subpath hosting, including relative lesson navigation and iframe entry points.
- A 390×844 responsive viewport without horizontal overflow.

Desktop showcase, shoreline-foam, and final mill screenshots were visually inspected for rendering, layout, and readable explanation/source panels. The mill is fully framed at the initial desktop camera. Deterministic pixel checks use fixed animation time, procedural textures, and small numeric tolerances rather than cross-GPU screenshot equality.

The added mill checks verify loading the 126,168-triangle original model at a repository subpath, shader compilation, all-effects versus clean pixel differences, every blur variant in the combined pipeline, individual switches, preset reset, wheel movement, and readable explanations/source after a simulated model download failure. The converted model, textures, and asset notice are included in the static distribution. Accessory skeletal animations are not ported.

## Limits

Safari, iOS, Android hardware, and physical touch gestures were not tested. The mobile check is viewport emulation on desktop. No hardware performance target or FPS guarantee was established. Missing-capability paths were forced with diagnostic flags in addition to normal capability detection. Screen-space and optical approximations are documented in the individual lessons and README.

After the reported black canvas during orbiting, full-screen pass meshes were excluded from world-space frustum culling. The production build and four targeted Chrome checks pass, including a regression that renders four camera angles at an 887×588 viewport and checks that the canvas stays populated. The full-screen vertex shader writes clip-space positions, so scene-camera culling must never hide these passes.

A subsequent report of a growing black region exposed a separate stale-buffer dependency: the finale sampled the previous frame's blur during water composition, even with bloom multiplied by zero. Injecting NaNs into that scratch buffer reproduced persistent invalid output (71,400 nonfinite components at the diagnostic resolution). The finale now starts with a current-frame texture, and disabled bloom skips the calculation. Fresnel inputs are clamped to their valid domain, and motion reprojection guards a nonpositive homogeneous W. The production build and ten targeted Chrome tests pass. A new poisoned-buffer regression passes in Chrome and Firefox, checking finite intermediate buffers through 120 orbiting frames. Natural reproduction on the user's in-app browser/GPU remains unverified; the injected regression specifically verifies the identified propagation path.

GitHub Pages deployment is configured separately; these checks validate the local production build.
