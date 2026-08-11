import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { getNodeColor } from '../../lib/colors.js';
import { useGraphStore } from '../../store/useGraphStore.js';

export function NodeMesh({ nodeData, simNodesRef, nodeIndex }) {
  const meshRef = useRef();
  const matRef = useRef();

  const color = getNodeColor(nodeData);
  const size = nodeData._size || 5;

  useEffect(() => {
    return () => useGraphStore.getState().setHoveredNodeId(null);
  }, []);

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
    const { selectedNodeId, setSelectedNodeId, setFocusNodeId } = useGraphStore.getState();
    if (selectedNodeId === nodeData.id) {
      setSelectedNodeId(null);
      setFocusNodeId(null);
    } else {
      setSelectedNodeId(nodeData.id);
      setFocusNodeId(nodeData.id);
    }
  }

  return (
    <mesh
      ref={meshRef}
      onClick={handleClick}
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
