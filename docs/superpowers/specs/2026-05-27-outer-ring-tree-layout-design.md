# Outer Ring Tree Layout & Uniform Inner Node Sizing

**Date:** 2026-05-27
**Status:** Approved

## Overview

Two related changes to the org graph layout:

1. **Uniform inner-system node sizing** — remove the team-headcount scaling from project nodes so every node in the inner cylinder (projects + their workers) is the same visual size.
2. **Outer ring tree-in-sector layout** — replace the explicit depth-step formula with a force simulation that makes each division's management chain branch outward as a visible tree within its sector arc.

---

## Change 1: Uniform Inner Node Sizing

### Current behavior

In `graphData.js`, `buildGraphData` assigns `_size` per node type:

- `person` → `5` (already uniform)
- `project` → `4 + Math.min(worksOnCount * 1.2, 8)` (scales with team headcount)
- `theme` → depth-scaled

### Change

Set project `_size` to a fixed `5`, matching person nodes. The hierarchy and importance of a project is communicated by its position in the spring layout (related projects cluster together), not by size.

**File:** `src/lib/graphData.js` — one line change in `buildGraphData`.

---

## Change 2: Outer Ring Tree-in-Sector Force Layout

### Current behavior

Outer ring people (those without any `works-on` edges) are placed at:

```
r = outerR + depth * managerStep
theta = from buildSectorMap (sector-locked)
Y = 0
```

All depth-N people share a single radius. Reporting relationships are invisible from position alone.

### New behavior

Outer ring people get a dedicated 2D force simulation in the XZ plane. Sector grouping (theta) is preserved. Radial position (r) and angular spread within each sector emerge from three layered forces:

#### Forces

1. **Soft depth anchor** (`forceDepthAnchor`)
   - A custom force: each node has a weak spring pulling it toward `outerR + depth * managerStep`.
   - Strength: low (~0.1). This establishes the general outward gradient (VPs near `outerR`, leaf ICs furthest out) without rigidly locking positions.

2. **Reports-to spring** (`forceLink` on reports-to edges)
   - Only edges where **both** endpoints are outer ring people (no `works-on` on either side). Cross-ring edges (manager in outer ring, report in inner cylinder) are excluded — the inner-cylinder person's position is handled by the existing project sim.
   - Rest length = `managerStep`. Pulls each manager-report pair toward each other.
   - Strength: 0.4. Creates visible sub-team clusters — a manager and all their direct reports group spatially near each other within the arc.

3. **Repulsion** (`forceManyBody`)
   - Negative strength (e.g., −30) applied only among outer ring nodes.
   - Prevents nodes stacking on top of each other when multiple people share a depth level.

4. **Sector arc clamping** (custom post-tick)
   - After each tick, any node whose angle has drifted outside its sector's arc gets a corrective nudge back toward the sector center angle.
   - Arc bounds are derived from `buildSectorMap` output as `angleStart = angle - arcWidth/2`, `angleEnd = angle + arcWidth/2`. No changes to `buildSectorMap` needed.
   - Implemented as a velocity adjustment, not a hard clamp, so the simulation stays stable.

#### Initialization

Each outer ring person starts at:
- `theta` = their sector's center angle (same as today)
- `r` = `outerR + depth * managerStep` (current formula — good starting estimate)
- `x = r * cos(theta)`, `z = r * sin(theta)`

#### Simulation lifecycle

- Built in the same `useEffect` that already builds the project spring sim (triggered when `graphData` changes).
- Re-converged (via `sim.alpha(0.5)`) in the `layoutParams` `useEffect` when `outerR` or `managerStep` changes.
- Run for 300 ticks to convergence before first render (same as project sim).
- In `useFrame`, outer ring person XZ positions lerp toward the sim node positions (same `LERP = 0.06` as today).

#### Y axis

Outer ring people remain at Y = 0. No change.

#### Slider behavior

`managerStep` continues to control visual spread of hierarchy chains — it now sets the rest length of the reports-to spring force rather than a fixed radial step. The effect on the slider is the same from the user's perspective: larger values = chains spread further out.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/graphData.js` | Project `_size` fixed to `5` |
| `src/hooks/useForceLayout.js` | Add outer ring force sim; replace depth-step placement with sim lerp |

No changes to `useGraphStore.js`, `LayoutSettings.jsx`, or any component files.

---

## What Stays the Same

- Inner cylinder people (those with `works-on` edges): unchanged — still placed at `cylinderR`, Y from project spring average.
- Project spring simulation: unchanged.
- Sector map (angular grouping by division): unchanged.
- `buildDepthMap`: still used for depth anchor initialization and depth anchor force target.
- `buildSectorMap`: still used for theta assignment and sector arc clamping bounds.
- All layout sliders (`cylinderR`, `outerR`, `projectSpread`, `managerStep`): still functional.

---

## Open Questions / Non-Goals

- **Theme nodes**: not in scope. Their sizing and placement are unchanged.
- **Y position for outer ring people**: not in scope. Tracking manager Y (to cascade hierarchy in 3D) is a possible future enhancement.
- **Performance**: the outer ring sim runs once at startup and once per `layoutParams` change — same pattern as the project sim. No per-frame cost beyond the existing lerp.
