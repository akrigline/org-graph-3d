// Helper: safely extract id from a link endpoint (handles string or object reference)
function resolveId(endpoint) {
  return typeof endpoint === 'object' && endpoint !== null ? endpoint.id : endpoint;
}

function parseDivision(department) {
  if (!department) return 'Unknown';
  const idx = department.indexOf(' - ');
  return idx >= 0 ? department.slice(0, idx) : department;
}

// Returns Map<personId, depth> where depth = distance from root in reports-to tree.
// Exported so useForceLayout can use it for outer-ring radial spacing.
export function buildDepthMap(nodes, edges) {
  const parentMap = new Map();
  for (const edge of edges) {
    if (edge.type !== 'reports-to') continue;
    parentMap.set(resolveId(edge.source), resolveId(edge.target));
  }
  const depthMap = new Map();
  const visiting = new Set();
  function depth(id) {
    if (depthMap.has(id)) return depthMap.get(id);
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const parentId = parentMap.get(id);
    const d = parentId ? 1 + depth(parentId) : 0;
    visiting.delete(id);
    depthMap.set(id, d);
    return d;
  }
  for (const node of nodes) {
    if (node.type === 'person') depth(node.id);
  }
  return depthMap;
}

export function buildSectorMap(nodes, edges, depthMap = null) {
  const personNodes = nodes.filter(n => n.type === 'person');

  // Group by division
  const divGroups = new Map();
  for (const node of personNodes) {
    const div = parseDivision(node.department);
    if (!divGroups.has(div)) divGroups.set(div, []);
    divGroups.get(div).push(node);
  }

  const resolvedDepthMap = depthMap ?? buildDepthMap(personNodes, edges);

  // Assign arcs proportional to headcount so nodes fill the full 360°.
  // Equal arcs let large divisions dominate one side of the circle visually.
  const divisions = [...divGroups.keys()].sort();
  const totalPeople = personNodes.length || 1;
  let cumulative = 0;
  const sectorMap = new Map();
  for (const div of divisions) {
    const people = divGroups.get(div)
      .slice()
      .sort((a, b) => (resolvedDepthMap.get(a.id) ?? 0) - (resolvedDepthMap.get(b.id) ?? 0) || a.id.localeCompare(b.id));
    const arcWidth = (people.length / totalPeople) * Math.PI * 2;
    const angle = cumulative + arcWidth / 2; // midpoint of this sector's arc
    sectorMap.set(div, { angle, arcWidth, people });
    cumulative += arcWidth;
  }

  return sectorMap;
}

export function buildWorksOnMap(edges) {
  const map = new Map();
  for (const edge of edges) {
    if (edge.type !== 'works-on') continue;
    const src = resolveId(edge.source);
    const tgt = resolveId(edge.target);
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
    const src = resolveId(edge.source);
    const tgt = resolveId(edge.target);
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

// Helper: compute depth of a theme node in the parent hierarchy
function getThemeDepth(nodeId, nodeMap) {
  const visited = new Set();
  let depth = 0;
  let current = nodeId;

  while (true) {
    if (visited.has(current)) break;
    visited.add(current);
    const node = nodeMap.get(current);
    if (!node) break;
    const parent = node.parent;
    if (parent === null || parent === undefined || !nodeMap.has(parent)) break;
    depth++;
    current = parent;
  }

  return depth;
}

export function buildGraphData(rawData) {
  const { nodes: rawNodes, edges: rawEdges } = rawData;

  const nodeMap = new Map(rawNodes.map((n) => [n.id, n]));

  const nodes = rawNodes.map((node) => {
    let _size;
    if (node.type === 'person') {
      _size = 5; // uniform — hierarchy shown by radial position, not size
    } else if (node.type === 'project') {
      _size = 5;
    } else if (node.type === 'theme') {
      _size = Math.max(8 - getThemeDepth(node.id, nodeMap) * 1.5, 3);
    } else {
      _size = 4;
    }
    return { ...node, _size };
  });

  const links = rawEdges.map((edge) => ({ ...edge }));

  return { nodes, links };
}

export function getVisibleData(rawData, layers) {
  const { nodes: rawNodes, edges: rawEdges } = rawData;

  const excludedNodeIds = new Set();
  if (layers.themes === false) {
    for (const node of rawNodes) {
      if (node.type === 'theme') excludedNodeIds.add(node.id);
    }
  }
  if (layers.projects === false) {
    for (const node of rawNodes) {
      if (node.type === 'project') excludedNodeIds.add(node.id);
    }
  }

  const filteredNodes = rawNodes.filter((node) => !excludedNodeIds.has(node.id));

  const filteredLinks = rawEdges.filter((edge) => {
    const srcId = resolveId(edge.source);
    const tgtId = resolveId(edge.target);
    if (excludedNodeIds.has(srcId) || excludedNodeIds.has(tgtId)) return false;
    if (layers.org === false && edge.type === 'reports-to') return false;
    if (layers.oversight === false && edge.type === 'oversees') return false;
    if (layers.work === false && edge.type === 'works-on') return false;
    return true;
  });

  return { nodes: filteredNodes, links: filteredLinks };
}

export function buildVisibleData(rawData, layers) {
  const { nodes: sizedNodes, links: allLinks } = buildGraphData(rawData);

  const excludedNodeIds = new Set();
  if (layers.themes === false) {
    for (const node of rawData.nodes) {
      if (node.type === 'theme') excludedNodeIds.add(node.id);
    }
  }
  if (layers.projects === false) {
    for (const node of rawData.nodes) {
      if (node.type === 'project') excludedNodeIds.add(node.id);
    }
  }

  const nodes = sizedNodes.filter(n => !excludedNodeIds.has(n.id));

  const links = allLinks.filter(link => {
    const srcId = resolveId(link.source);
    const tgtId = resolveId(link.target);
    if (excludedNodeIds.has(srcId) || excludedNodeIds.has(tgtId)) return false;
    if (layers.org === false && link.type === 'reports-to') return false;
    if (layers.oversight === false && link.type === 'oversees') return false;
    if (layers.work === false && link.type === 'works-on') return false;
    return true;
  });

  return { nodes, links };
}
