# OrgGraph Visualizer Spec v1.0

## Runtime
A single self-contained HTML file. Runs as a Claude artifact or opened locally in a browser. No server, no build step, no dependencies beyond CDN-loaded libraries.

**Libraries:**
- `3d-force-graph` — 3D force-directed graph rendering (Three.js under the hood)
- `three.js` — available as a peer dep via the same CDN

---

## Layout & Dimensions
Full viewport. The graph canvas fills the entire available space. A minimal overlay UI sits on top — controls don't compete with the graph for space.

---

## Data Loading
On first load, the tool presents a **JSON input area** — either paste JSON directly or drag and drop a `.json` file. The graph renders immediately on valid input. Invalid input shows a validation report (see below) instead of a broken graph.

The loaded graph persists in memory for the session. There is no save mechanism — the source file is the source of truth.

---

## Validation
Before rendering, the JSON is validated and any issues are shown as a readable list:

**Errors (block rendering):**
- Missing required fields on any node (`id`, `label`, `type`)
- Unknown node `type` (must be `person`, `project`, `theme`)
- Edge references an `id` that doesn't exist in nodes
- Unknown edge `type` (must be `reports-to`, `oversees`, `works-on`)
- Duplicate `id` values
- `reports-to` edge where source or target is not a `person`
- `works-on` edge where source is not a `person` or target is not a `project`
- Circular `parent` chain in themes

**Warnings (allow rendering, shown as dismissable panel):**
- Person node with no edges at all
- Theme node with no `oversees` edge pointing to it
- Project node with no `works-on` edges
- `theme` attribute on an `oversees` edge references an id that isn't a theme

---

## Visual Language

### Node shapes and colors

| type | shape | color |
|---|---|---|
| `person` | sphere | grouped by `department` — each department gets a distinct hue |
| `project` | box/cube | neutral white/grey |
| `theme` | octahedron (diamond) | warm amber, scaled by depth (root themes largest) |

**Node size:**
- `person` — scales with number of total edges (more connected = larger)
- `project` — scales with number of `works-on` edges (more contributors = larger)
- `theme` — scales with depth in theme hierarchy (root = largest)

### Edge styles

| type | style |
|---|---|
| `reports-to` | solid, muted grey, no arrowhead |
| `oversees` | dashed, amber, directional arrowhead |
| `works-on` | solid, colored to match person's department color, directional arrowhead |

### Labels
Visible on hover only by default. Always visible when a node is selected or highlighted. Rendered as floating text in 3D space, always facing camera.

---

## Interaction

### Camera
- Orbit: left-click drag
- Zoom: scroll wheel
- Pan: right-click drag
- Double-click empty space: reset camera to default position

### Node interaction
- **Hover** — show label, highlight direct edges
- **Single click** — select node, open detail panel
- **Double-click** — enter focus mode

### Detail panel
A minimal panel anchored to the bottom-left. Shows on node selection.

**Person:**
```
[Name]           [Department]
Title (if set)

Reports to:      [Name]
Direct reports:  [Name], [Name]
Oversees:        [Theme], [Theme]
Works on:        [Project], [Project]
```

**Project:**
```
[Project name]
Status (if set)

Contributors:    [Name] (role), [Name]
Overseen by:     [Name] via [Theme], [Name] via [Theme]
```

**Theme:**
```
[Theme name]
Part of: [Parent theme] (if set)

Overseen by:     [Name]
Sub-themes:      [Theme], [Theme]
Projects:        [Project], [Project]  (via oversees edges)
```

Each name in the panel is clickable — clicking it selects that node.

---

## Focus Mode

Double-clicking a node enters focus mode. The graph dims everything except the focal node and its relevant neighbourhood, defined per type:

**Person focus:**
- Their direct reports and the person they report to
- Their oversees edges (themes)
- Projects they work on
- Colleagues who work on the same projects
- Everything else: dimmed to ~10% opacity

**Project focus:**
- All people with `works-on` edges to this project
- Their immediate managers (one level up reporting chain)
- Themes that oversee this project, and the people who own those themes
- Everything else: dimmed

**Theme focus:**
- The person who oversees this theme
- All projects overseen under this theme
- All people working on those projects
- Sub-themes and their overseen projects
- Everything else: dimmed

Pressing **Escape** or clicking **"Exit focus"** returns to the full graph.

---

## Layer Toggles
A small set of toggle buttons in the top-right corner:

| toggle | effect |
|---|---|
| `Org` | show/hide all `reports-to` edges |
| `Oversight` | show/hide all `oversees` edges |
| `Work` | show/hide all `works-on` edges |
| `Themes` | show/hide theme nodes (and their edges) |
| `Projects` | show/hide project nodes (and their edges) |

Hiding edges does not hide nodes. Hiding node types hides those nodes and all their connected edges.

Default state: all on.

---

## Controls UI
Minimal overlay. All controls are toggleable with a single `H` keypress to go fully immersive.

| location | contents |
|---|---|
| Top-right | layer toggles |
| Bottom-left | detail panel (appears on selection) |
| Bottom-right | Reset camera, Clear selection, Load new file |

---

## Out of Scope (v1)
The following are explicitly deferred. The implementation should not accommodate or block them — they are noted here so future versions can add them cleanly:

- 2D mode / cross-section views
- Editing nodes or edges in the visualizer
- Saving or exporting from the visualizer
- Text search and filter
- Animation or timeline
- Physics parameter controls
- Collaborative features

Layer toggles are designed to be extensible — adding new edge or node types should require only adding a new toggle entry, not restructuring the toggle system.
