# belongs-to Edge Type — Design Spec

**Date:** 2026-05-26

## Problem

Theme clouds require explicit project-theme membership to render. The existing mechanism — an optional `theme` field on `oversees` edges — is brittle: it is easy to omit, semantically indirect, and not present in `big-sample.json` at all, causing clouds to silently not render.

## Goal

Replace the `edge.theme` field with a first-class `belongs-to` edge type. Projects explicitly declare their theme membership. A project may belong to multiple themes, and those clouds should visually intersect (Venn diagram style).

## Data Model

### New edge type

```json
{ "source": "project-aurora", "target": "theme-012", "type": "belongs-to" }
```

- Direction: project → theme
- A project may have multiple `belongs-to` edges (one per theme it belongs to)
- These edges are structural — they define cloud membership and are not rendered as lines

### Removed

The `theme` field on `oversees` edges is removed from both `sample.json` and `big-sample.json`.

### Validation rules

- Source of a `belongs-to` edge must be a `project` node
- Target of a `belongs-to` edge must be a `theme` node
- Every `project` node should have at least one `belongs-to` edge (warning on orphaned projects)

## Code Changes

### `GraphScene.jsx` — cloud membership

Replace `edge.theme` lookup:

```js
const projectIds = new Set(
  rawData.edges
    .filter(e => e.type === 'belongs-to' && e.target === themeNode.id)
    .map(e => e.source)
);
```

Then expand `memberIds` to include people who `works-on` or `oversees` any of those projects — unchanged from current logic.

Exclude `belongs-to` edges from `structureLinks` so they are not rendered as lines.

### `focusSet.js` — `addThemeFocusSet`

Replace `edge.theme === theme.id` lookup with `belongs-to` edges targeting the theme.

### `graphData.js`

No changes needed. `belongs-to` edges are not matched by any existing layer filter (`reports-to`, `oversees`, `works-on`) and are silently ignored.

### `validate.js`

Add validation for `belongs-to` edges per the rules above.

### `sample.json`

- Remove `theme` field from all `oversees` edges
- Add equivalent `belongs-to` edges

### `big-sample.json`

- Add `belongs-to` edges for all project nodes, assigning each to one or more themes

## Visual Behavior

No changes to `NebulaMesh.jsx`.

When a project belongs to two themes:
- Both clouds independently compute their bounding boxes including that project and its people
- The clouds overlap in 3D space
- Additive blending naturally brightens the intersection — the Venn effect requires no extra code

Focus mode works correctly without changes: double-clicking theme A dims theme B's cloud to 0.04 opacity, even if they share a project, because theme B is not in theme A's focus set.
