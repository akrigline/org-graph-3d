# Unified Hover Tooltip Design

**Date:** 2026-05-25
**Status:** Approved

## Overview

Replace the existing per-node floating 3D sprite labels with a single HTML cursor-following tooltip component that covers all interactive elements: person nodes, project nodes, and theme clouds (NebulaMesh). Clicking any interactive element continues to open the DetailPanel (already supports all three types).

## Goals

- Consistent hover UX across nodes and clouds
- Theme clouds become interactive (hover + click)
- Remove ad-hoc sprite label code from NodeMesh
- No new store fields — reuse `hoveredNodeId` and `selectedNodeId`

## Store Changes

None. `hoveredNodeId` and `selectedNodeId` in `useGraphStore` are generic IDs already consumed by DetailPanel for all node types. NebulaMesh gains the right to call `setHoveredNodeId` and `setSelectedNodeId` with theme IDs.

## NebulaMesh Interaction

Add pointer event handlers to the `<mesh>` element in `NebulaMesh`, mirroring the NodeMesh pattern:

```jsx
onPointerOver={e => { e.stopPropagation(); useGraphStore.getState().setHoveredNodeId(themeNode.id); }}
onPointerOut={() => useGraphStore.getState().setHoveredNodeId(null)}
onClick={e => { e.stopPropagation(); useGraphStore.getState().setSelectedNodeId(themeNode.id); }}
```

**Priority:** NodeMesh already calls `e.stopPropagation()` on `onPointerOver` and `onClick`. Since R3F dispatches pointer events to the closest intersected object first, a node overlapping a cloud will always capture the event before the cloud does. No additional priority logic is needed.

## NodeMesh Cleanup

Remove the following from `NodeMesh`:
- `makeLabel` function (canvas sprite factory)
- `labelRef` ref
- All sprite add/remove logic inside `useFrame` (the `isActive` branch)

The `onPointerOver`/`onPointerOut` handlers remain — they still drive `hoveredNodeId` which the new tooltip reads.

## HoverTooltip Component

**File:** `src/components/HoverTooltip.jsx`

**Behavior:**
- Reads `hoveredNodeId` and `rawData` from the store
- Tracks cursor position via a `mousemove` listener on `window` (local `useState`)
- Renders nothing when `hoveredNodeId` is null
- Renders a fixed-position `div` offset slightly from the cursor (e.g. `left: x + 12, top: y + 12`)
- Offset clamps to viewport edges to avoid overflow (simple `Math.min` against `window.innerWidth/Height`)

**Content by node type:**

| Type | Line 1 | Line 2 |
|------|--------|--------|
| `person` | Node label | Department |
| `project` | Node label | "Project" |
| `theme` | Node label | Overseer name (first person whose edge has `type === 'oversees'` and `target === themeId`; if none, omit line 2) |

**Overseer lookup:** Filter `rawData.edges` for `{ type: 'oversees', target: themeId }`, find the first whose source is a person node, return that person's label.

**Styling:** Dark-glass panel consistent with the rest of the HUD:
```
bg-black/90 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-[#e0e0e0] pointer-events-none
```
Line 2 rendered in a smaller muted color (`text-[11px] text-gray-400`).

## App Integration

Mount `<HoverTooltip />` in `App.jsx` alongside the other HUD components, gated on `showGraph && hudVisible`:

```jsx
{showGraph && hudVisible && <HoverTooltip />}
```

## Data Flow

```
window mousemove → HoverTooltip local state (x, y)
NodeMesh / NebulaMesh onPointerOver → store.hoveredNodeId
HoverTooltip reads hoveredNodeId + rawData → renders tooltip div at (x+12, y+12)

NodeMesh / NebulaMesh onClick → store.selectedNodeId
DetailPanel reads selectedNodeId → renders full detail panel
```

## Files Changed

| File | Change |
|------|--------|
| `src/store/useGraphStore.js` | No change |
| `src/components/Canvas/NodeMesh.jsx` | Remove makeLabel, labelRef, sprite logic |
| `src/components/Canvas/NebulaMesh.jsx` | Add onPointerOver, onPointerOut, onClick |
| `src/components/HoverTooltip.jsx` | New file |
| `src/App.jsx` | Import and mount HoverTooltip |

## Out of Scope

- Tooltips for link/edge hover
- Tooltip for particles (ParticleSystem)
- DetailPanel changes (already renders person, project, and theme types correctly)
