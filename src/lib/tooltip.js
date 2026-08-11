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
