import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useMemo } from 'react';
import { useGraphStore } from '../../store/useGraphStore.js';
import { buildVisibleData } from '../../lib/graphData.js';
import { useForceLayout } from '../../hooks/useForceLayout.js';
import { NodeMesh } from './NodeMesh.jsx';
import { NebulaMesh } from './NebulaMesh.jsx';
import { ParticleSystem } from './ParticleSystem.jsx';
import { LinkLines } from './LinkLines.jsx';

function SceneContents() {
  const rawData = useGraphStore(s => s.rawData);
  const layers = useGraphStore(s => s.layers);
  const layoutParams = useGraphStore(s => s.layoutParams);

  const graphData = useMemo(
    () => rawData ? buildVisibleData(rawData, layers) : { nodes: [], links: [] },
    [rawData, layers]
  );

  const simNodesRef = useForceLayout(graphData, layoutParams);

  const nodeTypeMap = useMemo(
    () => new Map(graphData.nodes.map(n => [n.id, n.type])),
    [graphData.nodes]
  );

  if (!rawData) return null;

  // Exclude person→theme oversees links: theme nodes sit at radius ~350 (radial force)
  // but NebulaMesh ignores that position, so particles would fly to empty space.
  const overseesLinks = graphData.links.filter(l => {
    if (l.type !== 'oversees') return false;
    const tgtId = l.target?.id ?? l.target;
    return nodeTypeMap.get(tgtId) !== 'theme';
  });
  const structureLinks = graphData.links.filter(
    l => l.type !== 'oversees' && l.type !== 'belongs-to'
  );

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[100, 200, 100]} intensity={0.8} />
      <OrbitControls makeDefault />

      {graphData.nodes.map((node, index) => {
        if (node.type === 'theme') return null;
        return <NodeMesh key={node.id} nodeData={node} simNodesRef={simNodesRef} nodeIndex={index} />;
      })}

      {graphData.nodes.filter(n => n.type === 'theme').map(themeNode => {
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
        return (
          <NebulaMesh
            key={themeNode.id}
            themeNode={themeNode}
            memberIds={memberIds}
            simNodesRef={simNodesRef}
            graphNodes={graphData.nodes}
          />
        );
      })}

      {overseesLinks.map((link, i) => (
        <ParticleSystem key={i} link={link} simNodesRef={simNodesRef} graphNodes={graphData.nodes} />
      ))}

      <LinkLines links={structureLinks} simNodesRef={simNodesRef} graphNodes={graphData.nodes} rawData={rawData} />
    </>
  );
}

export function GraphScene({ cameraRef }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 500], fov: 60, far: 100000 }}
      gl={{ antialias: true }}
      style={{ background: '#0a0a0f' }}
      onCreated={({ camera }) => { if (cameraRef) cameraRef.current = camera; }}
    >
      <SceneContents />
    </Canvas>
  );
}
