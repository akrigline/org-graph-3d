import { describe, it, expect } from 'vitest';
import { AGENT_PROMPT } from './agentPrompt.js';

describe('AGENT_PROMPT', () => {
  it('is a non-empty string', () => {
    expect(typeof AGENT_PROMPT).toBe('string');
    expect(AGENT_PROMPT.length).toBeGreaterThan(0);
  });

  it('documents all node types', () => {
    expect(AGENT_PROMPT).toContain('"person"');
    expect(AGENT_PROMPT).toContain('"project"');
    expect(AGENT_PROMPT).toContain('"theme"');
  });

  it('documents all edge types', () => {
    expect(AGENT_PROMPT).toContain('reports-to');
    expect(AGENT_PROMPT).toContain('oversees');
    expect(AGENT_PROMPT).toContain('works-on');
    expect(AGENT_PROMPT).toContain('belongs-to');
  });

  it('documents required fields', () => {
    expect(AGENT_PROMPT).toContain('department');
    expect(AGENT_PROMPT).toContain('parent');
  });
});
