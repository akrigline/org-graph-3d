# belongs-to Edge Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the brittle `edge.theme` field on `oversees` edges with a first-class `belongs-to` edge type so projects explicitly declare theme membership, enabling multi-theme membership and Venn diagram cloud intersections.

**Architecture:** A `belongs-to` edge (`source: project-id → target: theme-id`) is added as a new valid edge type. Cloud membership in `GraphScene.jsx` and focus set computation in `focusSet.js` are updated to use these edges. No changes to the renderer (`NebulaMesh.jsx`) or layer system (`graphData.js`) are needed.

**Tech Stack:** React, Vite, Vitest, Three.js / React Three Fiber

---

## File Map

| File | Change |
|------|--------|
| `src/lib/validate.js` | Add `belongs-to` to valid types; add type constraint + orphan warning |
| `src/lib/validate.test.js` | New tests for `belongs-to` validation |
| `src/lib/focusSet.js` | `addThemeFocusSet` + `addProjectFocusSet` use `belongs-to` instead of `edge.theme` |
| `src/lib/focusSet.test.js` | New file — tests for focus set with `belongs-to` edges |
| `src/data/sample.json` | Remove `theme` field from oversees edges; add `belongs-to` edges |
| `src/data/big-sample.json` | Add `belongs-to` edges for all 13 projects |
| `src/components/Canvas/GraphScene.jsx` | Update cloud membership computation; exclude `belongs-to` from `structureLinks` |

---

## Task 1: Validate `belongs-to` edges

**Files:**
- Modify: `src/lib/validate.test.js`
- Modify: `src/lib/validate.js`

- [ ] **Step 1: Add failing tests to `src/lib/validate.test.js`**

Append at the end of the file:

```js
describe('belongs-to type constraint', () => {
  it('accepts a valid belongs-to edge (project → theme)', () => {
    const data = {
      ...base,
      edges: [{ source: 'proj1', target: 't1', type: 'belongs-to' }],
    };
    const { errors } = validate(data);
    expect(errors.some(e => e.includes('belongs-to'))).toBe(false);
  });

  it('errors when source of belongs-to is not a project', () => {
    const data = {
      ...base,
      edges: [{ source: 'p1', target: 't1', type: 'belongs-to' }],
    };
    const { errors } = validate(data);
    expect(errors.some(e => e.includes('belongs-to') && e.includes('p1'))).toBe(true);
  });

  it('errors when target of belongs-to is not a theme', () => {
    const data = {
      ...base,
      edges: [{ source: 'proj1', target: 'p1', type: 'belongs-to' }],
    };
    const { errors } = validate(data);
    expect(errors.some(e => e.includes('belongs-to') && e.includes('p1'))).toBe(true);
  });
});

describe('belongs-to orphan warning', () => {
  it('warns when a project has no belongs-to edge', () => {
    const data = { ...base, edges: [] };
    const { warnings } = validate(data);
    expect(warnings.some(w => w.includes('proj1') && w.includes('belongs-to'))).toBe(true);
  });

  it('does not warn when project has a belongs-to edge', () => {
    const data = {
      ...base,
      edges: [{ source: 'proj1', target: 't1', type: 'belongs-to' }],
    };
    const { warnings } = validate(data);
    expect(warnings.some(w => w.includes('proj1') && w.includes('belongs-to'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A2 'belongs-to'
```

Expected: failures like `Invalid edge type: belongs-to` and assertion errors.

- [ ] **Step 3: Update `src/lib/validate.js`**

Change line 2 from:
```js
const VALID_EDGE_TYPES = ['reports-to', 'oversees', 'works-on'];
```
to:
```js
const VALID_EDGE_TYPES = ['reports-to', 'oversees', 'works-on', 'belongs-to'];
```

After the `works-on` constraint block (after line 133), add:

```js
    // Error 16: belongs-to — source must be project, target must be theme
    if (edge.type === 'belongs-to' && edge.source && edge.target) {
      const srcNode = nodes.find(n => n.id === edge.source);
      const tgtNode = nodes.find(n => n.id === edge.target);
      if (srcNode && srcNode.type !== 'project') {
        errors.push(`belongs-to edge ${i}: source ${edge.source} must be a project`);
      }
      if (tgtNode && tgtNode.type !== 'theme') {
        errors.push(`belongs-to edge ${i}: target ${edge.target} must be a theme`);
      }
    }
```

After Warning 4 (after line 193, before `return`), add:

```js
  // Warning 5: project with no belongs-to edge (not assigned to any theme)
  const belongsToEdges = edges.filter(e => e.type === 'belongs-to');
  for (const project of projectNodes) {
    const hasBelongsTo = belongsToEdges.some(e => e.source === project.id);
    if (!hasBelongsTo) {
      warnings.push(`Project ${project.id} has no belongs-to edge (not assigned to any theme)`);
    }
  }
```

- [ ] **Step 4: Run tests, confirm they pass**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E '(PASS|FAIL|belongs-to)'
```

Expected: all `belongs-to` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validate.js src/lib/validate.test.js
git commit -m "feat: add belongs-to edge type validation"
```

---

## Task 2: Update `sample.json`

**Files:**
- Modify: `src/data/sample.json`

The current data has `oversees` edges with a `theme` field encoding project-theme membership. These need to be replaced with explicit `belongs-to` edges.

Current oversees edges with `theme` field (to be stripped of the `theme` property):
```json
{ "source": "person-declan", "target": "project-1", "type": "oversees", "theme": "theme-apples" }
{ "source": "person-alex",   "target": "project-2", "type": "oversees", "theme": "theme-apples" }
{ "source": "person-brendan","target": "project-2", "type": "oversees", "theme": "theme-bananas" }
{ "source": "person-niall",  "target": "project-1", "type": "oversees", "theme": "theme-copper" }
```

Derived memberships (project-1 belongs to apples + copper; project-2 belongs to apples + bananas).

- [ ] **Step 1: Replace the four `oversees+theme` edges in `src/data/sample.json`**

Find and replace this block in the edges array:
```json
    { "source": "person-declan", "target": "project-1", "type": "oversees", "theme": "theme-apples"  },
    { "source": "person-alex",    "target": "project-2", "type": "oversees", "theme": "theme-apples"  },
    { "source": "person-brendan", "target": "project-2", "type": "oversees", "theme": "theme-bananas" },
    { "source": "person-niall",   "target": "project-1", "type": "oversees", "theme": "theme-copper"  },
```

With (stripped of `theme` field, plus new `belongs-to` edges appended after):
```json
    { "source": "person-declan",  "target": "project-1", "type": "oversees" },
    { "source": "person-alex",    "target": "project-2", "type": "oversees" },
    { "source": "person-brendan", "target": "project-2", "type": "oversees" },
    { "source": "person-niall",   "target": "project-1", "type": "oversees" },
    { "source": "project-1", "target": "theme-apples",  "type": "belongs-to" },
    { "source": "project-1", "target": "theme-copper",  "type": "belongs-to" },
    { "source": "project-2", "target": "theme-apples",  "type": "belongs-to" },
    { "source": "project-2", "target": "theme-bananas", "type": "belongs-to" },
```

- [ ] **Step 2: Run tests to confirm no regressions**

```bash
npm test 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/data/sample.json
git commit -m "data: migrate sample.json to belongs-to edges"
```

---

## Task 3: Update `big-sample.json`

**Files:**
- Modify: `src/data/big-sample.json`

The 13 projects need `belongs-to` edges. Some projects are assigned to two themes to demonstrate Venn diagram intersections.

- [ ] **Step 1: Add `belongs-to` edges to `src/data/big-sample.json`**

Locate the `"edges"` array and append these entries before the closing `]`:

```json
    { "source": "project-aurora",   "target": "theme-012", "type": "belongs-to" },
    { "source": "project-beacon",   "target": "theme-019", "type": "belongs-to" },
    { "source": "project-catalyst", "target": "theme-012", "type": "belongs-to" },
    { "source": "project-catalyst", "target": "theme-019", "type": "belongs-to" },
    { "source": "project-ember",    "target": "theme-030", "type": "belongs-to" },
    { "source": "project-delta",    "target": "theme-030", "type": "belongs-to" },
    { "source": "project-delta",    "target": "theme-042", "type": "belongs-to" },
    { "source": "project-frontier", "target": "theme-046", "type": "belongs-to" },
    { "source": "project-granite",  "target": "theme-050", "type": "belongs-to" },
    { "source": "project-ignite",   "target": "theme-046", "type": "belongs-to" },
    { "source": "project-ignite",   "target": "theme-050", "type": "belongs-to" },
    { "source": "project-harbor",   "target": "theme-042", "type": "belongs-to" },
    { "source": "project-junction", "target": "theme-054", "type": "belongs-to" },
    { "source": "project-keystone", "target": "theme-054", "type": "belongs-to" },
    { "source": "project-keystone", "target": "theme-056", "type": "belongs-to" },
    { "source": "project-lumen",    "target": "theme-056", "type": "belongs-to" },
    { "source": "project-meridian", "target": "theme-019", "type": "belongs-to" },
    { "source": "project-meridian", "target": "theme-051", "type": "belongs-to" }
```

- [ ] **Step 2: Run tests to confirm no regressions**

```bash
npm test 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/data/big-sample.json
git commit -m "data: add belongs-to edges to big-sample.json"
```

---

## Task 4: Update `focusSet.js`

**Files:**
- Create: `src/lib/focusSet.test.js`
- Modify: `src/lib/focusSet.js`

Two functions need updating:
- `addThemeFocusSet`: find projects via `belongs-to` edges targeting the theme (was: `edge.theme === theme.id`)
- `addProjectFocusSet`: find themes via `belongs-to` edges sourced from the project (was: `edge.theme` field on oversees edges)

- [ ] **Step 1: Create `src/lib/focusSet.test.js` with failing tests**

```js
import { describe, it, expect } from 'vitest';
import { getFocusSet } from './focusSet.js';

const rawData = {
  nodes: [
    { id: 'p1', type: 'person', label: 'Alice', department: 'Eng' },
    { id: 'p2', type: 'person', label: 'Bob',   department: 'Eng' },
    { id: 'proj1', type: 'project', label: 'Project 1' },
    { id: 'proj2', type: 'project', label: 'Project 2' },
    { id: 't1', type: 'theme', label: 'Theme 1', parent: null },
    { id: 't2', type: 'theme', label: 'Theme 2', parent: null },
  ],
  edges: [
    { source: 'p1', target: 'proj1', type: 'works-on' },
    { source: 'p2', target: 'proj2', type: 'works-on' },
    { source: 'proj1', target: 't1', type: 'belongs-to' },
    { source: 'proj2', target: 't2', type: 'belongs-to' },
    { source: 'proj1', target: 't2', type: 'belongs-to' },
    { source: 'p1', target: 't1', type: 'oversees' },
  ],
};

describe('getFocusSet — theme focus', () => {
  it('includes the theme itself', () => {
    const set = getFocusSet({ id: 't1', type: 'theme' }, rawData);
    expect(set.has('t1')).toBe(true);
  });

  it('includes projects that belong-to the theme', () => {
    const set = getFocusSet({ id: 't1', type: 'theme' }, rawData);
    expect(set.has('proj1')).toBe(true);
  });

  it('excludes projects that do not belong-to the theme', () => {
    const set = getFocusSet({ id: 't1', type: 'theme' }, rawData);
    expect(set.has('proj2')).toBe(false);
  });

  it('includes people who work-on a project belonging to the theme', () => {
    const set = getFocusSet({ id: 't1', type: 'theme' }, rawData);
    expect(set.has('p1')).toBe(true);
  });

  it('includes projects from multiple belongs-to edges targeting the same theme', () => {
    const set = getFocusSet({ id: 't2', type: 'theme' }, rawData);
    expect(set.has('proj1')).toBe(true);
    expect(set.has('proj2')).toBe(true);
  });
});

describe('getFocusSet — project focus', () => {
  it('includes themes the project belongs to', () => {
    const set = getFocusSet({ id: 'proj1', type: 'project' }, rawData);
    expect(set.has('t1')).toBe(true);
    expect(set.has('t2')).toBe(true);
  });

  it('does not include themes the project does not belong to via belongs-to edge', () => {
    const set = getFocusSet({ id: 'proj2', type: 'project' }, rawData);
    expect(set.has('t1')).toBe(false);
    expect(set.has('t2')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E '(PASS|FAIL|focusSet)'
```

Expected: failures — the old `edge.theme` logic doesn't match `belongs-to` edges.

- [ ] **Step 3: Update `addThemeFocusSet` in `src/lib/focusSet.js`**

Replace the block starting at `// All projects that any person oversees under this theme` (lines 183–196):

```js
  // All projects that belong to this theme via belongs-to edges
  for (const edge of allEdges) {
    if (edge.type === 'belongs-to' && edge.target === theme.id) {
      result.add(edge.source); // project

      // All people who work-on that project
      const projectWorkOnEdges = edgesByTarget.get(edge.source) || [];
      for (const workEdge of projectWorkOnEdges) {
        if (workEdge.type === 'works-on') {
          result.add(workEdge.source);
        }
      }
    }
  }
```

- [ ] **Step 4: Update `addProjectFocusSet` in `src/lib/focusSet.js`**

Replace the block starting at `// Any themes that oversees edges from people point to` (lines 147–152):

```js
  // All themes this project belongs to via belongs-to edges
  const allEdgesFromProject = edgesBySource.get(project.id) || [];
  for (const edge of allEdgesFromProject) {
    if (edge.type === 'belongs-to') {
      result.add(edge.target); // theme
    }
  }
```

- [ ] **Step 5: Run tests, confirm they pass**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E '(PASS|FAIL|focusSet)'
```

Expected: all focusSet tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/focusSet.js src/lib/focusSet.test.js
git commit -m "feat: focusSet uses belongs-to edges for theme/project membership"
```

---

## Task 5: Update `GraphScene.jsx` cloud membership

**Files:**
- Modify: `src/components/Canvas/GraphScene.jsx`

Two changes:
1. Cloud membership uses `belongs-to` edges instead of `edge.theme` on oversees edges
2. `belongs-to` edges excluded from `structureLinks` so they don't render as lines

- [ ] **Step 1: Replace the membership computation block (lines 51–61)**

Replace:
```js
      const memberEdges = rawData.edges.filter(
          e => e.type === 'oversees' && e.theme && e.theme === themeNode.id
        );
        const projectIds = new Set(memberEdges.map(e => e.target));
        // Include people who work on or oversee those projects
        const memberIds = new Set(projectIds);
        rawData.edges.forEach(e => {
          if ((e.type === 'works-on' || e.type === 'oversees') && projectIds.has(e.target)) {
            memberIds.add(e.source);
          }
        });
```

With:
```js
        const projectIds = new Set(
          rawData.edges
            .filter(e => e.type === 'belongs-to' && e.target === themeNode.id)
            .map(e => e.source)
        );
        // Include people who work on or oversee those projects
        const memberIds = new Set(projectIds);
        rawData.edges.forEach(e => {
          if ((e.type === 'works-on' || e.type === 'oversees') && projectIds.has(e.target)) {
            memberIds.add(e.source);
          }
        });
```

- [ ] **Step 2: Exclude `belongs-to` from `structureLinks` (line 37)**

Replace:
```js
  const structureLinks = graphData.links.filter(l => l.type !== 'oversees');
```

With:
```js
  const structureLinks = graphData.links.filter(
    l => l.type !== 'oversees' && l.type !== 'belongs-to'
  );
```

- [ ] **Step 3: Run all tests**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/Canvas/GraphScene.jsx
git commit -m "feat: cloud membership uses belongs-to edges"
```
