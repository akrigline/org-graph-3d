# Cylinder Layout — Design Spec

**Date:** 2026-05-26  
**Status:** Approved

## Problem

The current force-directed layout collapses the org graph into a mess. Cross-team project links (`works-on`) pull people from different divisions toward each other, destroying the readable org hierarchy. Theme nebula clouds are too vague to communicate project membership clearly. People working on too many projects are invisible rather than conspicuous.

## Goals

- Show division hierarchies and cross-team project relationships simultaneously in 3D
- Make "overloaded" people (working on many projects) visually obvious without explicit labeling
- Make project affinity between people emerge spatially — teams that share work cluster together

## The Cylinder Model

The graph's 3D space is organized in cylindrical coordinates `(θ, r, Y)`:

| Dimension | Encodes | Fixed or dynamic |
|-----------|---------|-----------------|
| **θ** (angle around XZ) | Division / department | Fixed per person (sector assignment) |
| **r** (radial distance from Y axis) | Project involvement | Fixed: `cylinder_r` if works on ≥1 project; `outer_r` if no projects |
| **Y** (height) | Project proximity | Derived for people; physics-driven for projects |

### What it looks like

- **Top-down:** A radial org chart. Each division owns an angular wedge. Reports-to edges form faint trees within each wedge. Non-project people sit on the outer rim; project workers sit on the inner cylinder surface.
- **Side-on:** A cylinder with horizontal bands. Each band corresponds to a project (or cluster of related projects). People cluster at the Y level of their project(s).

## Coordinate Details

### Sector assignment (θ)

Divisions are enumerated from the data (`department` field on person nodes, prefix before ` - `). Each division gets an equal angular slice of 2π. Within a sector, people are spread evenly across the sector's angular arc. Sort order within the arc: BFS depth from the sector's root in the reports-to tree (root = person with no manager in this dataset, or the most senior person). People at the same depth are sub-sorted by id for stability. This is deterministic and requires no simulation.

### Radial distance (r)

- `cylinder_r` (~120 units) — people who appear in at least one `works-on` edge
- `outer_r` (~220 units) — people with no `works-on` edges (managers, executives)

No physics on r. Radial distance is converted to (x, z) directly each frame via cylindrical-to-cartesian: `x = r * cos(θ)`, `z = r * sin(θ)`. No force is used.

### Y position

**Project nodes:** Physics-driven on Y only (XZ pinned to 0, 0).

- Projects attract each other on Y with strength proportional to the number of shared `works-on` members: `strength = sharedCount / maxShared`
- A weak mutual repulsion (`forceManyBody` Y-only, small strength) prevents all projects collapsing to Y=0
- Result: project families with overlapping teams cluster into Y bands; orthogonal workstreams drift apart

**Person nodes:** Derived each frame from current project Y positions — not physics-driven.

```
if works on 1 project:   Y = project.y
if works on N projects:  Y = mean(projects.map(p => p.y))
if works on 0 projects:  Y = 0
```

This means overloaded people float visibly between project bands. The more projects, the more ambiguous their vertical position — this reads as "stretched" without any additional UI.

## Edge Rendering

All edge types use an opacity tier system driven by hover/focus store state:

| State | Reports-to opacity | Works-on opacity |
|-------|--------------------|-----------------|
| Default | 0.10 | 0.12 |
| Hover (either endpoint) | 0.40 | 0.45 |
| Focus | 0.85 | 0.85 |

Only the edges connected to the hovered/focused node step up. Unrelated edges stay at default. Color is unchanged from current (reports-to: white/grey; works-on: existing color).

## What Is Not Changing

- **NebulaMesh (theme clouds):** Deferred. Theme clouds are a layer toggle; they won't conflict with the new layout and can be revisited separately once the cylinder layout is stable.
- **ParticleSystem:** Unchanged — amber particles on `oversees` edges still render normally.
- **HUD / DetailPanel / LayerToggles / BottomControls:** No changes.
- **Data format:** No changes to the JSON schema.

## Code Changes Required

### `src/lib/graphData.js`

- Add `buildSectorMap(nodes)`: groups person nodes by division (prefix of `department` field), returns `Map<divisionId, { angle, nodes[] }>` with evenly spaced angles
- Add `worksOnCount(edges)`: returns `Map<personId, number>` of works-on edge count per person
- Export these for use in the layout hook

### `src/hooks/useForceLayout.js`

Replace the current monolithic 3D simulation with two separate concerns:

1. **Project Y simulation** — D3 simulation with only project nodes. Forces:
   - `forceLink` between project pairs weighted by shared-people count (Y attraction)
   - `forceManyBody` with small negative strength (Y repulsion to spread isolated projects)
   - `forceY` toward 0 as a centering bias
   - XZ coordinates of project nodes fixed to (0, 0) and not touched by this simulation

2. **Person position computation** — runs in `useFrame`, not a D3 simulation:
   - For each person: compute target `(x, z)` from sector angle + radial distance
   - Compute `Y` from mean of their projects' current Y
   - Apply light spring smoothing toward target position (lerp factor ~0.05) so positions animate rather than snap when projects move
   - Within-sector angular spread: use the BFS-sorted index from `buildSectorMap` to assign each person a fixed angle within the sector's arc; no force needed

### `src/components/Canvas/NodeMesh.jsx`

- Read person positions from computed cylindrical positions (not `simNodesRef`)
- Read project positions from project Y simulation nodes
- No change to geometry (sphere = person, box = project)

### `src/components/Canvas/LinkLines.jsx`

- Add opacity tier logic: for each edge, check if source or target is in `hoveredId` or `focusedIds` from the store
- Three opacity levels per edge type (default / hover / focus) as specified above
- Use vertex colors with alpha or `material.opacity` per LineSegments group

## Emergent Behaviors (expected)

| Situation | Visual result |
|-----------|--------------|
| Projects with many shared members | Cluster into a tight Y band |
| Separate workstreams | Clear vertical gap between bands |
| Person on 1 project | Sits cleanly on the project's ring |
| Person on 2–3 projects | Floats visibly between rings |
| Person on 4–5 projects | Sits at a muddled average, conspicuously adrift |
| Manager / exec with no projects | On the outer rim, Y=0, clearly separate from active workers |
