const VALID_NODE_TYPES = ['person', 'project', 'theme'];
const VALID_EDGE_TYPES = ['reports-to', 'oversees', 'works-on', 'belongs-to'];

// validate(data) → { errors: string[], warnings: string[] }
export function validate(data) {
  const errors = [];
  const warnings = [];

  // Error 1: data must be an object
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    errors.push('Root must be an object');
    return { errors, warnings };
  }

  // Error 2: nodes must be an array
  if (!Array.isArray(data.nodes)) {
    errors.push('nodes must be an array');
  }

  // Error 3: edges must be an array
  if (!Array.isArray(data.edges)) {
    errors.push('edges must be an array');
  }

  // If either nodes or edges is invalid, we can't do further checks
  if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
    return { errors, warnings };
  }

  const nodes = data.nodes;
  const edges = data.edges;

  // Two-pass duplicate detection: nodeIds only contains IDs that appear exactly once.
  // This ensures edges referencing a duplicate ID correctly fail the unknown-node check.
  const idCounts = new Map();
  for (const node of nodes) {
    if (node.id !== undefined && node.id !== null && node.id !== '') {
      idCounts.set(node.id, (idCounts.get(node.id) ?? 0) + 1);
    }
  }
  const duplicateIds = new Set([...idCounts.entries()].filter(([, c]) => c > 1).map(([id]) => id));
  const nodeIds = new Set([...idCounts.keys()].filter((id) => !duplicateIds.has(id)));

  // Process nodes: errors 4–8
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    // Error 4: missing id
    if (node.id === undefined || node.id === null || node.id === '') {
      errors.push(`Node at index ${i} is missing id`);
      continue; // can't do id-based checks without id
    }

    const id = node.id;

    // Error 8: duplicate id
    if (duplicateIds.has(id)) {
      errors.push(`Duplicate node id: ${id}`);
    }

    // Error 5: missing type
    if (node.type === undefined || node.type === null || node.type === '') {
      errors.push(`Node at index ${i} (id: ${id}) is missing type`);
      continue; // can't do type-based checks without type
    }

    const type = node.type;

    // Error 6: invalid type
    if (!VALID_NODE_TYPES.includes(type)) {
      errors.push(`Node ${id} has invalid type: ${type}`);
      continue;
    }

    // Error 7: person missing department
    if (type === 'person' && (node.department === undefined || node.department === null || node.department === '')) {
      errors.push(`Person ${id} is missing department`);
    }
  }

  // Process edges: errors 9–13
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];

    // Error 9: missing source
    if (edge.source === undefined || edge.source === null || edge.source === '') {
      errors.push(`Edge at index ${i} is missing source`);
    }

    // Error 10: missing target
    if (edge.target === undefined || edge.target === null || edge.target === '') {
      errors.push(`Edge at index ${i} is missing target`);
    }

    // Error 11: missing type
    if (edge.type === undefined || edge.type === null || edge.type === '') {
      errors.push(`Edge at index ${i} is missing type`);
    } else if (!VALID_EDGE_TYPES.includes(edge.type)) {
      // Error 12: invalid edge type
      errors.push(`Edge ${i} has invalid type: ${edge.type}`);
    }

    // Error 13: edge references unknown node
    if (edge.source !== undefined && edge.source !== null && edge.source !== '' && !nodeIds.has(edge.source)) {
      errors.push(`Edge ${i} references unknown node: ${edge.source}`);
    }
    if (edge.target !== undefined && edge.target !== null && edge.target !== '' && !nodeIds.has(edge.target)) {
      errors.push(`Edge ${i} references unknown node: ${edge.target}`);
    }

    // Error 14: reports-to — both endpoints must be persons
    if (edge.type === 'reports-to' && edge.source && edge.target) {
      const srcNode = nodes.find(n => n.id === edge.source);
      const tgtNode = nodes.find(n => n.id === edge.target);
      if (srcNode && srcNode.type !== 'person') {
        errors.push(`reports-to edge ${i}: source ${edge.source} must be a person`);
      }
      if (tgtNode && tgtNode.type !== 'person') {
        errors.push(`reports-to edge ${i}: target ${edge.target} must be a person`);
      }
    }

    // Error 15: works-on — source must be person, target must be project
    if (edge.type === 'works-on' && edge.source && edge.target) {
      const srcNode = nodes.find(n => n.id === edge.source);
      const tgtNode = nodes.find(n => n.id === edge.target);
      if (srcNode && srcNode.type !== 'person') {
        errors.push(`works-on edge ${i}: source ${edge.source} must be a person`);
      }
      if (tgtNode && tgtNode.type !== 'project') {
        errors.push(`works-on edge ${i}: target ${edge.target} must be a project`);
      }
    }

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
  }

  // Warning 1: no meta object
  if (!data.meta) {
    warnings.push('No meta object found');
  }

  // Warnings based on node types — only check nodes that passed validation
  const validNodes = nodes.filter(
    (n) => nodeIds.has(n.id) && VALID_NODE_TYPES.includes(n.type)
  );

  // Error 17: circular theme parent chains
  const themeNodes = validNodes.filter(n => n.type === 'theme');
  const themeMap = new Map(themeNodes.map(n => [n.id, n]));
  for (const theme of themeNodes) {
    const visited = new Set();
    let current = theme;
    while (current && current.parent) {
      if (visited.has(current.id)) {
        errors.push(`Circular parent chain detected involving theme ${theme.id}`);
        break;
      }
      visited.add(current.id);
      current = themeMap.get(current.parent);
    }
  }

  // Warning 2: theme missing parent field (field must be present; null is OK)
  for (const node of validNodes) {
    if (node.type === 'theme' && !Object.prototype.hasOwnProperty.call(node, 'parent')) {
      warnings.push(`Theme ${node.id} is missing parent field (use null for root themes)`);
    }
  }

  // Warning 3: person with no reports-to edges (as source OR target)
  const personNodes = validNodes.filter((n) => n.type === 'person');
  const reportsToEdges = edges.filter((e) => e.type === 'reports-to');

  for (const person of personNodes) {
    const hasReportsTo = reportsToEdges.some(
      (e) => e.source === person.id || e.target === person.id
    );
    if (!hasReportsTo) {
      warnings.push(`Person ${person.id} has no reports-to relationships`);
    }
  }

  // Warning 4 & 5: project warnings
  const projectNodes = validNodes.filter((n) => n.type === 'project');
  const connectionEdges = edges.filter(
    (e) => e.type === 'works-on' || e.type === 'oversees'
  );
  const belongsToEdges = edges.filter(e => e.type === 'belongs-to');

  for (const project of projectNodes) {
    const hasConnection = connectionEdges.some((e) => e.target === project.id);
    if (!hasConnection) {
      warnings.push(`Project ${project.id} has no connections`);
    }
    const hasBelongsTo = belongsToEdges.some(e => e.source === project.id);
    if (!hasBelongsTo) {
      warnings.push(`Project ${project.id} has no belongs-to edge (not assigned to any theme)`);
    }
  }

  return { errors, warnings };
}
