// Props: { errors: string[], warnings: string[], onIgnoreWarnings: () => void }
export default function ValidationPanel({ errors, warnings, onIgnoreWarnings }) {
  if (!errors.length && !warnings.length) {
    return null;
  }

  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;

  return (
    <div
      style={{
        position: 'fixed',
        top: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        maxWidth: '600px',
        width: 'calc(100% - 2rem)',
        maxHeight: '80vh',
        overflowY: 'auto',
        background: '#1a1a2e',
        border: '1px solid #444',
        borderRadius: '8px',
        padding: '1.25rem',
        fontFamily: 'sans-serif',
        fontSize: '0.9rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      {hasErrors && (
        <section style={{ marginBottom: hasWarnings ? '1rem' : 0 }}>
          <h3
            style={{
              margin: '0 0 0.5rem',
              color: '#ff4d4d',
              fontSize: '1rem',
              fontWeight: 700,
              borderBottom: '1px solid #ff4d4d44',
              paddingBottom: '0.35rem',
            }}
          >
            Validation Errors
          </h3>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {errors.map((msg) => (
              <li key={msg} style={{ color: '#ff6b6b', marginBottom: '0.25rem' }}>
                {msg}
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasWarnings && (
        <section>
          <h3
            style={{
              margin: '0 0 0.5rem',
              color: '#fbbf24',
              fontSize: '1rem',
              fontWeight: 700,
              borderBottom: '1px solid #fbbf2444',
              paddingBottom: '0.35rem',
            }}
          >
            Warnings
          </h3>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {warnings.map((msg) => (
              <li key={msg} style={{ color: '#fcd34d', marginBottom: '0.25rem' }}>
                {msg}
              </li>
            ))}
          </ul>

          {!hasErrors && (
            <button
              onClick={onIgnoreWarnings}
              style={{
                marginTop: '0.85rem',
                padding: '0.45rem 1rem',
                background: 'rgba(40,55,75,0.7)',
                color: 'rgba(200,220,240,0.9)',
                border: '1px solid rgba(100,130,160,0.35)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.875rem',
              }}
            >
              Render Anyway
            </button>
          )}
        </section>
      )}
    </div>
  );
}
