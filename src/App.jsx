import React, { useEffect, useRef } from 'react';
import { useGraphStore } from './store/useGraphStore.js';
import { validate } from './lib/validate.js';
import LoadScreen from './components/LoadScreen.jsx';
import ValidationPanel from './components/ValidationPanel.jsx';
import { GraphScene } from './components/Canvas/GraphScene.jsx';
import DetailPanel from './components/DetailPanel.jsx';
import LayerToggles from './components/LayerToggles.jsx';
import BottomControls from './components/BottomControls.jsx';
import HoverTooltip from './components/HoverTooltip.jsx';
import LayoutSettings from './components/LayoutSettings.jsx';

export default function App() {
  const { rawData, setRawData, hudVisible, toggleHUD, focusNodeId, setFocusNodeId, clearSelection, resetAll } = useGraphStore();
  const [errors, setErrors] = React.useState([]);
  const [warnings, setWarnings] = React.useState([]);
  const [ignoreWarnings, setIgnoreWarnings] = React.useState(false);
  const cameraRef = useRef(null);

  function handleLoad(data) {
    const result = validate(data);
    setErrors(result.errors);
    setWarnings(result.warnings);
    setIgnoreWarnings(false);
    setRawData(data);
  }

  function handleLoadNew() {
    resetAll();
    setErrors([]);
    setWarnings([]);
    setIgnoreWarnings(false);
  }

  useEffect(() => {
    function onKey(e) {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key.toLowerCase() === 'h') toggleHUD();
      if (e.key === 'Escape') {
        setFocusNodeId(null);
        clearSelection();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusNodeId]);

  if (rawData === null) return <LoadScreen onLoad={handleLoad} />;

  const hasErrors = errors.length > 0;
  const showValidation = hasErrors || (warnings.length > 0 && !ignoreWarnings);
  const showGraph = !hasErrors && (warnings.length === 0 || ignoreWarnings);

  return (
    <>
      {showValidation && (
        <div className="fixed inset-0 bg-[#0a0a0f] flex flex-col items-center justify-start overflow-auto p-8 font-sans">
          <ValidationPanel errors={errors} warnings={warnings} onIgnoreWarnings={() => setIgnoreWarnings(true)} />
          {hasErrors && (
            <button
              className="mt-6 px-4 py-2 rounded border border-[rgba(100,130,160,0.35)] bg-[rgba(40,55,75,0.7)] text-[rgba(200,220,240,0.9)] cursor-pointer text-sm font-medium"
              onClick={handleLoadNew}
            >
              Load New File
            </button>
          )}
        </div>
      )}

      {showGraph && (
        <div className="fixed inset-0">
          <GraphScene cameraRef={cameraRef} />
        </div>
      )}

      {showGraph && hudVisible && <DetailPanel />}
      {showGraph && hudVisible && <LayerToggles />}
      {showGraph && hudVisible && <BottomControls cameraRef={cameraRef} onLoadNew={handleLoadNew} />}
      {showGraph && hudVisible && <HoverTooltip />}
      {showGraph && hudVisible && <LayoutSettings />}
    </>
  );
}
