import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 3;
const PARTICLE_SPEED = 0.004;

export function ParticleSystem({ link, simNodesRef, graphNodes }) {
  const pointsRef = useRef();

  const { srcIdx, tgtIdx } = useMemo(() => ({
    srcIdx: graphNodes.findIndex(n => n.id === (link.source?.id ?? link.source)),
    tgtIdx: graphNodes.findIndex(n => n.id === (link.target?.id ?? link.target)),
  }), [graphNodes, link]);

  const progress = useMemo(
    () => Array.from({ length: PARTICLE_COUNT }, (_, i) => i / PARTICLE_COUNT),
    []
  );

  const positions = useMemo(
    () => new Float32Array(PARTICLE_COUNT * 3),
    []
  );

  useFrame(() => {
    const simNodes = simNodesRef.current;
    const src = simNodes[srcIdx];
    const tgt = simNodes[tgtIdx];
    if (!src || !tgt || !pointsRef.current) return;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      progress[i] = (progress[i] + PARTICLE_SPEED) % 1;
      const t = progress[i];
      positions[i * 3]     = src.x + (tgt.x - src.x) * t;
      positions[i * 3 + 1] = src.y + (tgt.y - src.y) * t;
      positions[i * 3 + 2] = src.z + (tgt.z - src.z) * t;
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial color="#f0a842" size={2} transparent opacity={0.7} depthWrite={false} />
    </points>
  );
}
