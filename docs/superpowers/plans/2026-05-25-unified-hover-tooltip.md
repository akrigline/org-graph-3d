# Unified Hover Tooltip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace NodeMesh's ad-hoc floating sprite labels with a single cursor-following HTML tooltip that covers person nodes, project nodes, and theme clouds, and make theme clouds hoverable and clickable.

**Architecture:** A pure `getTooltipContent(node, rawData)` function in `src/lib/tooltip.js` drives content logic. A `HoverTooltip` React component reads `hoveredNodeId` from the Zustand store, looks up the node, and renders a fixed-position div following the cursor. `NebulaMesh` gains pointer event handlers mirroring `NodeMesh`. `NodeMesh` loses its sprite label code. Priority (node over cloud) is already enforced by `e.stopPropagation()` in `NodeMesh`.

**Tech Stack:** React 18, Zustand 4, Tailwind CSS, Vitest

---

## File Map

| File | Change |
|------|--------|
| `src/lib/tooltip.js` | **Create** — pure `getTooltipContent` function |
| `src/lib/tooltip.test.js` | **Create** — unit tests for getTooltipContent |
| `src/components/HoverTooltip.jsx` | **Create** — cursor-following tooltip component |
| `src/components/Canvas/NodeMesh.jsx` | **Modify** — remove makeLabel, labelRef, sprite logic |
| `src/components/Canvas/NebulaMesh.jsx` | **Modify** — add onPointerOver, onPointerOut, onClick |
| `src/App.jsx` | **Modify** — import and mount HoverTooltip |

---

### Task 1: TDD `getTooltipContent`

**Files:**
- Create: `src/lib/tooltip.js`
- Create: `src/lib/tooltip.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/tooltip.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { getTooltipContent } from './tooltip.js';

const rawData = {
  nodes: [
    { id: 'person-1', type: 'person', label: 'Alice', department: 'Engineering' },
    { id: 'project-1', type: 'project', label: 'Alpha' },
    { id: 'theme-1', type: 'theme', label: 'Core' },
  ],
  edges: [
    { source: 'person-1', target: 'theme-1', type: 'oversees' },
  ],
};

describe('getTooltipContent', () => {
  it('returns label and department for person', () => {
    const node = rawData.nodes.find(n => n.id === 'person-1');
    expect(getTooltipContent(node, rawData)).toEqual({ line1: 'Alice', line2: 'Engineering' });
  });

  it('returns label and "Project" for project', () => {
    const node = rawData.nodes.find(n => n.id === 'project-1');
    expect(getTooltipContent(node, rawData)).toEqual({ line1: 'Alpha', line2: 'Project' });
  });

  it('returns label and overseer name for theme', () => {
    const node = rawData.nodes.find(n => n.id === 'theme-1');
    expect(getTooltipContent(node, rawData)).toEqual({ line1: 'Core', line2: 'Alice' });
  });

  it('returns null line2 for theme with no overseer', () => {
    const orphan = { id: 'theme-2', type: 'theme', label: 'Orphan' };
    expect(getTooltipContent(orphan, rawData)).toEqual({ line1: 'Orphan', line2: null });
  });

  it('returns null for null node', () => {
    expect(getTooltipContent(null, rawData)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose src/lib/tooltip.test.js
```

Expected: 5 failures — `getTooltipContent` not defined.

- [ ] **Step 3: Implement `getTooltipContent`**

Create `src/lib/tooltip.js`:

```js
export function getTooltipContent(node, rawData) {
  if (!node || !rawData) return null;
  if (node.type === 'person') {
    return { line1: node.label || node.id, line2: node.department || null };
  }
  if (node.type === 'project') {
    return { line1: node.label || node.id, line2: 'Project' };
  }
  if (node.type === 'theme') {
    const edge = rawData.edges.find(e => e.type === 'oversees' && e.target === node.id);
    const overseer = edge
      ? rawData.nodes.find(n => n.id === edge.source && n.type === 'person')
      : null;
    return { line1: node.label || node.id, line2: overseer?.label || null };
  }
  return { line1: node.label || node.id, line2: null };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose src/lib/tooltip.test.js
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tooltip.js src/lib/tooltip.test.js
git commit -m "feat: getTooltipContent for unified hover tooltip"
```

---

### Task 2: Create `HoverTooltip` component and mount in App

**Files:**
- Create: `src/components/HoverTooltip.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create the component**

Create `src/components/HoverTooltip.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { useGraphStore } from '../store/useGraphStore.js';
import { getTooltipContent } from '../lib/tooltip.js';

export default function HoverTooltip() {
  const hoveredNodeId = useGraphStore(s => s.hoveredNodeId);
  const rawData = useGraphStore(s => s.rawData);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    function onMove(e) { setPos({ x: e.clientX, y: e.clientY }); }
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  if (!hoveredNodeId || !rawData) return null;
  const node = rawData.nodes.find(n => n.id === hoveredNodeId);
  if (!node) return null;

  const content = getTooltipContent(node, rawData);
  if (!content) return null;

  const x = Math.min(pos.x + 12, window.innerWidth - 160);
  const y = Math.min(pos.y + 12, window.innerHeight - 60);

  return (
    <div
      className="fixed bg-black/90 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-[#e0e0e0] pointer-events-none z-20"
      style={{ left: x, top: y }}
    >
      <div>{content.line1}</div>
      {content.line2 && <div className="text-[11px] text-gray-400">{content.line2}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Mount in `src/App.jsx`**

Add the import after the existing HUD imports:

```jsx
import HoverTooltip from './components/HoverTooltip.jsx';
```

Add the component alongside the other HUD elements (after the BottomControls line):

```jsx
{showGraph && hudVisible && <HoverTooltip />}
```

The full HUD block in App should look like:

```jsx
{showGraph && hudVisible && <DetailPanel />}
{showGraph && hudVisible && <LayerToggles />}
{showGraph && hudVisible && <BottomControls cameraRef={cameraRef} onLoadNew={handleLoadNew} />}
{showGraph && hudVisible && <HoverTooltip />}
```

- [ ] **Step 3: Run all tests to confirm nothing regressed**

```bash
npm test
```

Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/HoverTooltip.jsx src/App.jsx
git commit -m "feat: HoverTooltip component wired into App HUD"
```

---

### Task 3: Remove sprite label logic from `NodeMesh`

**Files:**
- Modify: `src/components/Canvas/NodeMesh.jsx`

At this point the new HTML tooltip already handles node hover labels, so the old 3D sprite code can be removed.

- [ ] **Step 1: Replace the full file contents**

Write `src/components/Canvas/NodeMesh.jsx` as:

```jsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { getNodeColor } from '../../lib/colors.js';
import { useGraphStore } from '../../store/useGraphStore.js';

export function NodeMesh({ nodeData, simNodesRef, nodeIndex }) {
  const meshRef = useRef();
  const matRef = useRef();

  const color = getNodeColor(nodeData);
  const size = nodeData._size || 5;

  useFrame(() => {
    const simNode = simNodesRef.current[nodeIndex];
    if (!simNode || !meshRef.current) return;
    meshRef.current.position.set(simNode.x ?? 0, simNode.y ?? 0, simNode.z ?? 0);
    const { focusNodeId, focusSet } = useGraphStore.getState();
    const inFocus = !focusNodeId || focusSet.has(nodeData.id);
    if (matRef.current) matRef.current.opacity = inFocus ? 1.0 : 0.04;
  });

  function handleClick(e) {
    e.stopPropagation();
    const { selectedNodeId, setSelectedNodeId } = useGraphStore.getState();
    setSelectedNodeId(selectedNodeId === nodeData.id ? null : nodeData.id);
  }

  function handleDoubleClick(e) {
    e.stopPropagation();
    const { focusNodeId, setFocusNodeId } = useGraphStore.getState();
    setFocusNodeId(focusNodeId === nodeData.id ? null : nodeData.id);
  }

  return (
    <mesh
      ref={meshRef}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onPointerOver={e => { e.stopPropagation(); useGraphStore.getState().setHoveredNodeId(nodeData.id); }}
      onPointerOut={() => useGraphStore.getState().setHoveredNodeId(null)}
    >
      {nodeData.type === 'person'
        ? <sphereGeometry args={[size, 14, 10]} />
        : <boxGeometry args={[size * 1.4, size * 1.4, size * 1.4]} />
      }
      <meshPhongMaterial ref={matRef} color={color} transparent opacity={1} shininess={40} />
    </mesh>
  );
}
```

Removed vs original: `makeLabel` function, `labelRef` ref, the `isActive` sprite add/remove block in `useFrame`, and the unused `THREE` import (THREE is no longer used directly in this file after removal).

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/Canvas/NodeMesh.jsx
git commit -m "refactor: remove sprite labels from NodeMesh in favour of HoverTooltip"
```

---

### Task 4: Add interaction handlers to `NebulaMesh`

**Files:**
- Modify: `src/components/Canvas/NebulaMesh.jsx`

- [ ] **Step 1: Replace the `return` statement in `NebulaMesh`**

The only change is adding event handlers to the `<mesh>`. Replace the existing `return (...)` block:

```jsx
  return (
    <mesh
      ref={meshRef}
      onPointerOver={e => { e.stopPropagation(); useGraphStore.getState().setHoveredNodeId(themeNode.id); }}
      onPointerOut={() => useGraphStore.getState().setHoveredNodeId(null)}
      onClick={e => {
        e.stopPropagation();
        const { selectedNodeId, setSelectedNodeId } = useGraphStore.getState();
        setSelectedNodeId(selectedNodeId === themeNode.id ? null : themeNode.id);
      }}
    >
      <sphereGeometry args={[1, 32, 24]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
```

Everything else in `NebulaMesh.jsx` is unchanged.

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/Canvas/NebulaMesh.jsx
git commit -m "feat: NebulaMesh hover and click interactions for theme clouds"
```

---

## Done

After Task 4:
- Hovering any node (person or project) shows the HTML tooltip with name + department/type
- Hovering a theme cloud shows the tooltip with name + overseer
- Hovering a node inside a cloud shows the node tooltip (cloud event suppressed by stopPropagation)
- Clicking any node or cloud selects it and opens the DetailPanel
- The old 3D sprite label system is fully removed
