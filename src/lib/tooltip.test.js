import { describe, it, expect } from 'vitest';
import { getTooltipContent } from './tooltip.js';

const rawData = {
  nodes: [
    { id: 'person-1', type: 'person', label: 'Alice', department: 'Engineering' },
    { id: 'project-1', type: 'project', label: 'Alpha' },
    { id: 'theme-1', type: 'theme', label: 'Core' },
  ],
  edges: [
    { source: 'person-1', target: 'theme-1', type: 'oversees' },
  ],
};

describe('getTooltipContent', () => {
  it('returns label and department for person', () => {
    const node = rawData.nodes.find(n => n.id === 'person-1');
    expect(getTooltipContent(node, rawData)).toEqual({ line1: 'Alice', line2: 'Engineering' });
  });

  it('returns label and "Project" for project', () => {
    const node = rawData.nodes.find(n => n.id === 'project-1');
    expect(getTooltipContent(node, rawData)).toEqual({ line1: 'Alpha', line2: 'Project' });
  });

  it('returns label and overseer name for theme', () => {
    const node = rawData.nodes.find(n => n.id === 'theme-1');
    expect(getTooltipContent(node, rawData)).toEqual({ line1: 'Core', line2: 'Alice' });
  });

  it('returns null line2 for theme with no overseer', () => {
    const orphan = { id: 'theme-2', type: 'theme', label: 'Orphan' };
    expect(getTooltipContent(orphan, rawData)).toEqual({ line1: 'Orphan', line2: null });
  });

  it('returns null for null node', () => {
    expect(getTooltipContent(null, rawData)).toBeNull();
  });
});
