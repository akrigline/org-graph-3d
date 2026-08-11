/**
 * Returns a Set of node IDs that should be fully visible when focusNode is in focus.
 * Rules vary by node type.
 */
export function getFocusSet(focusNode, rawData) {
  return computeFocusSet(focusNode, rawData);
}

/**
 * Returns opacity (1.0 or 0.04) for a node based on whether it's in the focus set.
 */
export function getFocusOpacity(node, focusNode, rawData) {
  if (!focusNode) return 1.0;
  return getFocusSet(focusNode, rawData).has(node.id) ? 1.0 : 0.04;
}

/**
 * Core logic: compute the focus set for a given focus node.
 */
function computeFocusSet(focusNode, rawData) {
  const result = new Set();

  // Build helper maps for efficient lookup
  const nodeMap = new Map();
  const edgesBySource = new Map();
  const edgesByTarget = new Map();

  for (const node of rawData.nodes) {
    nodeMap.set(node.id, node);
  }

  for (const edge of rawData.edges) {
    if (!edgesBySource.has(edge.source)) {
      edgesBySource.set(edge.source, []);
    }
    edgesBySource.get(edge.source).push(edge);

    if (!edgesByTarget.has(edge.target)) {
      edgesByTarget.set(edge.target, []);
    }
    edgesByTarget.get(edge.target).push(edge);
  }

  // Always include the focus node itself
  result.add(focusNode.id);

  if (focusNode.type === 'person') {
    addPersonFocusSet(focusNode, result, nodeMap, edgesBySource, edgesByTarget);
  } else if (focusNode.type === 'project') {
    addProjectFocusSet(focusNode, result, nodeMap, edgesBySource, edgesByTarget);
  } else if (focusNode.type === 'theme') {
    addThemeFocusSet(focusNode, result, nodeMap, edgesBySource, edgesByTarget);
  }

  return result;
}

/**
 * Adds nodes to focus set when focusNode is a person.
 */
function addPersonFocusSet(person, result, nodeMap, edgesBySource, edgesByTarget) {
  // Direct reports: people who have a reports-to edge where TARGET = this person
  const directReports = edgesByTarget.get(person.id) || [];
  for (const edge of directReports) {
    if (edge.type === 'reports-to') {
      result.add(edge.source);
    }
  }

  // Entire reporting chain upward: walk reports-to until reaching the root
  let currentId = person.id;
  const chainVisited = new Set([currentId]);
  while (true) {
    const edges = edgesBySource.get(currentId) || [];
    const managerEdge = edges.find(e => e.type === 'reports-to');
    if (!managerEdge || chainVisited.has(managerEdge.target)) break;
    chainVisited.add(managerEdge.target);
    result.add(managerEdge.target);
    currentId = managerEdge.target;
  }

  // All themes they oversee
  const overseeThemeEdges = edgesBySource.get(person.id) || [];
  const overseeThemes = new Set();
  for (const edge of overseeThemeEdges) {
    if (edge.type === 'oversees' && nodeMap.get(edge.target)?.type === 'theme') {
      overseeThemes.add(edge.target);
      result.add(edge.target);
    }
  }

  // All projects they oversee
  const overseeProjectEdges = edgesBySource.get(person.id) || [];
  for (const edge of overseeProjectEdges) {
    if (edge.type === 'oversees' && nodeMap.get(edge.target)?.type === 'project') {
      result.add(edge.target);
    }
  }

  // All projects they work-on
  const workOnEdges = edgesBySource.get(person.id) || [];
  for (const edge of workOnEdges) {
    if (edge.type === 'works-on') {
      result.add(edge.target);
    }
  }

  // All ancestors of themes they oversee (walk up the parent chain)
  for (const themeId of overseeThemes) {
    const visited = new Set([themeId]);
    let currentTheme = nodeMap.get(themeId);
    while (currentTheme && currentTheme.parent) {
      if (visited.has(currentTheme.parent)) break;  // cycle guard
      visited.add(currentTheme.parent);
      result.add(currentTheme.parent);
      currentTheme = nodeMap.get(currentTheme.parent);
    }
  }
}

/**
 * Adds nodes to focus set when focusNode is a project.
 */
function addProjectFocusSet(project, result, nodeMap, edgesBySource, edgesByTarget) {
  // All people who work-on this project
  const workOnEdges = edgesByTarget.get(project.id) || [];
  for (const edge of workOnEdges) {
    if (edge.type === 'works-on') {
      result.add(edge.source);
    }
  }

  // All people who oversee this project
  const overseeEdges = edgesByTarget.get(project.id) || [];
  for (const edge of overseeEdges) {
    if (edge.type === 'oversees') {
      result.add(edge.source);
    }
  }

  // All themes this project belongs to via belongs-to edges
  const allEdgesFromProject = edgesBySource.get(project.id) || [];
  for (const edge of allEdgesFromProject) {
    if (edge.type === 'belongs-to' && nodeMap.has(edge.target)) {
      result.add(edge.target); // theme
    }
  }
}

/**
 * Adds nodes to focus set when focusNode is a theme.
 */
function addThemeFocusSet(theme, result, nodeMap, edgesBySource, edgesByTarget) {
  // All child themes (walk the subtree)
  const childThemes = new Set();
  function walkThemeChildren(themeId, visited = new Set()) {
    if (visited.has(themeId)) return;  // cycle guard
    visited.add(themeId);
    for (const node of nodeMap.values()) {
      if (node.type === 'theme' && node.parent === themeId) {
        result.add(node.id);
        childThemes.add(node.id);
        walkThemeChildren(node.id, visited);
      }
    }
  }
  walkThemeChildren(theme.id);

  // All people who oversee this theme
  const overseeEdges = edgesByTarget.get(theme.id) || [];
  for (const edge of overseeEdges) {
    if (edge.type === 'oversees') {
      result.add(edge.source);
    }
  }

  // All projects that belong to this theme via belongs-to edges
  const belongsToEdges = edgesByTarget.get(theme.id) || [];
  for (const edge of belongsToEdges) {
    if (edge.type === 'belongs-to') {
      result.add(edge.source); // project

      // All people who work-on that project
      const projectWorkOnEdges = edgesByTarget.get(edge.source) || [];
      for (const workEdge of projectWorkOnEdges) {
        if (workEdge.type === 'works-on') {
          result.add(workEdge.source);
        }
      }
    }
  }
}

