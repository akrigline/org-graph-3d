import { describe, it, expect, beforeEach } from 'vitest';
import { useGraphStore } from './useGraphStore.js';

beforeEach(() => {
  useGraphStore.setState({
    rawData: null, selectedNodeId: null, focusNodeId: null,
    focusSet: new Set(), hudVisible: true,
    layers: { org: true, oversight: true, work: true, themes: true, projects: true },
  });
});

const sampleData = {
  nodes: [
    { id: 'p1', type: 'person', label: 'Alice', department: 'Eng' },
    { id: 'p2', type: 'person', label: 'Bob', department: 'Eng' },
    { id: 'proj1', type: 'project', label: 'P1' },
    { id: 't1', type: 'theme', label: 'T1', parent: null },
  ],
  edges: [
    { source: 'p1', target: 'p2', type: 'reports-to' },
    { source: 'p1', target: 'proj1', type: 'works-on' },
    { source: 'p1', target: 't1', type: 'oversees' },
  ],
};

describe('toggleHUD', () => {
  it('flips hudVisible', () => {
    useGraphStore.getState().toggleHUD();
    expect(useGraphStore.getState().hudVisible).toBe(false);
  });
});

describe('toggleLayer', () => {
  it('flips a single layer', () => {
    useGraphStore.getState().toggleLayer('org');
    expect(useGraphStore.getState().layers.org).toBe(false);
    expect(useGraphStore.getState().layers.work).toBe(true);
  });
});

describe('setFocusNodeId', () => {
  it('clears focus set when id is null', () => {
    useGraphStore.setState({ rawData: sampleData, focusNodeId: 'p1', focusSet: new Set(['p1']) });
    useGraphStore.getState().setFocusNodeId(null);
    expect(useGraphStore.getState().focusNodeId).toBe(null);
    expect(useGraphStore.getState().focusSet.size).toBe(0);
  });

  it('computes focus set from rawData for a person node', () => {
    useGraphStore.setState({ rawData: sampleData });
    useGraphStore.getState().setFocusNodeId('p1');
    const { focusSet } = useGraphStore.getState();
    expect(focusSet.has('p1')).toBe(true);
    expect(focusSet.has('p2')).toBe(true); // manager
    expect(focusSet.has('proj1')).toBe(true); // works-on
    expect(focusSet.has('t1')).toBe(true); // oversees
  });
});
