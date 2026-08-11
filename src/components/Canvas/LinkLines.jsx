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
  inactive: { 'reports-to': 0.03, 'works-on': 0.03, other: 0.03 },
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
        factor = connected ? factorFor(type, 'hover') : factorFor(type, 'inactive');
      } else if (focusNodeId) {
        const direct = srcId === focusNodeId || tgtId === focusNodeId;
        const chain  = type === 'reports-to' && focusSet.has(srcId) && focusSet.has(tgtId);
        factor = (direct || chain) ? factorFor(type, 'focus') : factorFor(type, 'inactive');
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
