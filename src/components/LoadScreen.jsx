import React, { useState, useRef } from 'react';
import { AGENT_PROMPT } from '../lib/agentPrompt.js';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#1a1a2e',
    color: '#e0e0e0',
    fontFamily: 'sans-serif',
    padding: '2rem',
    boxSizing: 'border-box',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 'bold',
    marginBottom: '0.5rem',
    color: '#a0c4ff',
  },
  subtitle: {
    fontSize: '1rem',
    color: '#888',
    marginBottom: '2rem',
  },
  dropZone: (isDragging) => ({
    position: 'relative',
    width: '100%',
    maxWidth: '680px',
    borderRadius: '8px',
    border: isDragging ? '2px dashed #a0c4ff' : '2px dashed #444',
    background: isDragging ? 'rgba(160, 196, 255, 0.08)' : '#12122a',
    transition: 'border-color 0.15s, background 0.15s',
    padding: '0',
    boxSizing: 'border-box',
  }),
  dropOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(160, 196, 255, 0.12)',
    borderRadius: '6px',
    pointerEvents: 'none',
    zIndex: 2,
    fontSize: '1.2rem',
    color: '#a0c4ff',
    fontWeight: 'bold',
  },
  textarea: {
    width: '100%',
    height: '320px',
    background: 'transparent',
    color: '#e0e0e0',
    border: 'none',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'monospace',
    fontSize: '0.85rem',
    padding: '1rem',
    boxSizing: 'border-box',
    borderRadius: '6px',
    lineHeight: '1.5',
  },
  hint: {
    textAlign: 'center',
    color: '#555',
    fontSize: '0.8rem',
    padding: '0.5rem 0 0.75rem',
    borderTop: '1px solid #2a2a4a',
  },
  errorBox: {
    width: '100%',
    maxWidth: '680px',
    marginTop: '0.75rem',
    padding: '0.75rem 1rem',
    background: '#3a1a1a',
    border: '1px solid #a04040',
    borderRadius: '6px',
    color: '#ff8080',
    fontSize: '0.875rem',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
  },
  button: {
    marginTop: '1.25rem',
    padding: '0.75rem 2.5rem',
    fontSize: '1rem',
    fontWeight: 'bold',
    background: '#3a6fd8',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  promptRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1.25rem',
  },
  promptButton: (hovered) => ({
    padding: '0.5rem 1rem',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    background: hovered ? 'rgba(160, 196, 255, 0.1)' : 'transparent',
    color: '#a0c4ff',
    border: '1px solid #3a6fd8',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background 0.15s',
  }),
  copiedNote: {
    fontSize: '0.8rem',
    color: '#7fd88f',
  },
};

export default function LoadScreen({ onLoad }) {
  const [text, setText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState(null);
  const [btnHovered, setBtnHovered] = useState(false);
  const [promptBtnHovered, setPromptBtnHovered] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const dragCounterRef = useRef(0);
  const copiedTimeoutRef = useRef(null);

  function handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    const file = e.dataTransfer?.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setError('Invalid JSON: only .json files are accepted');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      setText(evt.target.result);
      setError(null);
    };
    reader.onerror = () => {
      setError('Invalid JSON: could not read file');
    };
    reader.readAsText(file);
  }

  function handleSubmit() {
    setError(null);
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Invalid JSON: input is empty');
      return;
    }
    try {
      const parsed = JSON.parse(trimmed);
      onLoad(parsed);
    } catch (err) {
      setError(`Invalid JSON: ${err.message}`);
    }
  }

  function handleCopyPrompt() {
    navigator.clipboard.writeText(AGENT_PROMPT).then(() => {
      setPromptCopied(true);
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = setTimeout(() => setPromptCopied(false), 1500);
    });
  }

  function handleKeyDown(e) {
    // Allow Ctrl+Enter or Cmd+Enter to submit
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSubmit();
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.title}>OrgGraph 3D</div>
      <div style={styles.subtitle}>Paste JSON below or drag &amp; drop a .json file</div>

      <div style={styles.promptRow}>
        <button
          style={styles.promptButton(promptBtnHovered)}
          onClick={handleCopyPrompt}
          onMouseEnter={() => setPromptBtnHovered(true)}
          onMouseLeave={() => setPromptBtnHovered(false)}
        >
          Copy agent prompt
        </button>
        {promptCopied && <span style={styles.copiedNote}>Copied!</span>}
      </div>

      <div
        style={styles.dropZone(isDragging)}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div style={styles.dropOverlay}>Drop JSON file here</div>
        )}
        <textarea
          style={styles.textarea}
          value={text}
          onChange={(e) => { setText(e.target.value); setError(null); }}
          onKeyDown={handleKeyDown}
          placeholder={'{\n  "meta": { "title": "My Org" },\n  "nodes": [...],\n  "edges": [...]\n}'}
          spellCheck={false}
          aria-label="JSON input"
        />
        <div style={styles.hint}>Drag &amp; drop a .json file here, or paste directly above</div>
      </div>

      {error && (
        <div style={styles.errorBox} role="alert">
          {error}
        </div>
      )}

      <button
        style={{ ...styles.button, background: btnHovered ? '#2a5bc8' : '#3a6fd8' }}
        onClick={handleSubmit}
        onMouseEnter={() => setBtnHovered(true)}
        onMouseLeave={() => setBtnHovered(false)}
      >
        Load Graph
      </button>
    </div>
  );
}
