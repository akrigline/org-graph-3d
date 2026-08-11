# Outer Ring Tree Layout & Uniform Inner Node Sizing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flatten project node sizes to a uniform value, and replace the explicit depth-step outer ring formula with a 2D force simulation that makes each division's management chain branch outward as a visible tree within its sector arc.

**Architecture:** Two independent changes. Change 1 is a one-line fix in `graphData.js`. Change 2 adds a second d3-force-3d simulation (2D, XZ plane) in `useForceLayout.js`, running alongside the existing project spring sim — outer ring people lerp to sim-computed positions instead of an explicit `outerR + depth * managerStep` formula.

**Tech Stack:** d3-force-3d (`forceSimulation`, `forceLink`, `forceManyBody`), React (`useRef`, `useEffect`), @react-three/fiber (`useFrame`), Vitest

---

### Task 1: Uniform project node size

**Files:**
- Modify: `src/lib/graphData.js` (line ~146)
- Modify: `src/lib/graphData.test.js`

- [ ] **Step 1: Write the failing test**

In `src/lib/graphData.test.js`, add inside the existing `describe('buildVisibleData', ...)` block:

```javascript
it('gives all person and project nodes _size 5', () => {
  const data = {
    nodes: [
      { id: 'p1', type: 'person', label: 'A', department: 'Eng' },
      { id: 'proj1', type: 'project', label: 'P1' },
    ],
    edges: [{ source: 'p1', target: 'proj1', type: 'works-on' }],
  };
  const { nodes } = buildVisibleData(data, { org: true, oversight: true, work: true, themes: true, projects: true });
  const person  = nodes.find(n => n.type === 'person');
  const project = nodes.find(n => n.type === 'project');
  expect(person._size).toBe(5);
  expect(project._size).toBe(5);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /mnt/d/sites/org-graph-3d && npm test
```

Expected: FAIL — project `_size` is `~5.2` (scaled by headcount), not `5`.

- [ ] **Step 3: Implement the change**

In `src/lib/graphData.js`, inside `buildGraphData`, find the project size line and replace it:

```javascript
// before
_size = 4 + Math.min((worksOnCount.get(node.id) || 0) * 1.2, 8);

// after
_size = 5;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/graphData.js src/lib/graphData.test.js
git commit -m "feat: uniform project node size, fixed at 5"
```

---

### Task 2: Add outer ring sim infrastructure

**Files:**
- Modify: `src/hooks/useForceLayout.js`

This task updates the import, adds a new ref, and adds the two force factory functions. No simulation is built yet — that's Task 3.

- [ ] **Step 1: Update the d3 import**

In `src/hooks/useForceLayout.js`, change line 3:

```javascript
// before
import { forceSimulation, forceLink, forceCenter } from 'd3-force-3d';

// after
import { forceSimulation, forceLink, forceCenter, forceManyBody } from 'd3-force-3d';
```

- [ ] **Step 2: Add `outerSimRef`**

Inside `useForceLayout`, add one ref alongside the existing three:

```javascript
const simNodesRef  = useRef([]);
const simRef       = useRef(null);
const outerSimRef  = useRef(null);   // ← add this line
const layoutRef    = useRef(null);
```

- [ ] **Step 3: Add the two force factory functions**

Add these two functions immediately above the `export function useForceLayout(...)` line. They are module-level helpers, not inside the hook.

```javascript
// Pulls each outer ring node radially toward outerR + depth * managerStep.
// Low strength — sets the gradient without overriding the reports-to springs.
function makeDepthAnchorForce(nodes, depthMap, outerR, managerStep) {
  return function(alpha) {
    for (const node of nodes) {
      const targetR  = outerR + (depthMap.get(node.id) ?? 0) * managerStep;
      const currentR = Math.sqrt(node.x * node.x + node.y * node.y) || 1;
      const factor   = (targetR - currentR) / currentR * alpha * 0.1;
      node.vx += node.x * factor;
      node.vy += node.y * factor;
    }
  };
}

// Nudges nodes back into their sector arc if they drift outside it.
// Note: sim uses (x, y) for the XZ plane — node.y here is rendered z.
function makeSectorClampForce(nodes, personToSector) {
  return function(alpha) {
    for (const node of nodes) {
      const sector = personToSector.get(node.id);
      if (!sector) continue;
      const { angle: midAngle, arcWidth } = sector;
      const halfArc = arcWidth / 2;

      let nodeAngle = Math.atan2(node.y, node.x);
      if (nodeAngle < 0) nodeAngle += Math.PI * 2;

      let delta = nodeAngle - midAngle;
      if (delta >  Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;

      if (Math.abs(delta) > halfArc) {
        const clampedAngle = midAngle + Math.sign(delta) * halfArc;
        const r = Math.sqrt(node.x * node.x + node.y * node.y) || 1;
        node.vx += (r * Math.cos(clampedAngle) - node.x) * 0.3 * alpha;
        node.vy += (r * Math.sin(clampedAngle) - node.y) * 0.3 * alpha;
      }
    }
  };
}
```

- [ ] **Step 4: Verify the app still starts**

```bash
npm run dev
```

Open http://localhost:5173. No console errors. Layout is unchanged (sim not wired yet).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useForceLayout.js
git commit -m "feat: add outerSimRef and force factory functions to useForceLayout"
```

---

### Task 3: Build the outer ring sim in the graphData useEffect

**Files:**
- Modify: `src/hooks/useForceLayout.js` (graphData useEffect, ~lines 13–108)

The outer ring sim runs in 2D (`nDim=2`), using `node.x` and `node.y` in sim-space. These map to rendered x and z respectively — `simNode.y` in the sim becomes `node.z` in Three.js. This follows the same trick the project sim uses (mapping `simNode.x` → rendered `node.y`).

- [ ] **Step 1: Build the outer ring sim inside the graphData useEffect**

In the `useEffect` that depends on `[graphData]`, after the existing `personLayout` loop (the `people.forEach(...)` block, ending around line 40), and before the project sim code (the `const projectNodes = nodes.filter(...)` line), insert:

```javascript
// --- Outer ring force simulation (2D, XZ plane) ---
// Outer ring people = those with no works-on edges.
const outerRingPeople = nodes.filter(
  n => n.type === 'person' && !worksOnMap.has(n.id)
);

// Map each person to their sector (needed by sectorClamp force).
const personToSector = new Map();
for (const [, sector] of sectorMap) {
  for (const person of sector.people) {
    personToSector.set(person.id, sector);
  }
}

// Initialise sim nodes in 2D (sim x = rendered x, sim y = rendered z).
const outerRingSimNodes = outerRingPeople.map(p => {
  const pl    = personLayout.get(p.id);
  const depth = depthMap.get(p.id) ?? 0;
  const r     = outerR + depth * managerStep;
  const theta = pl ? pl.theta : 0;
  return { ...p, x: r * Math.cos(theta), y: r * Math.sin(theta), vx: 0, vy: 0 };
});
const outerRingNodeMap = new Map(outerRingSimNodes.map(n => [n.id, n]));

let outerSim = null;
if (outerRingSimNodes.length > 0) {
  // Only reports-to edges where both endpoints are outer ring people.
  const outerRingSet = new Set(outerRingPeople.map(p => p.id));
  const outerRingLinks = links
    .filter(e => e.type === 'reports-to')
    .filter(e => outerRingSet.has(e.source) && outerRingSet.has(e.target))
    .map(e => ({ ...e })); // copy so d3 can mutate source/target to node refs

  outerSim = forceSimulation(outerRingSimNodes, 2)
    .force('link',
      forceLink(outerRingLinks)
        .id(d => d.id)
        .distance(managerStep)
        .strength(0.4)
    )
    .force('repel',       forceManyBody().strength(-30))
    .force('depthAnchor', makeDepthAnchorForce(outerRingSimNodes, depthMap, outerR, managerStep))
    .force('sectorClamp', makeSectorClampForce(outerRingSimNodes, personToSector))
    .alphaDecay(0.02)
    .stop();

  for (let i = 0; i < 300; i++) outerSim.tick();
}
outerSimRef.current = outerSim;
```

- [ ] **Step 2: Update `layoutRef` to include outer ring data**

Find the existing `layoutRef.current = ...` assignment near the end of the same useEffect:

```javascript
// before
layoutRef.current = { personLayout, worksOnMap, depthMap, projectNodes, projectNodeMap };

// after
layoutRef.current = { personLayout, worksOnMap, depthMap, projectNodes, projectNodeMap, outerRingSimNodes, outerRingNodeMap };
```

- [ ] **Step 3: Update the cleanup to stop both sims**

Find the `return () => ...` at the bottom of the same useEffect:

```javascript
// before
return () => { sim.stop(); simRef.current = null; };

// after
return () => {
  sim.stop();
  simRef.current = null;
  outerSim?.stop();
  outerSimRef.current = null;
};
```

- [ ] **Step 4: Verify no console errors**

```bash
npm run dev
```

Open http://localhost:5173. No errors. Layout still uses old XZ positions for outer ring (useFrame not updated yet).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useForceLayout.js
git commit -m "feat: build outer ring 2D force sim in graphData useEffect"
```

---

### Task 4: Wire outer ring sim positions into useFrame

**Files:**
- Modify: `src/hooks/useForceLayout.js` (useFrame section, ~lines 138–178)

- [ ] **Step 1: Destructure `outerRingNodeMap` in useFrame**

Inside the `useFrame` callback, find:

```javascript
const { personLayout, worksOnMap, projectNodes, projectNodeMap } = layout;
```

Change to:

```javascript
const { personLayout, worksOnMap, projectNodes, projectNodeMap, outerRingNodeMap } = layout;
```

- [ ] **Step 2: Tick the outer ring sim**

Find where the project sim is ticked:

```javascript
if (sim.alpha() > sim.alphaMin()) sim.tick();
```

Add immediately after:

```javascript
const outerSim = outerSimRef.current;
if (outerSim && outerSim.alpha() > outerSim.alphaMin()) outerSim.tick();
```

- [ ] **Step 3: Replace the person branch with an inner/outer split**

Find the full `else if (node.type === 'person')` block:

```javascript
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
```

Replace with:

```javascript
} else if (node.type === 'person') {
  if (worksOnMap.has(node.id)) {
    // Inner cylinder: track project Y, lerp to cylinderR in XZ.
    const pl = personLayout.get(node.id);
    if (!pl) continue;
    let sum = 0, count = 0;
    for (const pid of worksOnMap.get(node.id)) {
      sum += projectYMap.get(pid) ?? 0;
      count++;
    }
    node.x += (pl.r * Math.cos(pl.theta)        - node.x) * LERP;
    node.y += ((count > 0 ? sum / count : 0)     - node.y) * LERP;
    node.z += (pl.r * Math.sin(pl.theta)         - node.z) * LERP;
  } else {
    // Outer ring: lerp to force sim position.
    // sim uses 2D (x, y); sim.y maps to rendered z.
    const simNode = outerRingNodeMap.get(node.id);
    if (!simNode) continue;
    node.x += (simNode.x - node.x) * LERP;
    node.y += (0         - node.y) * LERP;
    node.z += (simNode.y - node.z) * LERP;
  }
}
```

- [ ] **Step 4: Verify the tree layout in the browser**

```bash
npm run dev
```

Open the app. Check:
- Outer ring (management-only people) shows tree branching within each division's colored arc — VPs near the inner boundary, ICs spread furthest out, reporting lines implied by proximity.
- Inner cylinder people (project workers) still track project Y correctly.
- Project nodes are all the same size.
- No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useForceLayout.js
git commit -m "feat: wire outer ring sim positions into useFrame lerp"
```

---

### Task 5: Reconverge outer ring sim on layoutParams change

**Files:**
- Modify: `src/hooks/useForceLayout.js` (layoutParams useEffect, ~lines 110–136)

- [ ] **Step 1: Replace the layoutParams useEffect**

Find the full layoutParams useEffect and replace it with:

```javascript
useEffect(() => {
  const layout   = layoutRef.current;
  const sim      = simRef.current;
  const outerSim = outerSimRef.current;
  if (!layout || !sim) return;

  const { cylinderR, outerR, projectSpread, managerStep } = layoutParams;
  const { personLayout, worksOnMap, depthMap, projectNodes, outerRingSimNodes } = layout;

  // Update inner cylinder radii in personLayout.
  for (const [id, entry] of personLayout) {
    if (worksOnMap.has(id)) entry.r = cylinderR;
  }

  // Project sim: update spring distances and re-warm.
  sim.force('link').distance(d => projectSpread * (1 - d.jaccard));
  const n = projectNodes.length;
  projectNodes.forEach((p, i) => {
    p.x  = n > 1 ? (i / (n - 1) - 0.5) * 100 : 0;
    p.vx = 0;
  });
  sim.alpha(0.5);

  // Outer ring sim: update forces, reset to new starting positions, re-warm.
  if (outerSim && outerRingSimNodes && outerRingSimNodes.length > 0) {
    outerSim.force('link').distance(managerStep);
    outerSim.force('depthAnchor', makeDepthAnchorForce(outerRingSimNodes, depthMap, outerR, managerStep));
    outerRingSimNodes.forEach(node => {
      const pl    = personLayout.get(node.id);
      const depth = depthMap.get(node.id) ?? 0;
      const r     = outerR + depth * managerStep;
      const theta = pl ? pl.theta : 0;
      node.x  = r * Math.cos(theta);
      node.y  = r * Math.sin(theta);
      node.vx = 0;
      node.vy = 0;
    });
    outerSim.alpha(0.5);
  }
}, [layoutParams]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 2: Verify slider reactivity**

```bash
npm run dev
```

Open the app. Drag `outerR` and `managerStep` sliders. The outer ring tree should re-settle smoothly each time — LERP handles the visual interpolation while the sim reconverges.

- [ ] **Step 3: Final check — run all tests**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useForceLayout.js
git commit -m "feat: reconverge outer ring sim on outerR/managerStep slider change"
```
