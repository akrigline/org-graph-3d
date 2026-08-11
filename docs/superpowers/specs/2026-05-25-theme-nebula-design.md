# Theme Nebula Design

**Date:** 2026-05-25
**Status:** Approved — ready for implementation planning

## Problem Statement

Themes in the current graph are rendered as octahedron nodes connected to projects and people via explicit edges. This makes the containment relationship invisible — a project "belonging to" a theme looks the same as any other link. The goal is to replace theme nodes with volumetric nebula clouds that visually encompass their member projects, making containment the primary communication and edges secondary.

## Core Decisions

### Themes stay as force-graph nodes

Themes must remain nodes in the D3 force simulation. If removed, there is no gravitational mechanism to cluster their member projects spatially — the cloud would become a stretched highlight over scattered nodes rather than a coherent region.

The change is purely visual: theme nodes become invisible anchor points (zero-opacity geometry) that attract their member projects via existing `oversees` link forces. The cloud shell is rendered as a separate scene-level Three.js object, not as the node's `nodeThreeObject`.

### Cloud shell: glowing nebula with additive blending

Each theme cloud is rendered as a large sphere with a **rim-glow** appearance: transparent at the center, colored and glowing at the surface. This is achieved using a canvas-painted radial gradient texture mapped onto a `SphereGeometry`, with `THREE.AdditiveBlending`. Additive blending means overlapping clouds (a project belonging to multiple themes) produce brighter overlap zones, making shared membership visible without requiring separate indicators.

The amber theme color (`#e8a030`) is the starting point; this can be per-theme if theme color variation is added later.

### Bounding sphere is computed dynamically each tick

`3d-force-graph`'s `nodeThreeObject` callback fires per node in isolation — it does not provide sibling node positions. To render a cloud that precisely encompasses its members, cloud mesh position and scale are updated on every simulation tick using the library's `onEngineTick` callback.

Per tick, for each theme:
1. Gather `x/y/z` positions of all member project nodes
2. Include the theme anchor node's own position (biases the sphere outward — see below)
3. Compute centroid and max-distance bounding sphere
4. Mutate the existing cloud mesh in place (`.position.copy()`, `.scale.setScalar()`)

**Object pooling:** Cloud `Mesh` objects are instantiated once at graph init and added to the Three.js scene. No geometry or material is created inside the tick loop — only scalar mutations. This keeps the hot path allocation-free.

**Pre-grouped maps:** A `themeProjectMap (themeId → [projectNodes])` and `themeChildMap (themeId → [childThemeIds])` are built once whenever `graphData` changes, not inside the tick loop.

**Tick complexity:** O(T × P) where T = number of themes and P = average projects per theme. At organization scale this completes in under a millisecond and does not threaten 60 FPS.

### Nested clouds: post-order traversal

Parent theme clouds encompass child theme clouds. The bounding sphere for a parent must include the full extent of each child cloud, not just the child's anchor position. Computed bottom-up:

1. Recursively process leaf themes first
2. For each parent, collect member project positions **plus** the bounding sphere extent of each child cloud (center ± radius in all directions, approximated as two poles along the axis toward the parent)
3. Fit a new bounding sphere over the combined point set
4. Mutate the parent cloud mesh

This ensures that `parent.radius ≥ child.center_distance + child.radius` at all times.

### Themes are pulled outward from the graph center

A D3 radial force is applied exclusively to theme nodes, pushing them away from the origin. This causes themes to migrate toward the periphery of the graph ("the outer galaxy"), with their member projects clustering around them. Because the theme anchor is included in the bounding sphere calculation, the cloud sphere is naturally elongated outward — the anchor sits at the outer edge of the cluster, biasing the centroid and expanding the sphere in the outward direction.

### Label placement: outer rim, exclusive zone

The theme name label is placed at the point on the cloud's bounding sphere surface that faces directly away from the graph origin:

```
labelPosition = normalize(cloudCenter) × (cloudCenter.length() + cloudRadius)
```

Because parent clouds are elongated outward, this point is always on the outer rim — outside any child cloud's extent. The label is therefore always in the cloud's "exclusive zone" (the region belonging to this cloud but not any nested child).

### Overseer indication: person node pulled toward the outer rim

The person who oversees a theme is attracted toward the cloud's outer point by an additional D3 force applied per-overseer-pair. This places the overseer node visually at the outer rim of their cloud, co-located with the theme label — making the overseer prominent at the cloud's most visible surface without requiring a separate UI element.

The theme name label sprite is offset slightly to sit beside the overseer node rather than overlapping it. If a theme has no overseer, the label remains at the outer rim unaccompanied.

### Edge termination: linkPositionUpdate for surface cropping

Edges from overseers to theme clouds terminate at the cloud surface rather than the center. This is implemented via `3d-force-graph`'s `linkPositionUpdate` callback, which intercepts the per-frame line geometry update and crops the endpoint to the sphere surface:

```js
graph.linkPositionUpdate((line, { start, end }, link) => {
  if (link.target is a theme) {
    // shorten end to cloud surface: end = end + normalize(start - end) × cloudRadius
  }
});
```

**Jitter mitigation:** `nodeVal` is NOT used to drive link termination, because mutating `nodeVal` during warmup alters D3's collision force and can cause feedback oscillation. Instead, `nodeVal` is fixed to a baseline approximation for physics purposes only; all visual termination is handled by `linkPositionUpdate`.

### Click detection

Since the cloud mesh is a scene-level object (not a `nodeThreeObject`), `3d-force-graph`'s built-in raycasting does not detect clicks on it. Click detection is handled by setting each theme node's `nodeVal` to a fixed baseline value (set once at graph init, not mutated per-tick) large enough to approximate the expected cloud radius. The library uses `nodeVal` to compute the click-detection radius around the anchor position. Keeping it fixed avoids the jitter feedback loop described above; the approximation is sufficient because the anchor is already pulled toward the outer rim where clicks are most likely.

If more precise click detection is needed in a follow-up, a manual Three.js `Raycaster` check against cloud meshes can be added on the renderer's pointer event.

### Focus mode

When a node enters focus mode, cloud meshes for themes not in the focus set dim to match node dimming (opacity → near zero). This is updated in the same `onEngineTick` pass by checking whether each theme node's id is in the focus set, then mutating the cloud mesh material's opacity.

### Layer toggle

The existing `layers.themes` toggle hides/shows cloud meshes by setting `mesh.visible = layers.themes`. Theme nodes are also excluded from the simulation data (existing behavior in `getVisibleData`). No new toggle state is required.

## What Does Not Change

- `focusSet.js` — theme nodes remain in the graph; all existing walks continue to work
- `DetailPanel.jsx` — reads from `rawData` directly; unaffected
- `validate.js` — schema unchanged
- `graphData.js` — `getVisibleData` unchanged; `buildGraphData` may receive a minor tweak to set theme `_size` to a small value (since the cloud renders the visual, the node itself should be invisible/tiny)
- `colors.js` — cloud color derived from existing theme color (`#e8a030`)
- Sample data schema — unchanged; `theme` field on `oversees` edges already encodes project–theme membership

## Files Affected

| File | Change |
|------|--------|
| `src/components/Graph3D.jsx` | Main implementation: cloud mesh pool, onEngineTick, outward radial force, overseer attraction force, linkPositionUpdate, label sprites |
| `src/lib/graphData.js` | Set theme `_size` to near-zero so node mesh is invisible; no other changes |

## Out of Scope

- Per-theme color variation (all clouds use amber for now)
- Animated cloud pulse or particle effects
- Ellipsoid/convex-hull cloud shapes (sphere is sufficient given natural elongation from outward bias)
- Precise click raycasting on cloud mesh surface (nodeVal approximation is sufficient)
