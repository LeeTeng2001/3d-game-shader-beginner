## showcase

A shader is a small program that runs for many vertices or pixels at once. This playground combines a handful of techniques on original geometry: a ceramic sphere, a copper knot, a glowing core, and a tiled floor.

Orbit the scene, switch effects off, then inspect a buffer. The **Water** scene adds a shallow pool; the **Occlusion** scene places objects close together. All textures and particles are generated locally. Use the individual lessons to isolate one idea before combining it with others.

## reference-frames

A vertex starts in **model space**, relative to its mesh. The model matrix places it in the world. The view matrix expresses it relative to the camera, and the projection matrix turns it into clip coordinates. Perspective division produces normalized device coordinates.

The color here visualizes a position in model, world, or view space. Switch **Coordinate space**, then orbit: world coordinates stay attached to the scene, while view coordinates change with the camera. This edition uses Y-up and a camera looking down negative view-space Z.

## glsl

The vertex shader positions triangles and supplies interpolated values. The fragment shader uses those values to calculate a color. Here, UV coordinates become red and green; a sine wave adds a blue pattern.

Change **Pattern frequency** to change the wave. Open the shader source and find the branch for `uMode == 2`. GLSL ES 300 requires explicit inputs, outputs, and precision. The displayed files are exactly the strings compiled by the renderer.

## texturing

A texture stores sampled information. UV coordinates decide where each fragment reads it. Our checkerboard is generated into a texture in JavaScript, then sampled by GLSL; no external image is involved.

Change **Texture repeat** and inspect seams around the sphere. Color textures use sRGB encoding and are decoded for lighting. Normal maps, masks, and geometry buffers store data and must not receive color conversion.

## lighting

Diffuse light depends on the angle between the surface normal and the direction toward the light. Specular light also depends on the viewing direction. An ambient term keeps unlit areas visible without pretending to model full global illumination.

The light renders a depth map from its own viewpoint. A fragment is shadowed when its projected depth lies behind the stored depth. Toggle **Shadows**, inspect **Shadow depth**, and vary **Light intensity**. A small bias reduces self-shadowing; too much would detach the shadow.

## blinn-phong

Phong compares the reflected light vector with the view direction. Blinn–Phong compares the normal with the halfway vector between light and view. Raising either dot product to a power concentrates the highlight.

Switch **Highlight model** and vary **Shininess**. The same exponent does not produce matching highlight widths in the two models; this lesson deliberately exposes that difference. These are teaching models rather than physically based energy-conserving materials.

## normal-mapping

A normal map changes the direction used for lighting without changing the mesh silhouette. This demo generates a rippled normal texture and transforms its tangent-space vector through a tangent, bitangent, and normal basis.

Change **Normal strength**, then orbit the sphere. The bitangent uses the tangent's handedness, which matters around mirrored UVs. The normal is transformed into view space and normalized after interpolation and perturbation.

## render-to-texture

Rendering can write to a texture rather than the browser canvas. A later pass can read that image, blur it, combine it with other images, or simply display it.

Choose **Scene color** from the buffer menu to see the first result. On hardware supporting float attachments, position and normal passes expose the geometry behind each pixel. Position RGB is remapped for display; its actual stored value remains signed view-space coordinates. Alpha marks valid geometry.

## blur

A box filter averages nearby samples equally. A Gaussian filter gives the center more weight. Both can be performed as horizontal and vertical passes. A median filter chooses a middle value and can preserve edges around isolated noise.

Kuwahara filtering compares four overlapping neighborhoods and chooses the one with the lowest color variance, producing a painterly result. Switch **Filter**, then adjust **Radius**. The implementation bounds every loop, keeping the cost visible and predictable. Median uses a fixed 3×3 neighborhood with adjustable sample spacing.

## bloom

Bloom starts by extracting values above a brightness threshold from a linear high-dynamic-range image. Two Gaussian passes spread the extracted light. A combine pass adds the blurred result back to the original.

Inspect **Bright mask** and **Blurred color** before viewing the final image. Lower **Threshold** to include more surfaces; increase **Bloom amount** to strengthen the glow. Bright extraction is why this lesson requires renderable floating-point textures.

## fresnel-factor

Reflection usually becomes stronger at grazing angles. Schlick's approximation starts from a face-on reflectance and approaches one as the view direction becomes perpendicular to the normal.

Vary **Base reflectance**. The colored edge on the sphere visualizes this factor directly. In the water pipeline the same idea weights reflection against transmission. It is an approximation, not a substitute for a full material model.

## rim-lighting

Rim lighting uses one minus the normal–view dot product to highlight the silhouette. Raising it to a power narrows the band. Unlike a shadowed physical light, this accent follows the viewer.

Adjust **Rim power** and orbit the scene. Toggle the effect to separate the artistic accent from the ordinary diffuse and specular lighting underneath it.

## cel-shading

Cel shading maps continuous illumination into a few discrete bands. This demo quantizes the diffuse term before combining it with the material color.

Change **Light bands** and move around the sphere. The bands respond to the light, while posterization quantizes the final image instead. That distinction matters when shadows, glow, and several materials share the screen.

## deferred-rendering

Deferred shading separates geometry from lighting. The first pass stores view-space positions, normals, albedo, and material properties in four attachments. A fullscreen pass then evaluates illumination using those stored values.

Inspect the geometry buffers, then compare the final result with the effect disabled, which shows the forward-lit reference. Both paths use the same light equations and shadow map. This compact lesson treats opaque geometry only; the water surface is handled separately.

## fog

Fog mixes the scene with an atmospheric color as distance increases. Here a smooth ramp between a near and far distance controls the blend in view space.

Change **Fog distance** and inspect the position buffer. The background is not geometry and is handled separately. This is a simple distance effect, not volumetric light scattering.

## ssao

Screen-space ambient occlusion estimates how much nearby geometry blocks ambient light. A deterministic hemisphere kernel is oriented around each view-space normal, projected into the position buffer, and tested against visible surface depth.

Vary **Occlusion radius** and **Strength**. Inspect **Effect mask** to see the estimate before it darkens the image. Only visible surfaces participate: offscreen and hidden geometry cannot contribute. Bias and distance weighting reduce self-occlusion and distant false blockers.

## motion-blur

Camera motion blur reconstructs a world position from the current view-space position, then projects it with the previous view-projection matrix. The difference between current and previous screen coordinates estimates velocity.

Orbit the camera to see the effect; stationary geometry and a stationary camera produce no blur. **Shutter scale** controls trail length. History resets after resize, lesson changes, and camera reset. Object motion vectors are outside this lesson, so animated objects do not get independent motion trails.

## chromatic-aberration

A lens can focus different wavelengths at slightly different positions. This stylized approximation samples red and blue on opposite sides of the current coordinate while leaving green centered.

Increase **Channel separation** to reveal the displacement near the screen edges. It is applied after scene rendering, so the effect operates on every visible object equally.

## screen-space-reflection

At the water surface, reflect the view ray around the surface normal. Step along that ray in view space, project each step, and compare its depth with the opaque position buffer. Refine a detected crossing before sampling the scene color.

Inspect **Reflection hit**: red and green encode the hit UV, and blue indicates confidence. Missing, offscreen, and grazing hits fade to a constant environment color. The ray cannot find geometry absent from the screen. Change **Ray distance** to explore that limitation.

## screen-space-refraction

Refraction bends a ray according to the ratio of refractive indices. A second screen-space trace searches the opaque scene beneath the water. Its hit samples scene color, with a tinted fallback for misses.

Change **Index of refraction**. At one, the ray does not bend; increasing the value increases distortion. The water's own position buffer is separate from the opaque scene, preventing the search from immediately hitting its starting surface.

## foam

Foam collects where water is shallow or intersects solid surfaces. The demo compares opaque geometry with the water surface in world space, then modulates the shallow-water mask with a generated repeating pattern.

Adjust **Foam width**, then inspect **Foam mask**. This is an intersection-based artistic approximation, not a fluid simulation. The mask is rendered separately from water geometry so no pass needs more than four color attachments.

## flow-mapping

A flow field stores a two-dimensional velocity. Sampling a normal texture at coordinates displaced by that velocity makes surface detail appear to move. Two offset phases crossfade to avoid an obvious reset when a cycle wraps.

Change **Flow speed** or pause animation. The procedural velocity field varies over the pool, so the pattern curls instead of translating uniformly. The perturbed normal drives lighting, reflection, and refraction.

## outlining

An outline can be detected where neighboring pixels differ strongly in depth or normal direction. Depth finds silhouettes and gaps; normals reveal creases on a continuous surface.

Increase **Edge sensitivity** and inspect **Effect mask**. Because this method works in screen space, line width is measured in pixels and changes with render resolution. It cannot outline hidden edges.

## depth-of-field

A simple circle-of-confusion estimate grows with distance from the focus plane. This lesson blends between sharp scene color and a blurred version using that estimate.

Adjust **Focus distance** and **Aperture**. This inexpensive approximation does not model lens-shaped bokeh or foreground occlusion correctly; color can bleed across depth discontinuities. The buffer view makes those limits easier to understand.

## posterization

Posterization rounds each color channel into a limited set of levels. Smooth gradients become bands, affecting surfaces, backgrounds, and lighting together.

Change **Color levels** and compare with cel shading, which quantizes illumination earlier in the pipeline. This pass works in linear color; the final display conversion happens afterward.

## pixelization

Pixelization snaps a sample coordinate to the center of a larger virtual pixel. Each block reads a single scene color, producing a deliberately coarse image.

Change **Block size**. The block grid is based on the current render resolution, not CSS layout size. Resize the window to see why these two dimensions must be managed separately.

## sharpen

An unsharp mask subtracts a local blur from the original image to estimate high-frequency detail. Adding a scaled version of that detail increases contrast around edges.

Increase **Sharpen amount** carefully. Large values create halos and overshoot. This effect cannot recover information that was never captured in the source image.

## dilation

Dilation selects the brightest sample in a neighborhood. Bright regions expand into darker ones, which is useful for masks, glows, and stylized image treatment.

Change **Radius** and inspect thin highlights. This implementation selects the entire color of the brightest sample rather than independently maximizing channels, avoiding synthetic colors assembled from unrelated pixels.

## film-grain

Film grain adds a small pseudorandom brightness variation to each fragment. The hash depends on pixel coordinates and time, so animation changes the grain without loading a noise image.

Change **Grain amount** and pause to freeze the pattern. Fixed test time produces reproducible results. Grain is added in linear color here, which is a teaching choice rather than a calibrated film response.

## lookup-table

A color lookup table maps an input RGB triplet to another color. This lesson generates a small 3D texture whose warm grade raises red, reduces blue, and adjusts contrast.

Vary **Grade amount** to blend between the original and transformed colors. Trilinear sampling interpolates between table entries. A neutral generated table is used in validation to check that identity mapping preserves color.

## gamma-correction

Lighting equations operate on linear values, while displays expect encoded values. This renderer keeps intermediate colors linear and performs one linear-to-sRGB conversion in the final display shader.

Switch **Conversion** between correct, missing, and double encoding. Missing conversion looks too dark; double encoding looks washed out. The intentional mistakes are confined to this lesson. Data buffers are visualized separately and never mistaken for color textures.

## final-scene

This is the tutorial's original mill model and textures, converted to glTF for the browser. The house, trees, dock, water, waterwheel, banner, shutters, and weather vane come from the supplied assets. The wheel rotates while flowing normals, reflections, refraction, and foam animate the water. The small skeletal accessories are shown in their original bind pose.

Here the techniques run **together**, in order: geometry and lighting, water, ambient occlusion and outlines, atmosphere, bloom, camera blur, focus blur, then the artistic image filters and final display conversion. Inspect a buffer to trace that sequence. Texturing, reference-frame transforms, GLSL, and render-to-texture are the foundation of the whole scene rather than separate visual effects.

Start with **Cinematic**, then choose **All techniques** to enable every effect switch. Each technique can also be toggled independently. Some techniques are alternatives: the highlight-model control chooses Phong or Blinn–Phong, while the blur control chooses box, Gaussian, median, or Kuwahara. Gamma defaults to correct display conversion; its error modes remain available for comparison. Camera motion blur appears while orbiting, even when scene animation is paused.

The original artwork remains subject to the original project's asset terms; converting it does not give it the shader code's BSD license. This final scene is kept separate from the original procedural lessons. Use the all-effects comparison switch or the **Clean** preset to understand how much each part of the pipeline contributes.
