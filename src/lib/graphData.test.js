import { describe, it, expect } from 'vitest';
import { buildVisibleData, buildSectorMap, buildWorksOnMap, buildProjectPairEdges } from './graphData.js';

const rawData = {
  nodes: [
    { id: 'p1', type: 'person', label: 'A', department: 'Eng' },
    { id: 'proj1', type: 'project', label: 'P1' },
    { id: 't1', type: 'theme', label: 'T1', parent: null },
  ],
  edges: [
    { source: 'p1', target: 'proj1', type: 'works-on' },
    { source: 'p1', target: 't1', type: 'oversees' },
  ],
};

describe('buildVisibleData', () => {
  it('returns nodes with _size set', () => {
    const { nodes } = buildVisibleData(rawData, { org: true, oversight: true, work: true, themes: true, projects: true });
    expect(nodes.every(n => typeof n._size === 'number')).toBe(true);
  });

  it('excludes theme nodes when themes layer is off', () => {
    const { nodes } = buildVisibleData(rawData, { org: true, oversight: true, work: true, themes: false, projects: true });
    expect(nodes.every(n => n.type !== 'theme')).toBe(true);
  });

  it('excludes works-on links when work layer is off', () => {
    const { links } = buildVisibleData(rawData, { org: true, oversight: true, work: false, themes: true, projects: true });
    expect(links.every(l => l.type !== 'works-on')).toBe(true);
  });

  it('gives all person and project nodes _size 5', () => {
    const data = {
      nodes: [
        { id: 'p1', type: 'person', label: 'A', department: 'Eng' },
        { id: 'proj1', type: 'project', label: 'P1' },
      ],
      edges: [{ source: 'p1', target: 'proj1', type: 'works-on' }],
    };
    const { nodes } = buildVisibleData(data, { org: true, oversight: true, work: true, themes: true, projects: true });
    const person  = nodes.find(n => n.type === 'person');
    const project = nodes.find(n => n.type === 'project');
    expect(person._size).toBe(5);
    expect(project._size).toBe(5);
  });
});

describe('buildSectorMap', () => {
  it('groups persons by division prefix before " - "', () => {
    const nodes = [
      { id: 'p1', type: 'person', department: 'Div A - Lead' },
      { id: 'p2', type: 'person', department: 'Div A - IC' },
      { id: 'p3', type: 'person', department: 'Div B - IC' },
    ];
    const map = buildSectorMap(nodes, []);
    expect(map.size).toBe(2);
    expect(map.has('Div A')).toBe(true);
    expect(map.get('Div A').people).toHaveLength(2);
  });

  it('assigns distinct angles for each division', () => {
    const nodes = [
      { id: 'p1', type: 'person', department: 'Div A - IC' },
      { id: 'p2', type: 'person', department: 'Div B - IC' },
    ];
    const map = buildSectorMap(nodes, []);
    const angles = [...map.values()].map(v => v.angle);
    expect(angles[0]).not.toBeCloseTo(angles[1]);
  });

  it('sorts people within sector by BFS depth, root (depth 0) first', () => {
    const nodes = [
      { id: 'ic1',  type: 'person', department: 'Div A - IC' },
      { id: 'mgr',  type: 'person', department: 'Div A - Manager' },
    ];
    const edges = [{ source: 'ic1', target: 'mgr', type: 'reports-to' }];
    const map = buildSectorMap(nodes, edges);
    const people = map.get('Div A').people;
    expect(people[0].id).toBe('mgr');  // depth 0 (no manager above)
    expect(people[1].id).toBe('ic1');  // depth 1
  });

  it('uses full department string when no " - " separator', () => {
    const nodes = [{ id: 'p1', type: 'person', department: 'Engineering' }];
    const map = buildSectorMap(nodes, []);
    expect(map.has('Engineering')).toBe(true);
  });

  it('ignores non-person nodes', () => {
    const nodes = [
      { id: 'p1',    type: 'person',  department: 'Div A - IC' },
      { id: 'proj1', type: 'project', label: 'P1' },
    ];
    const map = buildSectorMap(nodes, []);
    expect(map.size).toBe(1);
  });
});

describe('buildWorksOnMap', () => {
  it('maps person id to Set of project ids', () => {
    const edges = [
      { source: 'p1', target: 'proj1', type: 'works-on' },
      { source: 'p1', target: 'proj2', type: 'works-on' },
      { source: 'p2', target: 'proj1', type: 'works-on' },
    ];
    const map = buildWorksOnMap(edges);
    expect(map.get('p1')).toEqual(new Set(['proj1', 'proj2']));
    expect(map.get('p2')).toEqual(new Set(['proj1']));
  });

  it('returns empty map when no works-on edges exist', () => {
    const edges = [{ source: 'p1', target: 'mgr', type: 'reports-to' }];
    expect(buildWorksOnMap(edges).size).toBe(0);
  });

  it('does not include persons with no works-on edges', () => {
    const edges = [{ source: 'p1', target: 'proj1', type: 'works-on' }];
    expect(buildWorksOnMap(edges).has('p2')).toBe(false);
  });
});

describe('buildProjectPairEdges', () => {
  it('creates an edge between two projects that share a person', () => {
    const edges = [
      { source: 'p1', target: 'proj1', type: 'works-on' },
      { source: 'p1', target: 'proj2', type: 'works-on' },
    ];
    const pairs = buildProjectPairEdges(edges);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].sharedCount).toBe(1);
  });

  it('creates no edge between projects with no shared people', () => {
    const edges = [
      { source: 'p1', target: 'proj1', type: 'works-on' },
      { source: 'p2', target: 'proj2', type: 'works-on' },
    ];
    expect(buildProjectPairEdges(edges)).toHaveLength(0);
  });

  it('counts multiple shared people correctly', () => {
    const edges = [
      { source: 'p1', target: 'proj1', type: 'works-on' },
      { source: 'p1', target: 'proj2', type: 'works-on' },
      { source: 'p2', target: 'proj1', type: 'works-on' },
      { source: 'p2', target: 'proj2', type: 'works-on' },
    ];
    const pairs = buildProjectPairEdges(edges);
    expect(pairs[0].sharedCount).toBe(2);
  });
});
