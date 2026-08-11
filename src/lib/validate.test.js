import { describe, it, expect } from 'vitest';
import { validate } from './validate.js';

const base = {
  nodes: [
    { id: 'p1', type: 'person', label: 'Alice', department: 'Eng' },
    { id: 'p2', type: 'person', label: 'Bob', department: 'Eng' },
    { id: 'proj1', type: 'project', label: 'Project 1' },
    { id: 't1', type: 'theme', label: 'Theme 1', parent: null },
    { id: 't2', type: 'theme', label: 'Theme 2', parent: 't1' },
  ],
  edges: [],
};

describe('reports-to type constraint', () => {
  it('errors when source of reports-to is not a person', () => {
    const data = { ...base, edges: [{ source: 'proj1', target: 'p1', type: 'reports-to' }] };
    const { errors } = validate(data);
    expect(errors.some(e => e.includes('reports-to') && e.includes('proj1'))).toBe(true);
  });
  it('errors when target of reports-to is not a person', () => {
    const data = { ...base, edges: [{ source: 'p1', target: 'proj1', type: 'reports-to' }] };
    const { errors } = validate(data);
    expect(errors.some(e => e.includes('reports-to') && e.includes('proj1'))).toBe(true);
  });
});

describe('works-on type constraint', () => {
  it('errors when source of works-on is not a person', () => {
    const data = { ...base, edges: [{ source: 'proj1', target: 'proj1', type: 'works-on' }] };
    const { errors } = validate(data);
    expect(errors.some(e => e.includes('works-on') && e.includes('proj1'))).toBe(true);
  });
  it('errors when target of works-on is not a project', () => {
    const data = { ...base, edges: [{ source: 'p1', target: 'p2', type: 'works-on' }] };
    const { errors } = validate(data);
    expect(errors.some(e => e.includes('works-on') && e.includes('p2'))).toBe(true);
  });
});

describe('circular theme parent chain', () => {
  it('errors on a theme whose parent chain loops back to itself', () => {
    const data = {
      nodes: [
        { id: 'tA', type: 'theme', label: 'A', parent: 'tB' },
        { id: 'tB', type: 'theme', label: 'B', parent: 'tA' },
      ],
      edges: [],
    };
    const { errors } = validate(data);
    expect(errors.some(e => e.toLowerCase().includes('circular'))).toBe(true);
  });
});

describe('belongs-to type constraint', () => {
  it('accepts a valid belongs-to edge (project → theme)', () => {
    const data = {
      ...base,
      edges: [{ source: 'proj1', target: 't1', type: 'belongs-to' }],
    };
    const { errors } = validate(data);
    expect(errors.some(e => e.includes('belongs-to'))).toBe(false);
  });

  it('errors when source of belongs-to is not a project', () => {
    const data = {
      ...base,
      edges: [{ source: 'p1', target: 't1', type: 'belongs-to' }],
    };
    const { errors } = validate(data);
    expect(errors.some(e => e.includes('belongs-to') && e.includes('p1'))).toBe(true);
  });

  it('errors when target of belongs-to is not a theme', () => {
    const data = {
      ...base,
      edges: [{ source: 'proj1', target: 'p1', type: 'belongs-to' }],
    };
    const { errors } = validate(data);
    expect(errors.some(e => e.includes('belongs-to') && e.includes('p1'))).toBe(true);
  });
});

describe('belongs-to orphan warning', () => {
  it('warns when a project has no belongs-to edge', () => {
    const data = { ...base, edges: [] };
    const { warnings } = validate(data);
    expect(warnings.some(w => w.includes('proj1') && w.includes('belongs-to'))).toBe(true);
  });

  it('does not warn when project has a belongs-to edge', () => {
    const data = {
      ...base,
      edges: [{ source: 'proj1', target: 't1', type: 'belongs-to' }],
    };
    const { warnings } = validate(data);
    expect(warnings.some(w => w.includes('proj1') && w.includes('belongs-to'))).toBe(false);
  });
});
