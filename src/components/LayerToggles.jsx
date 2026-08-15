import { useGraphStore } from '../store/useGraphStore.js';
import { useShallow } from 'zustand/react/shallow';

const BUTTONS = [
  { key: 'org', label: 'Org' },
  { key: 'oversight', label: 'Oversight' },
  { key: 'work', label: 'Work' },
  { key: 'themes', label: 'Themes' },
  { key: 'projects', label: 'Projects' },
];

export default function LayerToggles() {
  const { layers, toggleLayer } = useGraphStore(useShallow(s => ({ layers: s.layers, toggleLayer: s.toggleLayer })));

  return (
    <div className="fixed top-5 right-5 flex gap-1.5 z-10">
      {BUTTONS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => toggleLayer(key)}
          className={`px-3 py-1 rounded-full text-[12px] font-semibold border cursor-pointer transition-opacity ${
            layers[key]
              ? 'bg-blue-400/85 border-blue-400 text-black opacity-100'
              : 'bg-[rgba(30,30,40,0.75)] border-[rgba(100,130,160,0.4)] text-[rgba(180,200,220,0.45)] opacity-70'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
