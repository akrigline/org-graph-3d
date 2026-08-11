import { useState } from 'react';
import { useGraphStore, DEFAULT_LAYOUT_PARAMS } from '../store/useGraphStore.js';

const PARAMS = [
  { key: 'cylinderR',     label: 'Cylinder radius',       min: 40,  max: 400, step: 10 },
  { key: 'outerR',        label: 'Outer rim (root mgr)',  min: 80,  max: 700, step: 10 },
  { key: 'managerStep',   label: 'Manager level spacing', min: 0,   max: 120, step: 5  },
  { key: 'projectSpread', label: 'Project Y spread',      min: 50,  max: 600, step: 10 },
];

const btnClass = 'px-3 py-1.5 rounded border border-[rgba(100,130,160,0.35)] bg-[rgba(40,55,75,0.7)] text-[rgba(200,220,240,0.9)] cursor-pointer text-[12px] font-medium whitespace-nowrap';

export default function LayoutSettings() {
  const [open, setOpen] = useState(false);
  const layoutParams    = useGraphStore(s => s.layoutParams);
  const setLayoutParam  = useGraphStore(s => s.setLayoutParam);
  const resetLayoutParams = useGraphStore(s => s.resetLayoutParams);

  return (
    <div className="fixed top-5 left-5 z-10 flex flex-col items-start gap-2">
      <button
        onClick={() => setOpen(o => !o)}
        className={`${btnClass} ${open ? 'bg-[rgba(59,130,246,0.15)] border-[rgba(96,165,250,0.5)]' : ''}`}
      >
        ⚙ Layout
      </button>

      {open && (
        <div className="bg-black/85 border border-white/10 rounded-xl p-4 w-64 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-[rgba(200,220,240,0.9)] text-[12px] font-semibold tracking-wide uppercase">Layout</span>
            <button
              onClick={() => setOpen(false)}
              className="text-[rgba(180,200,220,0.45)] hover:text-[rgba(200,220,240,0.9)] cursor-pointer text-[16px] leading-none"
            >×</button>
          </div>

          {PARAMS.map(({ key, label, min, max, step }) => (
            <div key={key} className="flex flex-col gap-1">
              <div className="flex justify-between items-baseline">
                <span className="text-[rgba(180,200,220,0.65)] text-[11px]">{label}</span>
                <span className="text-[rgba(200,220,240,0.9)] text-[11px] font-mono w-12 text-right">
                  {layoutParams[key]}
                </span>
              </div>
              <input
                type="range"
                min={min} max={max} step={step}
                value={layoutParams[key]}
                onChange={e => setLayoutParam(key, Number(e.target.value))}
                className="w-full h-1 accent-blue-400 cursor-pointer"
              />
            </div>
          ))}

          <button
            onClick={resetLayoutParams}
            className={`${btnClass} text-[11px] self-end mt-1`}
          >
            Reset defaults
          </button>
        </div>
      )}
    </div>
  );
}
