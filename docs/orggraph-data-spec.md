# OrgGraph 3D — Data Format Specification

This document describes the JSON format that OrgGraph 3D accepts, and walks through how to convert a prose description of an organisation into valid JSON.

---

## Runtime

A React/Vite app that builds to a single self-contained HTML file via `vite-plugin-singlefile`. Runs by opening that file directly in a browser — no server needed. The renderer is `@react-three/fiber` + `three.js`, layout is `d3-force-3d`.

---

## Top-level structure

```json
{
  "meta": { "title": "My Org", "version": "1.0" },
  "nodes": [ ... ],
  "edges": [ ... ]
}
```

`meta` is optional (omitting it triggers a warning, not an error). `nodes` and `edges` are required arrays.

---

## Node types

Every node must have `id` and `type`. `label` is optional everywhere (the app falls back to `id` when `label` is absent).

### `person`

Represents a team member.

| field | required | notes |
|---|---|---|
| `id` | yes | unique string, e.g. `"person-alice"` |
| `type` | yes | `"person"` |
| `department` | yes | freeform string; drives colour grouping |
| `label` | no | display name; defaults to `id` if absent |

```json
{ "id": "person-alice", "type": "person", "label": "Alice", "department": "Engineering" }
```

### `project`

Represents a piece of work.

| field | required | notes |
|---|---|---|
| `id` | yes | unique string, e.g. `"project-rewrite"` |
| `type` | yes | `"project"` |
| `label` | no | display name |

```json
{ "id": "project-rewrite", "type": "project", "label": "Platform Rewrite" }
```

### `theme`

Represents a strategic area or programme that organises projects.

| field | required | notes |
|---|---|---|
| `id` | yes | unique string, e.g. `"theme-platform"` |
| `type` | yes | `"theme"` |
| `parent` | yes | `null` for root themes; the `id` of a parent theme otherwise |
| `label` | no | display name |

The `parent` field must be present (even as `null`) — omitting it entirely triggers a warning.

```json
{ "id": "theme-platform", "type": "theme", "label": "Platform", "parent": null }
{ "id": "theme-infra",    "type": "theme", "label": "Infrastructure", "parent": "theme-platform" }
```

---

## Edge types

Every edge must have `source`, `target`, and `type`.

### `reports-to`

The org-chart relationship. Both endpoints must be `person` nodes.

```
source: person  →  target: person
```

```json
{ "source": "person-bob", "target": "person-alice", "type": "reports-to" }
```

Reads as: "Bob reports to Alice."

### `oversees`

A person takes responsibility for a theme or project. The source must be a `person`; the target can be a `theme` or a `project`.

```
source: person  →  target: theme | project
```

```json
{ "source": "person-alice", "target": "theme-platform", "type": "oversees" }
{ "source": "person-alice", "target": "project-rewrite", "type": "oversees" }
```

### `works-on`

A person is an active contributor to a project. Source must be `person`, target must be `project`.

```
source: person  →  target: project
```

```json
{ "source": "person-bob", "target": "project-rewrite", "type": "works-on" }
```

### `belongs-to`

A project is classified under a theme. Source must be `project`, target must be `theme`. A project can belong to more than one theme.

```
source: project  →  target: theme
```

```json
{ "source": "project-rewrite", "target": "theme-platform", "type": "belongs-to" }
```

---

## Converting prose

### Step 1 — identify entities

Read through the prose and pull out every person, project, and theme mentioned. Assign each a stable `id` (kebab-case works well: `person-alice`, `project-billing-v2`).

**Prose:**
> Alice leads the Platform team. Bob and Carol both report to Alice. Carol runs a programme called "Data Quality" which sits under Platform. Bob and Carol are both working on the Platform Rewrite project.

**Entities:**
- people: Alice, Bob, Carol
- themes: Platform, Data Quality
- projects: Platform Rewrite

### Step 2 — assign departments

Every person must have a `department`. If the prose doesn't mention departments explicitly, use whatever grouping makes sense (team name, function, etc.).

### Step 3 — wire up the reporting chain

Every `reports-to` edge goes from the subordinate to the manager.

- Bob → Alice: `{ "source": "person-bob", "target": "person-alice", "type": "reports-to" }`
- Carol → Alice: `{ "source": "person-carol", "target": "person-alice", "type": "reports-to" }`

### Step 4 — assign theme ownership

"leads" / "owns" / "is responsible for" a theme → `oversees` edge from the person to the theme.

- Alice oversees Platform: `{ "source": "person-alice", "target": "theme-platform", "type": "oversees" }`
- Carol runs Data Quality: `{ "source": "person-carol", "target": "theme-data-quality", "type": "oversees" }`

### Step 5 — nest themes

Data Quality sits under Platform: `"parent": "theme-platform"` on the Data Quality node.

### Step 6 — connect projects to themes

Platform Rewrite belongs under Platform:
`{ "source": "project-rewrite", "target": "theme-platform", "type": "belongs-to" }`

### Step 7 — add project contributions

Both Bob and Carol work on Platform Rewrite:
- `{ "source": "person-bob", "target": "project-rewrite", "type": "works-on" }`
- `{ "source": "person-carol", "target": "project-rewrite", "type": "works-on" }`

### Complete result

```json
{
  "meta": { "title": "Platform Team" },
  "nodes": [
    { "id": "person-alice", "type": "person", "label": "Alice", "department": "Platform" },
    { "id": "person-bob",   "type": "person", "label": "Bob",   "department": "Platform" },
    { "id": "person-carol", "type": "person", "label": "Carol", "department": "Platform" },
    { "id": "theme-platform",     "type": "theme", "label": "Platform",     "parent": null },
    { "id": "theme-data-quality", "type": "theme", "label": "Data Quality", "parent": "theme-platform" },
    { "id": "project-rewrite", "type": "project", "label": "Platform Rewrite" }
  ],
  "edges": [
    { "source": "person-bob",   "target": "person-alice",         "type": "reports-to" },
    { "source": "person-carol", "target": "person-alice",         "type": "reports-to" },
    { "source": "person-alice", "target": "theme-platform",       "type": "oversees"   },
    { "source": "person-carol", "target": "theme-data-quality",   "type": "oversees"   },
    { "source": "project-rewrite", "target": "theme-platform",    "type": "belongs-to" },
    { "source": "person-bob",   "target": "project-rewrite",      "type": "works-on"   },
    { "source": "person-carol", "target": "project-rewrite",      "type": "works-on"   }
  ]
}
```

---

## Validation rules

### Errors — block rendering

| rule | message pattern |
|---|---|
| Root is not an object | `Root must be an object` |
| `nodes` is not an array | `nodes must be an array` |
| `edges` is not an array | `edges must be an array` |
| Node missing `id` | `Node at index N is missing id` |
| Node missing `type` | `Node at index N (id: X) is missing type` |
| Node `type` not one of `person`, `project`, `theme` | `Node X has invalid type: Y` |
| `person` node missing `department` | `Person X is missing department` |
| Duplicate node `id` | `Duplicate node id: X` |
| Edge missing `source` | `Edge at index N is missing source` |
| Edge missing `target` | `Edge at index N is missing target` |
| Edge missing `type` | `Edge at index N is missing type` |
| Edge `type` not one of `reports-to`, `oversees`, `works-on`, `belongs-to` | `Edge N has invalid type: Y` |
| Edge `source` or `target` references a non-existent `id` | `Edge N references unknown node: X` |
| `reports-to` endpoint is not a person | `reports-to edge N: source/target X must be a person` |
| `works-on` source is not a person | `works-on edge N: source X must be a person` |
| `works-on` target is not a project | `works-on edge N: target X must be a project` |
| `belongs-to` source is not a project | `belongs-to edge N: source X must be a project` |
| `belongs-to` target is not a theme | `belongs-to edge N: target X must be a theme` |
| Circular `parent` chain among themes | `Circular parent chain detected involving theme X` |

### Warnings — allow rendering with a "Render Anyway" prompt

| rule | message pattern |
|---|---|
| No `meta` object | `No meta object found` |
| `theme` node has no `parent` field (the field must exist; `null` is fine) | `Theme X is missing parent field (use null for root themes)` |
| Person has no `reports-to` edge in either direction | `Person X has no reports-to relationships` |
| Project has no `works-on` or `oversees` edge pointing to it | `Project X has no connections` |
| Project has no `belongs-to` edge | `Project X has no belongs-to edge (not assigned to any theme)` |

---

## Visual language

### Node shapes and colours

| type | shape | colour |
|---|---|---|
| `person` | sphere | one distinct hue per `department` value (palette cycles after 10 departments) |
| `project` | cube | `#909090` (neutral grey) |
| `theme` | cube | `#e8a030` (amber) |

### Node size

- `person` — `3 + min(totalEdgeCount × 0.8, 6)` — more connections → larger
- `project` — `4 + min(worksOnCount × 1.2, 8)` — more contributors → larger
- `theme` — `max(8 − depth × 1.5, 3)` — root themes are largest; deeper themes shrink

### Edge colours

| type | colour |
|---|---|
| `reports-to` | `#7a7a99` (muted blue-grey) |
| `oversees` | `#d4922e` (amber) |
| `works-on` | source person's department colour at 85% opacity |
| `belongs-to` | `#888888` (grey) |

All edges are plain lines — no arrowheads, no dashes.

### Labels

Labels appear as a DOM overlay tooltip when hovering a node. The tooltip shows the node's `label` (or `id` if absent) plus a second line: `department` for persons, `"Project"` for projects, and the overseer's name for themes.

---

## Layer toggles

Five toggles in the top-right corner control what is shown:

| toggle key | hides |
|---|---|
| `Org` | all `reports-to` edges |
| `Oversight` | all `oversees` edges |
| `Work` | all `works-on` edges |
| `Themes` | all theme nodes and every edge that connects to one |
| `Projects` | all project nodes and every edge that connects to one |

`belongs-to` edges are hidden automatically when either `Themes` or `Projects` is toggled off (since they connect projects to themes).

---

## Focus mode

Double-clicking a node enters focus mode. Everything outside the focal neighbourhood dims to 4% opacity (effectively invisible). Click "Exit focus" or press **Escape** to return.

**Person focus** includes: the person, their direct reports, their manager, themes and projects they oversee, projects they work on, and all ancestor themes up the `parent` chain for each overseen theme.

**Project focus** includes: the project, all people who work on it, all people who oversee it, and all themes the project belongs to (via `belongs-to` edges).

**Theme focus** includes: the theme, all descendant themes (full subtree via `parent`), all people who oversee this theme, all projects that belong to this theme (via `belongs-to`), and all people who work on those projects.

---

## Keyboard shortcuts

| key | action |
|---|---|
| `H` | toggle the HUD (layer toggles, detail panel, controls) |
| `Escape` | exit focus mode if active; otherwise clear node selection |
