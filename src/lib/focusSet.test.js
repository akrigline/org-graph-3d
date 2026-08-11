import { describe, it, expect } from 'vitest';
import { getFocusSet } from './focusSet.js';

const rawData = {
  nodes: [
    { id: 'p1', type: 'person', label: 'Alice', department: 'Eng' },
    { id: 'p2', type: 'person', label: 'Bob',   department: 'Eng' },
    { id: 'proj1', type: 'project', label: 'Project 1' },
    { id: 'proj2', type: 'project', label: 'Project 2' },
    { id: 't1', type: 'theme', label: 'Theme 1', parent: null },
    { id: 't2', type: 'theme', label: 'Theme 2', parent: null },
  ],
  edges: [
    { source: 'p1', target: 'proj1', type: 'works-on' },
    { source: 'p2', target: 'proj2', type: 'works-on' },
    { source: 'proj1', target: 't1', type: 'belongs-to' },
    { source: 'proj2', target: 't2', type: 'belongs-to' },
    { source: 'proj1', target: 't2', type: 'belongs-to' },
  ],
};

describe('getFocusSet — theme focus', () => {
  it('includes the theme itself', () => {
    const set = getFocusSet({ id: 't1', type: 'theme' }, rawData);
    expect(set.has('t1')).toBe(true);
  });

  it('includes projects that belong-to the theme', () => {
    const set = getFocusSet({ id: 't1', type: 'theme' }, rawData);
    expect(set.has('proj1')).toBe(true);
  });

  it('excludes projects that do not belong-to the theme', () => {
    const set = getFocusSet({ id: 't1', type: 'theme' }, rawData);
    expect(set.has('proj2')).toBe(false);
  });

  it('includes people who work-on a project belonging to the theme', () => {
    const set = getFocusSet({ id: 't1', type: 'theme' }, rawData);
    expect(set.has('p1')).toBe(true);
  });

  it('includes projects from multiple belongs-to edges targeting the same theme', () => {
    const set = getFocusSet({ id: 't2', type: 'theme' }, rawData);
    expect(set.has('proj1')).toBe(true);
    expect(set.has('proj2')).toBe(true);
  });
});

describe('getFocusSet — project focus', () => {
  it('includes themes the project belongs to', () => {
    const set = getFocusSet({ id: 'proj1', type: 'project' }, rawData);
    expect(set.has('t1')).toBe(true);
    expect(set.has('t2')).toBe(true);
  });

  it('does not include themes the project does not belong to via belongs-to edge', () => {
    const set = getFocusSet({ id: 'proj2', type: 'project' }, rawData);
    expect(set.has('t1')).toBe(false);
    expect(set.has('t2')).toBe(true);
  });
});

describe('getFocusSet — edge cases', () => {
  it('project with no belongs-to edges returns only itself and its workers', () => {
    const data = {
      nodes: [
        { id: 'px', type: 'project', label: 'Orphan Project' },
        { id: 'pu', type: 'person',  label: 'User', department: 'Eng' },
      ],
      edges: [
        { source: 'pu', target: 'px', type: 'works-on' },
      ],
    };
    const set = getFocusSet({ id: 'px', type: 'project' }, data);
    expect(set.has('px')).toBe(true);
    expect(set.has('pu')).toBe(true);
    expect(set.size).toBe(2);
  });

  it('belongs-to edge whose target theme does not exist is silently ignored', () => {
    const data = {
      nodes: [
        { id: 'py', type: 'project', label: 'Project Y' },
      ],
      edges: [
        { source: 'py', target: 'ghost-theme', type: 'belongs-to' },
      ],
    };
    const set = getFocusSet({ id: 'py', type: 'project' }, data);
    expect(set.has('py')).toBe(true);
    expect(set.has('ghost-theme')).toBe(false);
  });
});
