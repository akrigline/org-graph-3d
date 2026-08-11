const PALETTE = [
  '#6b9ed2', // blue
  '#7ec8a0', // green
  '#d2876b', // coral
  '#b87ed2', // purple
  '#d2c26b', // yellow
  '#6bd2c8', // teal
  '#d26b8a', // pink
  '#8ad26b', // lime
  '#d2a36b', // amber
  '#6b8ad2', // indigo
];

const colorMap = {};

// Consistent color for any arbitrary string key
export function getDeptColor(key) {
  if (!key) return '#888888';
  if (!colorMap[key]) {
    colorMap[key] = PALETTE[Object.keys(colorMap).length % PALETTE.length];
  }
  return colorMap[key];
}

// Color key for a person node.
// Checks `group` first (free-form team/discipline label), then falls back
// to the division prefix before " - " in `department`, then the full string.
function personColorKey(node) {
  if (node.group) return node.group;
  if (!node.department) return null;
  const sep = node.department.indexOf(' - ');
  return sep >= 0 ? node.department.slice(0, sep) : node.department;
}

export function getNodeColor(node) {
  if (!node?.type) return '#888888';
  switch (node.type) {
    case 'person':  return getDeptColor(personColorKey(node));
    case 'project': return '#909090';
    case 'theme':   return '#e8a030';
    default:        return '#888888';
  }
}

export function getLinkColor(link, rawData) {
  if (!link?.type) return '#888888';
  switch (link.type) {
    case 'reports-to': return '#7a7a99';
    case 'oversees':   return '#d4922e';
    case 'works-on': {
      const sourceId = typeof link.source === 'string' ? link.source : link.source?.id;
      const sourceNode = rawData?.nodes?.find(n => n.id === sourceId);
      if (!sourceNode || sourceNode.type !== 'person') return '#888888';
      return getDeptColor(personColorKey(sourceNode));
    }
    default: return '#888888';
  }
}
