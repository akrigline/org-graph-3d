# Cylinder Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the force-directed layout with a deterministic cylinder layout where division = angle, project involvement = radius, and project Y positions are physics-driven with shared-people attraction.

**Architecture:** Three-coordinate system (θ = division sector, r = project involvement, Y = derived from project physics). A 1D D3 simulation runs only on project nodes; person positions are computed each frame from sector assignment and current project Y values. The `simNodesRef` interface is preserved so NodeMesh, NebulaMesh, ParticleSystem, and GraphScene need no changes.

**Tech Stack:** d3-force-3d 3 (1D sim for projects), React Three Fiber `useFrame`, existing Zustand store + Vitest.

---

## File Map

| File | Change |
|------|--------|
| `src/lib/graphData.js` | Add `buildSectorMap`, `buildWorksOnMap`, `buildProjectPairEdges` exports |
| `src/lib/graphData.test.js` | Add tests for the three new functions |
| `src/hooks/useForceLayout.js` | Full rewrite: 1D project sim + per-frame person position computation |
| `src/components/Canvas/LinkLines.jsx` | Update opacity constants and per-type factor logic |
| `src/store/useGraphStore.js` | Replace physics layout params with cylinder params |
| `src/components/LayoutSettings.jsx` | Update sliders to match new layout params |

**Not changing:** `NodeMesh.jsx`, `GraphScene.jsx`, `NebulaMesh.jsx`, `ParticleSystem.jsx`, `HoverTooltip.jsx`, `DetailPanel.jsx`, `LayerToggles.jsx`, `BottomControls.jsx`, data JSON files.

---

## Task 1: Add data utilities to graphData.js

**Files:**
- Modify: `src/lib/graphData.js`
- Modify: `src/lib/graphData.test.js`

### `buildSectorMap(nodes, edges)` — groups persons by division, assigns sector angle, sorts by BFS depth

- [ ] **Step 1.1: Write failing tests**

Append to `src/lib/graphData.test.js`:

```js
import { buildSectorMap, buildWorksOnMap, buildProjectPairEdges } from './graphData.js';

describe('buildSectorMap', () => {
  it('groups persons by division prefix before " - "', () => {
    const nodes = [
      { id: 'p1', type: 'person', department: 'Div A - Lead' },
      { id: 'p2', type: 'person', department: 'Div A - IC' },
      { id: 'p3', type: 'person', department: 'Div B - IC' },
    ];
    const map = buildSectorMap(nodes, []);
    expect(map.size).toBe(2);
    expect(map.has('Div A')).toBe(true);
    expect(map.get('Div A').people).toHaveLength(2);
  });

  it('assigns distinct angles for each division', () => {
    const nodes = [
      { id: 'p1', type: 'person', department: 'Div A - IC' },
      { id: 'p2', type: 'person', department: 'Div B - IC' },
    ];
    const map = buildSectorMap(nodes, []);
    const angles = [...map.values()].map(v => v.angle);
    expect(angles[0]).not.toBeCloseTo(angles[1]);
  });

  it('sorts people within sector by BFS depth, root (depth 0) first', () => {
    const nodes = [
      { id: 'ic1',  type: 'person', department: 'Div A - IC' },
      { id: 'mgr',  type: 'person', department: 'Div A - Manager' },
    ];
    const edges = [{ source: 'ic1', target: 'mgr', type: 'reports-to' }];
    const map = buildSectorMap(nodes, edges);
    const people = map.get('Div A').people;
    expect(people[0].id).toBe('mgr');  // depth 0 (no manager above)
    expect(people[1].id).toBe('ic1');  // depth 1
  });

  it('uses full department string when no " - " separator', () => {
    const nodes = [{ id: 'p1', type: 'person', department: 'Engineering' }];
    const map = buildSectorMap(nodes, []);
    expect(map.has('Engineering')).toBe(true);
  });

  it('ignores non-person nodes', () => {
    const nodes = [
      { id: 'p1',    type: 'person',  department: 'Div A - IC' },
      { id: 'proj1', type: 'project', label: 'P1' },
    ];
    const map = buildSectorMap(nodes, []);
    expect(map.size).toBe(1);
  });
});

describe('buildWorksOnMap', () => {
  it('maps person id to Set of project ids', () => {
    const edges = [
      { source: 'p1', target: 'proj1', type: 'works-on' },
      { source: 'p1', target: 'proj2', type: 'works-on' },
      { source: 'p2', target: 'proj1', type: 'works-on' },
    ];
    const map = buildWorksOnMap(edges);
    expect(map.get('p1')).toEqual(new Set(['proj1', 'proj2']));
    expect(map.get('p2')).toEqual(new Set(['proj1']));
  });

  it('returns empty map when no works-on edges exist', () => {
    const edges = [{ source: 'p1', target: 'mgr', type: 'reports-to' }];
    expect(buildWorksOnMap(edges).size).toBe(0);
  });

  it('does not include persons with no works-on edges', () => {
    const edges = [{ source: 'p1', target: 'proj1', type: 'works-on' }];
    expect(buildWorksOnMap(edges).has('p2')).toBe(false);
  });
});

describe('buildProjectPairEdges', () => {
  it('creates an edge between two projects that share a person', () => {
    const edges = [
      { source: 'p1', target: 'proj1', type: 'works-on' },
      { source: 'p1', target: 'proj2', type: 'works-on' },
    ];
    const pairs = buildProjectPairEdges(edges);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].sharedCount).toBe(1);
  });

  it('creates no edge between projects with no shared people', () => {
    const edges = [
      { source: 'p1', target: 'proj1', type: 'works-on' },
      { source: 'p2', target: 'proj2', type: 'works-on' },
    ];
    expect(buildProjectPairEdges(edges)).toHaveLength(0);
  });

  it('counts multiple shared people correctly', () => {
    const edges = [
      { source: 'p1', target: 'proj1', type: 'works-on' },
      { source: 'p1', target: 'proj2', type: 'works-on' },
      { source: 'p2', target: 'proj1', type: 'works-on' },
      { source: 'p2', target: 'proj2', type: 'works-on' },
    ];
    const pairs = buildProjectPairEdges(edges);
    expect(pairs[0].sharedCount).toBe(2);
  });
});
```

- [ ] **Step 1.2: Run tests to confirm they fail**

```bash
cd /mnt/d/sites/org-graph-3d && npx vitest run src/lib/graphData.test.js
```

Expected: failures like `buildSectorMap is not a function`.

- [ ] **Step 1.3: Implement the three functions in graphData.js**

Add at the top of `src/lib/graphData.js` (before `buildGraphData`):

```js
function parseDivision(department) {
  if (!department) return 'Unknown';
  const idx = department.indexOf(' - ');
  return idx >= 0 ? department.slice(0, idx) : department;
}

export function buildSectorMap(nodes, edges) {
  const personNodes = nodes.filter(n => n.type === 'person');

  // Group by division
  const divGroups = new Map();
  for (const node of personNodes) {
    const div = parseDivision(node.department);
    if (!divGroups.has(div)) divGroups.set(div, []);
    divGroups.get(div).push(node);
  }

  // Build parent map for BFS depth (source reports-to target → source's parent is target)
  const parentMap = new Map();
  for (const edge of edges) {
    if (edge.type !== 'reports-to') continue;
    const src = typeof edge.source === 'object' ? edge.source.id : edge.source;
    const tgt = typeof edge.target === 'object' ? edge.target.id : edge.target;
    parentMap.set(src, tgt);
  }

  // Compute BFS depth per person (memoised recursion)
  const depthCache = new Map();
  function depth(id) {
    if (depthCache.has(id)) return depthCache.get(id);
    const parentId = parentMap.get(id);
    const d = parentId ? 1 + depth(parentId) : 0;
    depthCache.set(id, d);
    return d;
  }
  for (const n of personNodes) depth(n.id);

  // Assign evenly-spaced angles, sorted divisions for stability
  const divisions = [...divGroups.keys()].sort();
  const sectorMap = new Map();
  divisions.forEach((div, idx) => {
    const angle = (idx / divisions.length) * Math.PI * 2;
    const people = divGroups.get(div)
      .slice()
      .sort((a, b) => depth(a.id) - depth(b.id) || a.id.localeCompare(b.id));
    sectorMap.set(div, { angle, people });
  });

  return sectorMap;
}

export function buildWorksOnMap(edges) {
  const map = new Map();
  for (const edge of edges) {
    if (edge.type !== 'works-on') continue;
    const src = typeof edge.source === 'object' ? edge.source.id : edge.source;
    const tgt = typeof edge.target === 'object' ? edge.target.id : edge.target;
    if (!map.has(src)) map.set(src, new Set());
    map.get(src).add(tgt);
  }
  return map;
}

export function buildProjectPairEdges(edges) {
  // Build project → Set<personId>
  const projPeople = new Map();
  for (const edge of edges) {
    if (edge.type !== 'works-on') continue;
    const src = typeof edge.source === 'object' ? edge.source.id : edge.source;
    const tgt = typeof edge.target === 'object' ? edge.target.id : edge.target;
    if (!projPeople.has(tgt)) projPeople.set(tgt, new Set());
    projPeople.get(tgt).add(src);
  }

  const projectIds = [...projPeople.keys()];
  const pairs = [];
  for (let i = 0; i < projectIds.length; i++) {
    for (let j = i + 1; j < projectIds.length; j++) {
      const a = projPeople.get(projectIds[i]);
      const b = projPeople.get(projectIds[j]);
      let shared = 0;
      for (const id of a) { if (b.has(id)) shared++; }
      if (shared > 0) pairs.push({ source: projectIds[i], target: projectIds[j], sharedCount: shared });
    }
  }
  return pairs;
}
```

- [ ] **Step 1.4: Run all tests**

```bash
cd /mnt/d/sites/org-graph-3d && npx vitest run src/lib/graphData.test.js
```

Expected: all tests pass (the 3 original + the 11 new ones).

- [ ] **Step 1.5: Commit**

```bash
cd /mnt/d/sites/org-graph-3d && git add src/lib/graphData.js src/lib/graphData.test.js
git commit -m "feat: add buildSectorMap, buildWorksOnMap, buildProjectPairEdges"
```

---

## Task 2: Rewrite useForceLayout.js (cylinder layout)

**Files:**
- Modify: `src/hooks/useForceLayout.js`

The new hook maintains the same signature `useForceLayout(graphData, layoutParams) → simNodesRef` so callers don't change. Internally it replaces the 3D force simulation with: (a) a 1D D3 sim for project Y positions, (b) deterministic per-frame position computation for persons.

- [ ] **Step 2.1: Replace useForceLayout.js entirely**

```js
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { forceSimulation, forceLink, forceManyBody, forceCenter } from 'd3-force-3d';
import { buildSectorMap, buildWorksOnMap, buildProjectPairEdges } from '../lib/graphData.js';

const LERP = 0.06; // position smoothing per frame

export function useForceLayout(graphData, layoutParams) {
  const simNodesRef  = useRef([]);
  const projectSimRef = useRef(null);
  const layoutRef    = useRef(null); // { personLayout, projectNodes, projectNodeMap, worksOnMap }

  // Rebuild when graph topology changes
  useEffect(() => {
    if (!graphData.nodes.length) return;

    const { cylinderR, outerR, projectSpread } = layoutParams;
    const { nodes, links } = graphData;

    // --- Sector + works-on maps ---
    const sectorMap  = buildSectorMap(nodes, links);
    const worksOnMap = buildWorksOnMap(links);

    // --- Person angle+radius layout ---
    const sectorCount = sectorMap.size || 1;
    const personLayout = new Map(); // personId → { theta, r }
    for (const [, { angle, people }] of sectorMap) {
      const count    = people.length;
      const arcWidth = (Math.PI * 2 / sectorCount) * 0.82;
      people.forEach((person, i) => {
        const offset = count > 1 ? (i / (count - 1) - 0.5) * arcWidth : 0;
        personLayout.set(person.id, {
          theta: angle + offset,
          r: worksOnMap.has(person.id) ? cylinderR : outerR,
        });
      });
    }

    // --- Project 1D simulation ---
    const projectNodes = nodes
      .filter(n => n.type === 'project')
      .map((n, i, arr) => ({
        ...n,
        // Initial Y positions spread evenly so the sim starts from a non-collapsed state
        x: arr.length > 1 ? (i / (arr.length - 1) - 0.5) * projectSpread : 0,
      }));

    const projectNodeMap = new Map(projectNodes.map(n => [n.id, n]));

    const pairEdges = buildProjectPairEdges(links);
    const maxShared = pairEdges.reduce((m, e) => Math.max(m, e.sharedCount), 1);

    // forceLink needs source/target as references into projectNodes
    const simLinks = pairEdges
      .map(e => ({
        source: projectNodeMap.get(e.source),
        target: projectNodeMap.get(e.target),
        strength: e.sharedCount / maxShared,
      }))
      .filter(e => e.source && e.target);

    const sim = forceSimulation(projectNodes, 1) // 1D: only uses .x
      .force('link',
        forceLink(simLinks)
          .distance(20)
          .strength(d => d.strength)
      )
      .force('charge', forceManyBody().strength(-120))
      .force('center', forceCenter(0))
      .alphaDecay(0.015)
      .stop();

    for (let i = 0; i < 200; i++) sim.tick(); // pre-warm

    // Initialise simNodesRef — all graph nodes with starting positions
    simNodesRef.current = nodes.map(n => ({ ...n, x: 0, y: 0, z: 0 }));

    layoutRef.current = { personLayout, projectNodes, projectNodeMap, worksOnMap };
    projectSimRef.current = sim;

    return () => { sim.stop(); projectSimRef.current = null; };
  }, [graphData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hot-update radii when layout params change (no full rebuild)
  useEffect(() => {
    const layout = layoutRef.current;
    if (!layout) return;
    const { cylinderR, outerR } = layoutParams;
    const { personLayout, worksOnMap } = layout;
    for (const [id, entry] of personLayout) {
      entry.r = worksOnMap.has(id) ? cylinderR : outerR;
    }
    if (projectSimRef.current) projectSimRef.current.alpha(0.3);
  }, [layoutParams]);

  useFrame(() => {
    const sim    = projectSimRef.current;
    const layout = layoutRef.current;
    if (!sim || !layout || !simNodesRef.current.length) return;

    const { personLayout, projectNodes, projectNodeMap, worksOnMap } = layout;

    if (sim.alpha() > sim.alphaMin()) sim.tick();

    // Project Y values from 1D sim (.x is the one coordinate d3-force-3d uses in 1D mode)
    const projectYMap = new Map(projectNodes.map(n => [n.id, n.x]));

    const simNodes = simNodesRef.current;
    for (let i = 0; i < simNodes.length; i++) {
      const node = simNodes[i];

      if (node.type === 'project') {
        const simNode = projectNodeMap.get(node.id);
        if (!simNode) continue;
        node.x += (0        - node.x) * LERP;
        node.y += (simNode.x - node.y) * LERP; // 1D .x → 3D Y
        node.z += (0        - node.z) * LERP;

      } else if (node.type === 'person') {
        const pl = personLayout.get(node.id);
        if (!pl) continue;

        let targetY = 0;
        const projects = worksOnMap.get(node.id);
        if (projects && projects.size > 0) {
          let sum = 0;
          for (const pid of projects) sum += (projectYMap.get(pid) ?? 0);
          targetY = sum / projects.size;
        }

        node.x += (pl.r * Math.cos(pl.theta) - node.x) * LERP;
        node.y += (targetY                    - node.y) * LERP;
        node.z += (pl.r * Math.sin(pl.theta)  - node.z) * LERP;

      }
      // theme nodes: stay at 0,0,0 (NebulaMesh reads member positions, not theme node position)
    }
  });

  return simNodesRef;
}
```

- [ ] **Step 2.2: Run the existing test suite to confirm nothing is broken**

```bash
cd /mnt/d/sites/org-graph-3d && npm test
```

Expected: all tests pass (useForceLayout has no unit tests; graphData and store tests should still be green).

- [ ] **Step 2.3: Commit**

```bash
cd /mnt/d/sites/org-graph-3d && git add src/hooks/useForceLayout.js
git commit -m "feat: cylinder layout — 1D project Y sim, deterministic person positions"
```

---

## Task 3: Update LinkLines opacity tiers

**Files:**
- Modify: `src/components/Canvas/LinkLines.jsx`

The current code uses a single `DIM/FOCUS/FADE` factor for all edge types. Replace with per-type constants matching the spec: default faint (0.10/0.12), hover prominent (0.40/0.45), focus strong (0.85).

- [ ] **Step 3.1: Replace the top constants and the useFrame color logic**

Replace the entire content of `src/components/Canvas/LinkLines.jsx` with:

```jsx
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getLinkColor } from '../../lib/colors.js';
import { useGraphStore } from '../../store/useGraphStore.js';

// Opacity tiers expressed as RGB scale factors (vertex-color approach, no alpha channel)
const FACTOR = {
  default:  { 'reports-to': 0.10, 'works-on': 0.12, other: 0.11 },
  hover:    { 'reports-to': 0.40, 'works-on': 0.45, other: 0.40 },
  focus:    { 'reports-to': 0.85, 'works-on': 0.85, other: 0.85 },
  inactive: 0.03, // unconnected while something else is active
};

function factorFor(type, tier) {
  return FACTOR[tier][type] ?? FACTOR[tier].other;
}

export function LinkLines({ links, simNodesRef, graphNodes, rawData }) {
  const linesRef      = useRef();
  const colorsAttrRef = useRef();

  const linkMeta = useMemo(() => links.map(link => {
    const srcId = link.source?.id ?? link.source;
    const tgtId = link.target?.id ?? link.target;
    return {
      srcIdx: graphNodes.findIndex(n => n.id === srcId),
      tgtIdx: graphNodes.findIndex(n => n.id === tgtId),
      srcId,
      tgtId,
      type: link.type,
      color: getLinkColor(link, rawData),
    };
  }), [links, graphNodes, rawData]);

  const positions = useMemo(() => new Float32Array(links.length * 6), [links.length]);

  const baseColors = useMemo(() => {
    const arr = new Float32Array(links.length * 6);
    linkMeta.forEach(({ color }, i) => {
      const c = new THREE.Color(color);
      for (let v = 0; v < 2; v++) {
        arr[(i * 2 + v) * 3]     = c.r;
        arr[(i * 2 + v) * 3 + 1] = c.g;
        arr[(i * 2 + v) * 3 + 2] = c.b;
      }
    });
    return arr;
  }, [linkMeta]);

  const displayColors = useMemo(() => new Float32Array(baseColors), [baseColors]);

  useFrame(() => {
    const simNodes = simNodesRef.current;
    if (!linesRef.current || !simNodes.length) return;

    // Update positions
    linkMeta.forEach(({ srcIdx, tgtIdx }, i) => {
      const src = simNodes[srcIdx];
      const tgt = simNodes[tgtIdx];
      if (!src || !tgt) return;
      positions[i * 6]     = src.x ?? 0;
      positions[i * 6 + 1] = src.y ?? 0;
      positions[i * 6 + 2] = src.z ?? 0;
      positions[i * 6 + 3] = tgt.x ?? 0;
      positions[i * 6 + 4] = tgt.y ?? 0;
      positions[i * 6 + 5] = tgt.z ?? 0;
    });
    linesRef.current.geometry.attributes.position.needsUpdate = true;

    // Update colors per opacity tier
    const { hoveredNodeId, focusNodeId, focusSet } = useGraphStore.getState();

    linkMeta.forEach(({ srcId, tgtId, type }, i) => {
      let factor;

      if (hoveredNodeId) {
        const connected = srcId === hoveredNodeId || tgtId === hoveredNodeId;
        factor = connected ? factorFor(type, 'hover') : FACTOR.inactive;
      } else if (focusNodeId) {
        const direct = srcId === focusNodeId || tgtId === focusNodeId;
        const chain  = type === 'reports-to' && focusSet.has(srcId) && focusSet.has(tgtId);
        factor = (direct || chain) ? factorFor(type, 'focus') : FACTOR.inactive;
      } else {
        factor = factorFor(type, 'default');
      }

      for (let v = 0; v < 2; v++) {
        const b = (i * 2 + v) * 3;
        displayColors[b]     = baseColors[b]     * factor;
        displayColors[b + 1] = baseColors[b + 1] * factor;
        displayColors[b + 2] = baseColors[b + 2] * factor;
      }
    });

    if (colorsAttrRef.current) colorsAttrRef.current.needsUpdate = true;
  });

  if (links.length === 0) return null;

  return (
    <lineSegments ref={linesRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute ref={colorsAttrRef} attach="attributes-color" args={[displayColors, 3]} />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent opacity={1} />
    </lineSegments>
  );
}
```

- [ ] **Step 3.2: Run the test suite**

```bash
cd /mnt/d/sites/org-graph-3d && npx vitest run
```

Expected: all tests pass.

- [ ] **Step 3.3: Commit**

```bash
cd /mnt/d/sites/org-graph-3d && git add src/components/Canvas/LinkLines.jsx
git commit -m "feat: link opacity tiers — faint default, stepped hover/focus per edge type"
```

---

## Task 4: Update store layout params and LayoutSettings panel

**Files:**
- Modify: `src/store/useGraphStore.js`
- Modify: `src/components/LayoutSettings.jsx`

Replace the five force-physics params with three cylinder layout params.

- [ ] **Step 4.1: Update DEFAULT_LAYOUT_PARAMS in useGraphStore.js**

In `src/store/useGraphStore.js`, replace:

```js
export const DEFAULT_LAYOUT_PARAMS = {
  personCharge:   -120,
  projectCharge:  -500,
  projectRadius:   280,
  worksOnBase:      30,
  worksOnScale:     25,
};
```

with:

```js
export const DEFAULT_LAYOUT_PARAMS = {
  cylinderR:     120,
  outerR:        240,
  projectSpread: 200,
};
```

- [ ] **Step 4.2: Update PARAMS array and button label in LayoutSettings.jsx**

In `src/components/LayoutSettings.jsx`, replace:

```js
const PARAMS = [
  { key: 'personCharge',  label: 'Person repulsion',       min: -400,  max: -10,  step: 10 },
  { key: 'projectCharge', label: 'Project repulsion',      min: -2000, max: -100, step: 50 },
  { key: 'projectRadius', label: 'Project orbit radius',   min: 100,   max: 600,  step: 10 },
  { key: 'worksOnBase',   label: 'Link base distance',     min: 10,    max: 150,  step: 5  },
  { key: 'worksOnScale',  label: 'Link distance / project',min: 5,     max: 80,   step: 5  },
];
```

with:

```js
const PARAMS = [
  { key: 'cylinderR',     label: 'Cylinder radius',      min: 40,  max: 400, step: 10 },
  { key: 'outerR',        label: 'Outer rim radius',     min: 80,  max: 700, step: 10 },
  { key: 'projectSpread', label: 'Project Y spread',     min: 50,  max: 600, step: 10 },
];
```

Also in `LayoutSettings.jsx`, replace the button label `⚙ Physics` with `⚙ Layout`:

```jsx
<button
  onClick={() => setOpen(o => !o)}
  className={`${btnClass} ${open ? 'bg-[rgba(59,130,246,0.15)] border-[rgba(96,165,250,0.5)]' : ''}`}
>
  ⚙ Layout
</button>
```

And update the panel heading from `Physics` to `Layout`:

```jsx
<span className="text-[rgba(200,220,240,0.9)] text-[12px] font-semibold tracking-wide uppercase">Layout</span>
```

- [ ] **Step 4.3: Run the store tests to confirm nothing broke**

```bash
cd /mnt/d/sites/org-graph-3d && npx vitest run src/store/useGraphStore.test.js
```

Expected: all 4 store tests pass. (They don't test specific param keys, only store shape.)

- [ ] **Step 4.4: Commit**

```bash
cd /mnt/d/sites/org-graph-3d && git add src/store/useGraphStore.js src/components/LayoutSettings.jsx
git commit -m "feat: replace physics params with cylinder layout params in store and panel"
```

---

## Task 5: Smoke test in browser

**Files:** none — observation only.

- [ ] **Step 5.1: Start the dev server**

```bash
cd /mnt/d/sites/org-graph-3d && npm run dev
```

Open the URL (typically `http://localhost:5173`).

- [ ] **Step 5.2: Load sample.json and verify cylinder shape**

Load `sample.json` (the small dataset). Verify:
- Nodes appear in roughly circular arrangement (not collapsed to center)
- Top-down view: distinct division sectors visible
- Side view: nodes at different Y levels corresponding to projects

- [ ] **Step 5.3: Load big-sample.json and verify emergent behaviors**

Load `big-sample.json` (88 people, 13 projects, 7 divisions). Verify:
- Divisions form distinct arcs around the cylinder
- People on many projects are visually between project bands
- Non-project managers are visibly outside the main cluster (larger radius)
- Reports-to edges are faint but visible; brightening noticeably on hover

- [ ] **Step 5.4: Test hover and focus opacity**

- Hover a node → its reports-to and works-on edges brighten; unrelated edges nearly disappear
- Click a node (focus) → chain of reports-to edges brightens fully; same for works-on

- [ ] **Step 5.5: Test Layout panel**

Open the ⚙ Layout panel. Slide `cylinderR` and `outerR` — people should migrate between radii with smooth lerp animation. Slide `Project Y spread` — project bands should re-space.

- [ ] **Step 5.6: Run full test suite one final time**

```bash
cd /mnt/d/sites/org-graph-3d && npm test
```

Expected: all tests pass.

- [ ] **Step 5.7: Final commit if any fixes were needed**

If step 5 revealed any bugs and you fixed them, commit the fixes now:

```bash
cd /mnt/d/sites/org-graph-3d && git add -p
git commit -m "fix: <describe what you fixed>"
```
