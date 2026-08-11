import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { forceSimulation, forceLink, forceCenter, forceManyBody } from 'd3-force-3d';
import { buildSectorMap, buildWorksOnMap, buildProjectPairEdges, buildDepthMap } from '../lib/graphData.js';

const LERP = 0.06;

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

export function useForceLayout(graphData, layoutParams) {
  const simNodesRef = useRef([]);
  const simRef      = useRef(null);
  const outerSimRef = useRef(null);   // outer ring 2D force sim
  const layoutRef   = useRef(null); // { personLayout, worksOnMap, projectNodes, projectNodeMap }

  useEffect(() => {
    if (!graphData.nodes.length) return;

    const { cylinderR, outerR, projectSpread, managerStep } = layoutParams;
    const { nodes, links } = graphData;

    const worksOnMap = buildWorksOnMap(links);
    const depthMap   = buildDepthMap(nodes, links);
    const sectorMap  = buildSectorMap(nodes, links, depthMap);

    // Person XZ layout: angle + radius per person.
    // Project workers sit at cylinderR (inner cylinder).
    // Managers/non-project people radiate outward by hierarchy depth:
    //   r = outerR + depth * managerStep  (root ≈ outerR, leaves furthest out).
    const personLayout = new Map();
    for (const [, { angle, arcWidth, people }] of sectorMap) {
      const count      = people.length;
      const usableArc  = arcWidth * 0.82;
      people.forEach((person, i) => {
        const offset = count > 1 ? (i / (count - 1) - 0.5) * usableArc : 0;
        const depth  = depthMap.get(person.id) ?? 0;
        personLayout.set(person.id, {
          theta: angle + offset,
          r: worksOnMap.has(person.id)
            ? cylinderR
            : outerR + depth * managerStep,
        });
      });
    }

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

      for (let i = 0; i < 350; i++) outerSim.tick();
    }
    outerSimRef.current = outerSim;

    // Project Y: all-pairs spring embedding (Kamada-Kawai-inspired).
    //
    // Each pair of projects has a spring whose REST LENGTH = projectSpread × (1 − jaccard).
    // Highly related projects (high jaccard) → short rest length → cluster close.
    // Unrelated projects (jaccard=0) → rest length = projectSpread → spread far apart.
    //
    // There is no forceManyBody. Separation for unrelated projects comes entirely from
    // the long spring rest lengths, not from a separate repulsion competing with attraction.
    // The slider scales all rest lengths proportionally, so it directly controls the
    // equilibrium spread instead of fighting a repulsion/attraction ratio.
    const projectNodes = nodes
      .filter(n => n.type === 'project')
      .map((n, i, arr) => ({
        ...n,
        x: arr.length > 1 ? (i / (arr.length - 1) - 0.5) * 100 : 0,
      }));
    const projectNodeMap = new Map(projectNodes.map(n => [n.id, n]));

    // Project team sizes (needed for Jaccard normalisation)
    const projectTeamSize = new Map();
    for (const [, projectIds] of worksOnMap) {
      for (const pid of projectIds) {
        projectTeamSize.set(pid, (projectTeamSize.get(pid) || 0) + 1);
      }
    }

    const pairEdges = buildProjectPairEdges(links);
    const pairSharedMap = new Map();
    for (const e of pairEdges) {
      pairSharedMap.set(`${e.source}|${e.target}`, e.sharedCount);
      pairSharedMap.set(`${e.target}|${e.source}`, e.sharedCount);
    }

    // Build a spring for every project pair — including unrelated ones.
    const allPairLinks = [];
    for (let i = 0; i < projectNodes.length; i++) {
      for (let j = i + 1; j < projectNodes.length; j++) {
        const A = projectNodes[i].id;
        const B = projectNodes[j].id;
        const shared = pairSharedMap.get(`${A}|${B}`) || 0;
        const sizeA  = projectTeamSize.get(A) || 0;
        const sizeB  = projectTeamSize.get(B) || 0;
        const union  = sizeA + sizeB - shared;
        const jaccard = union > 0 ? shared / union : 0;
        allPairLinks.push({ source: projectNodes[i], target: projectNodes[j], jaccard });
      }
    }

    const sim = forceSimulation(projectNodes, 1)
      .force('link',
        forceLink(allPairLinks)
          .distance(d => projectSpread * (1 - d.jaccard))
          .strength(0.5)
      )
      .force('center', forceCenter(0))
      .alphaDecay(0.02)
      .stop();

    for (let i = 0; i < 500; i++) sim.tick();

    simNodesRef.current = nodes.map(n => ({ ...n, x: 0, y: 0, z: 0 }));
    layoutRef.current = { personLayout, worksOnMap, depthMap, projectNodes, projectNodeMap, outerRingSimNodes, outerRingNodeMap };
    simRef.current = sim;

    return () => {
      sim.stop();
      simRef.current = null;
      outerSim?.stop();
      outerSimRef.current = null;
    };
  }, [graphData]); // eslint-disable-line react-hooks/exhaustive-deps

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

  useFrame(() => {
    const sim    = simRef.current;
    const layout = layoutRef.current;
    if (!sim || !layout || !simNodesRef.current.length) return;

    const { personLayout, worksOnMap, projectNodes, projectNodeMap, outerRingNodeMap } = layout;

    if (sim.alpha() > sim.alphaMin()) sim.tick();

    const outerSim = outerSimRef.current;
    if (outerSim && outerSim.alpha() > outerSim.alphaMin()) outerSim.tick();

    const projectYMap = new Map(projectNodes.map(n => [n.id, n.x]));

    const simNodes = simNodesRef.current;
    for (let i = 0; i < simNodes.length; i++) {
      const node = simNodes[i];

      if (node.type === 'project') {
        const simNode = projectNodeMap.get(node.id);
        if (!simNode) continue;
        node.x += (0        - node.x) * LERP;
        node.y += (simNode.x - node.y) * LERP;
        node.z += (0        - node.z) * LERP;

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
      // theme nodes: stay at 0,0,0
    }
  });

  return simNodesRef;
}
