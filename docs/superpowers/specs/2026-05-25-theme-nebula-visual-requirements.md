# OrgGraph — Visual Requirements

**Date:** 2026-05-25
**Related:** `2026-05-25-theme-nebula-design.md`

## The Space

The graph is set in a deep, near-black three-dimensional space. Entities float and arrange themselves naturally: things that are closely connected drift toward each other; loosely connected things spread apart. The viewer can orbit freely in three dimensions, zoom in and out, and pan across the space.

There is no fixed "up" or "down." The arrangement emerges from the connections rather than being manually positioned.

---

## Entities

### People

People appear as **spheres**. They are colored by department — everyone in the same department shares a color, drawn from a fixed palette of ten distinct hues. People who are more central to the organisation (more connections) appear slightly larger; peripheral people appear slightly smaller.

### Projects

Projects appear as **cubes**, colored grey. Projects with larger teams appear larger; projects with fewer contributors appear smaller.

### Themes

Themes appear as **glowing nebula clouds** rather than solid shapes. A theme cloud visually contains its member projects — the cloud boundary wraps around wherever those projects sit in space, and adjusts as they move.

Each cloud has a **glowing shell** appearance: transparent at the center with a luminous, colored edge. The interior is see-through, keeping the entities inside clearly visible. Clouds are amber-colored.

Where two clouds overlap — because a project belongs to multiple themes — the overlapping zone glows brighter. This makes shared membership visible at a glance.

Themes can be nested: a theme can have a parent theme. A parent cloud fully encompasses its child clouds. The nesting hierarchy is visible as clouds within clouds, each contained by the next.

Themes drift toward the **outer edge of the space**, giving the graph a galaxy-like quality: people near the core, projects in the mid-range, theme clouds as glowing regions at the periphery. Because of this outward pull, clouds naturally elongate outward rather than sitting as perfect spheres.

---

## Connections

### Reporting lines

The chain of who reports to whom is shown as thin, dark lines with an **arrowhead** pointing toward the manager. The lines are a very dark, slightly blue-tinted grey — present but unobtrusive.

### Works-on

When a person works on a project, a **semi-transparent line** connects them, colored to match the person's department. Multiple people working on the same project produce several colored lines converging on that project.

### Oversees

Oversight relationships — a person overseeing a theme or project — are shown not as a static line but as **small amber particles drifting** continuously from the overseer toward what they oversee. There is no line body; only the flowing particles indicate the connection. Where an overseer connects to a theme cloud, the particles travel from the person to the cloud surface and stop there.

---

## Labels

Entity labels appear when an entity is **hovered over** or **selected**. Labels float just above the entity and are colored to match it — department color for people, grey for projects, amber for themes.

Theme labels behave differently: each cloud displays its name at its **outermost point** — the part of the cloud facing away from the center of the graph. For nested clouds, this means each theme's label always sits in its own exclusive region, never inside a child cloud.

---

## Overseer Indication Within Theme Clouds

The person who oversees a theme is visually drawn toward the **outer rim** of their cloud, near the theme label. This makes the overseer prominent at the most visible part of the cloud. If a theme has no overseer, the label sits there unaccompanied.

---

## Selection

**Clicking** an entity selects it. A detail panel appears at the bottom-left of the screen, listing that entity's relationships — who they report to, who they oversee, what they work on, and so on. All names in the panel are clickable and select that entity in turn.

Clicking a selected entity again, or clicking empty space, deselects it and closes the panel.

Clicking on a theme cloud selects that theme.

---

## Focus Mode

**Double-clicking** an entity enters focus mode. Everything unrelated to that entity fades to near-invisible — only the entity itself and its immediate circle remain fully bright:

- **Focusing on a person:** their manager, direct reports, the themes they oversee, and the projects they work on or oversee all remain visible.
- **Focusing on a project:** the team working on it, the people overseeing it, and the associated themes stay visible.
- **Focusing on a theme:** its projects, overseers, nested child themes, and the people working on those projects all remain visible.

Connections between dimmed entities also fade. Theme clouds that are outside the focus context dim to near-invisible.

Double-clicking the same entity again, or pressing **Escape**, exits focus mode and restores full brightness.

---

## Controls Overlay

A set of controls floats over the graph and can be hidden or shown at any time by pressing **H**. Hiding the controls does not affect the graph itself — it continues to be visible and interactive.

### Layer toggles (top-right)

Five toggles let the viewer show or hide each category independently:

- **Org** — reporting lines
- **Oversight** — oversees connections (particles)
- **Work** — works-on connections
- **Themes** — theme clouds
- **Projects** — project cubes and their connections

When a category is hidden, it disappears entirely. When shown again, it reappears where it was.

### Buttons (bottom-right)

- **Reset Camera** — returns the view to the default position
- **Clear Selection** — deselects any selected entity and closes the detail panel
- **Load New File** — returns to the start screen to load a different dataset

---

## Escape Key

If focus mode is active, **Escape** exits it. If no focus mode is active, **Escape** clears the current selection.
