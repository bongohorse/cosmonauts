# Milestone 6: Renderer Upgrades (PixiJS v8)

This document contains notes and planned architectural upgrades for the `packages/client` renderer, specifically transitioning from M5 (placeholder primitives) to M6 (Abilities/Heroes with actual game art).

## 1. Scene Graph Architecture
Currently, the renderer uses a flat hierarchy, clearing a `Graphics` layer and redrawing primitives every frame. For M6, we must migrate to a proper PixiJS Scene Graph:

- **Object Pooling:** Maintain a map of `EntityId -> Container` to avoid recreation.
- **Hierarchy:** Each entity (e.g., Hero) should be a `Container` acting as a parent to its `Sprite` (or Spine animation), health bar, name tag, and status effects. Moving the parent container (`entity.position.set(x,y)`) will efficiently translate all children.
- **Depth Sorting (Y-Sorting):** In a MOBA perspective, entities lower on the screen must overlap entities higher up. We need to set `entityLayer.sortableChildren = true` and dynamically update `zIndex` based on the Y-coordinate each tick.
- **RenderLayers (Crucial for UI/Shadows):** PixiJS v8 natively supports `RenderLayer`. We must use this to decouple render order from the scene graph hierarchy. For example, a Hero's health bar should be a child of the Hero container (inheriting its `x/y` position), but we must assign `healthBar.renderLayer = globalUiLayer` so that *all* health bars render on top of *all* heroes, preventing a Hero standing in front from covering another Hero's health bar.
## 2. Ecosystem & Plugins
While our M5 architecture strictly avoids heavy dependencies (utilizing our own deterministic follow-camera instead of `pixi-viewport`), M6 visual flair will require specific PixiJS ecosystem tools:

- **Pixi Filters (`pixi-filters`):** Essential for Sci-Fi visuals (`GlowFilter`, `BloomFilter`, `OutlineFilter`). However, filters break GPU batching! 
  - **Performance Rule:** Never apply a filter to individual projectiles. Group them into a single `Container` and apply the filter *once* to the parent. 
  - **Padding Rule:** Visual effects like Glow and Blur expand outside the Sprite's geometry. You must configure `filter.padding` (e.g., `padding: 10`), otherwise the glowing edges will be abruptly clipped into a square!
- **Spine (`@esotericsoftware/spine-pixi`):** Highly recommended for hero skeletal animations to save memory over traditional sprite sheets, providing 60FPS fluid multi-directional movement.
- **Audio (`@pixi/sound` or Howler.js):** Required for spatial audio and ability sound effects.

## 3. Performance Paradigm (Completed)
*Note: The `isRenderGroup: true` optimization for the world camera was implemented during M5.*
Always ensure static layers or large distinct UI/world groupings utilize v8's `isRenderGroup` feature to isolate transform matrices and batching from the global stage.

## 4. Garbage Collection (Texture & GPU Memory)
Currently (M5), we reuse the exact same 4 `Graphics` layers and just call `.clear()`, which safely resets internal geometry without leaking memory. However, in M6 when we move to dynamic entity containers:
- **Explicit Destruction:** You **MUST** call `entityContainer.destroy({ children: true })` when an entity is removed from the game. Simply calling `removeChild()` will cause massive GPU memory leaks because JavaScript's Garbage Collector cannot automatically free WebGL/WebGPU resources.
- **Texture GC:** As we introduce asset loading (Sprites), be aware that PixiJS runs an automatic `TextureGCSystem` to clean up unused textures, but explicit destruction of container hierarchies remains mandatory for optimal memory management.

## 5. High-Performance Best Practices
As entity counts scale in M6 (minion waves, projectiles), implement these PixiJS best practices:
- **Culling:** Only render what the camera sees. Set `cullable = true` on entity containers and map tiles, and utilize PixiJS v8's culling system to skip rendering off-screen objects.

- **Texture Atlases (Batching):** Package all character and environment sprites into Sprite Sheets / Atlases. PixiJS can batch thousands of sprites into a single GPU draw call as long as they share the same base texture.
- **ParticleContainers (and Future Editor):** If an ability generates hundreds of projectiles or sparks, use a `ParticleContainer` and its lightweight `Particle` children for zero transform overhead.
  - *Future Particle Editor Note:* When we build the in-game Particle Editor, remember the v8 `dynamicProperties` constraint. You must explicitly tell the `ParticleContainer` which properties the editor will animate (e.g., `new ParticleContainer({ dynamicProperties: { position: true, rotation: true, scale: true, color: true } })`). If you omit a property here, altering it in the editor will have no effect on the screen because PixiJS bakes static properties into the GPU buffers immediately!
- **Mesh (Advanced Geometry):** For advanced visuals that a simple `Sprite` can't handle, utilize PixiJS's built-in Mesh classes:
  - **`MeshPlane`:** Subdivides a texture into a grid of vertices. By animating the vertices via code or a custom shader, you can easily create wavy water in a river, a flapping banner, or a wobbly slime enemy without needing a 3D engine.
  - **`MeshRope`:** Maps a texture along a series of points. This is essential for abilities like trailing energy ribbons, snake bodies, or curved laser whips!
- **`cacheAsTexture` (Static Caching):** If you build a complex UI panel or a static background map using hundreds of `Graphics` shapes or text nodes, call `container.cacheAsTexture({ antialias: true, resolution: window.devicePixelRatio })`. PixiJS v8 will flatten the entire container into a single GPU texture, reducing thousands of vertices to just 4 vertices per frame.

## 6. Asset Management (v8 Assets API)
When integrating real art assets (Sprite Sheets, Spine data, BitmapFonts) in M6, we must strictly use the modern `Assets` API (not the deprecated `Loader` from v7):
- **Manifests & Bundles (`Assets.loadBundle`):** Maintain an external `manifest.json` file defining game bundles (e.g., a "match-ui" bundle, and separate bundles for each Hero like "hero-nova"). Initialize with `Assets.init({ manifest: "path/to/manifest.json" })`.
  - Crucially, this allows us to use `Assets.loadBundle('hero-nova')` to only load the graphical assets for heroes that are *actually picked* in the match, saving massive amounts of memory and bandwidth!
- **Background Loading (Zero-Jank GPU Uploads):** Use `Assets.backgroundLoad(['match-ui', 'hero-nova'])` while the player is in the lobby or matchmaking. The true power of the v8 background loader is that it doesn't just download the files—it decodes them and pushes the textures to the GPU while yielding to the main thread. This ensures that lobby animations remain buttery smooth (no frame drops) and the assets are instantly available the moment the match begins.
- **Asset Resolver (DPR & Formats):** Leverage the `Assets.resolver` for automatic optimization:
  - Provide `@1x` and `@2x` texture resolutions. The resolver will automatically download the correct size based on `window.devicePixelRatio` to keep UI crisp on Retina displays without penalizing low-end devices.
  - **Network Compression:** Set format preferences (`format: ['webp', 'png']`) to serve ultra-compressed `.webp` files to save network bandwidth.
  - **GPU VRAM Compression (Critical for MOBAs):** WebP and PNG are decompressed into massive RGBA arrays on the GPU. To save up to 80% of VRAM and eliminate GPU upload stutter, we must eventually adopt GPU Compressed Textures (`.ktx2`, `.basis`, or `.astc`). By adding these to the resolver's preference array, PixiJS will natively serve them to the GPU without decompression.
  - If asset sizes exceed Vite's bundling limits, set `Assets.resolver.basePath` to easily route all texture fetching to an external CDN.
- **SVG UI & Vector Assets:** For crisp UI elements (crosshairs, ability icons, minimap outlines) that must scale flawlessly, load `.svg` files. PixiJS v8 allows loading SVGs in two ways:
  - **As Raster Textures (Default):** The SVG is rasterized into pixels upon loading. You can define the `resolution` or `width/height` in the load options to ensure it rasterizes cleanly for Retina displays before hitting the GPU.
  - **As GraphicsContext:** By passing `parseAsGraphicsContext: true` to the loader, PixiJS parses the SVG paths into true vector geometry. This is infinitely scalable and perfect for simple geometric indicators, though less optimal for highly complex artwork due to triangulation overhead.

## 7. Texture Architecture (v8 Paradigms)
As we load real imagery, keep in mind PixiJS v8's strict separation of textures:
- **Texture vs TextureSource:** A `TextureSource` is the raw pixel data uploaded to the GPU. A `Texture` is merely a lightweight "view" into that source (e.g., a frame within a Sprite Sheet). This is *why* batching works so well—hundreds of `Texture` objects can share a single `TextureSource`.
- **Texture Styles (Filtering/Blur):** In v8, sampling properties (like scaling algorithms) are decoupled into `TextureStyle`. If the artists provide crisp pixel-art or hard-edged sprites, you must set `TextureStyle.defaultOptions.scaleMode = 'nearest'` to prevent the browser from blurring the textures when the camera zooms!

## 8. Sprite & Graphics Capabilities (UI & Gameplay)
When implementing visual assets, ensure you use the correct object variant:
- **Anchors & Tinting (`Sprite`):** For all game entities (Heroes/Droids), you must set `sprite.anchor.set(0.5)` so the image centers exactly on the simulation coordinates. Additionally, use `sprite.tint = 0xff0000` for cheap, zero-overhead damage flashes instead of complex shaders.
- **Scalable UI (`NineSliceSprite`):** For UI panels, tooltips, and health bars, never stretch standard Sprites (which distorts corners). Use `NineSliceSprite` to create UI elements of any width/height using a single, tiny, reusable texture.
- **Parallax Backgrounds (`TilingSprite`):** If the map features a starry space background or repeating ground textures, do not render thousands of tiles. Use a single `TilingSprite` spanning the screen, and modify its `tilePosition.x/y` dynamically based on the camera position to create a cheap, infinite parallax scrolling effect.
- **Reusable Geometry (`GraphicsContext`):** When drawing vector elements (e.g., aiming reticles, range circles, or health bar backgrounds) across multiple heroes, do not use `g.circle().fill()` for each one. Instead, define a single `GraphicsContext` containing the geometry, and pass it to multiple `Graphics` instances (`new Graphics(sharedContext)`). This saves immense CPU overhead and memory.
- **Gradients & Pattern Fills (`FillGradient` / Textures):** The v8 `.fill()` API allows for much more than flat colors. Use `FillGradient` for Sci-Fi forcefields and laser blasts, or pass a texture into `.fill({ texture: myTexture })` to seamlessly paint repeating terrain textures across the complex vector polygons of our map geometry.
- **Non-Scaling Strokes (`pixelLine`):** When drawing hitboxes, debug grids, or crisp UI borders, pass `pixelLine: true` into the `.stroke()` options. This ensures the line remains exactly the specified pixel width on the screen, even if the camera zooms in massively!
- **Color Management (`Color.shared`):** Never parse hex strings manually (e.g., `parseInt(hex, 16)`). Use the v8 `Color` class which natively understands CSS names, hex strings, and RGB. To avoid garbage collection overhead in hot loops (like parsing map data), always use the singleton: `Color.shared.setValue(str).toNumber()`.

## 9. Typography & Text Systems
Rendering text is traditionally one of the most expensive operations in WebGL. Follow these strict typography rules:
- **`BitmapText` for Gameplay:** For rapidly updating numbers (health points, floating damage, timers), NEVER use standard `Text` (which generates an expensive Canvas texture every frame). Always use `BitmapText` with a pre-generated font atlas. It updates practically for free by rearranging GPU quads.
- **`HTMLText` for Rich UI:** For complex UI elements (like a matchmaking chat box or a player name with a colored `[CLAN]` tag), use `HTMLText`. It leverages the browser's DOM rendering via SVG, allowing you to use rich inline CSS styling (colors, bolding, italics) seamlessly.
- **`SplitBitmapText` for Effects:** If a player takes a massive critical hit (e.g., "-1500!"), use the new v8 `SplitBitmapText` object. It automatically separates every character into its own child `Sprite`, allowing us to easily animate individual digits bouncing or exploding outward with zero performance cost!

## 10. Input & Event Handling (v8 UI)
While our core M5 gameplay input (WASD/Mouse aiming) relies on a custom `InputSource` to feed the deterministic simulation, our M6 graphical UI (Minimap clicks, Inventory, Character Select) must utilize the v8 PixiJS Event System:
- **Event Modes:** PixiJS v8 deprecated `interactive = true`. You must now use `eventMode`. Use `eventMode = 'static'` for buttons/minimaps that need to receive clicks (`pointerdown`). Use `eventMode = 'dynamic'` if you also want the cursor to change automatically (e.g., `container.cursor = 'pointer'`).
- **Performance `hitArea`:** Never let PixiJS mathematically calculate mouse intersections against complex Sprites or polygons. Always explicitly define a simple `hitArea` (e.g., `container.hitArea = new Rectangle(0, 0, 100, 100)`) on your UI components to save massive amounts of CPU time during hovering and clicking!

## 11. Coordinate Systems & Math (The Determinism Rule)
PixiJS provides excellent math classes (`Point`, `Rectangle`, `Matrix`) and coordinate translation helpers (`toLocal`, `toGlobal`).
- **UI & Camera Math:** Use `container.toLocal(globalPoint)` extensively in the client when translating a player's mouse click on the UI minimap into a world coordinate for the camera to jump to.
- **CRITICAL SIMULATION RULE:** You must **NEVER** import PixiJS math classes (like `Point` or `Rectangle`) into `packages/sim`. The game simulation must remain 100% pure TypeScript and strictly deterministic. PixiJS math is floating-point heavy and tied to the renderer. Keep PixiJS math exclusively inside `packages/client`.

## 12. Accessibility (a11y)
Canvas is inherently invisible to screen readers, but PixiJS v8 includes a powerful invisible Shadow DOM layer. While the fast-paced MOBA gameplay itself may not be playable via screen reader, our M6 UI (Matchmaking, Lobbies, Settings) must be accessible:
- **Enable Accessibility:** For any interactive UI button or menu item, set `container.accessible = true`, provide an `accessibleTitle` (e.g., "Play Game"), and an `accessibleHint`. 
- **Keyboard Navigation:** Set `container.tabIndex = 0` on UI elements so players can seamlessly navigate the lobby menus using the `Tab` key without a mouse.
- **Hide Clutter:** Set `container.accessibleChildren = false` on complex visual containers (like an animated hero portrait with 50 particle children) so the screen reader doesn't attempt to read out every single decorative visual effect.

## 13. Future Extensions (Three.js Integration)
While M6 focuses exclusively on a 2D PixiJS renderer (potentially using Spine for 2D skeletal animation), if the Art Direction ever pivots to requiring true 3D models for Heroes, we can seamlessly stack PixiJS and Three.js:
- **Canvas Stacking:** Instead of one canvas, we would layer the DOM: PixiJS for the Map (Background) -> Three.js for 3D Heroes (Middle) -> PixiJS for the HUD/UI (Foreground).
- **Camera Syncing:** The `x/y` coordinates from our deterministic `packages/sim` can easily drive an Orthographic Three.js camera, ensuring the 3D models perfectly align with our 2D hitboxes.
- *Caveat:* Stacking two WebGL contexts causes a noticeable performance hit. Exhaust 2D PixiJS features (like Spine or `Mesh`) before taking the leap to full 3D integration!
