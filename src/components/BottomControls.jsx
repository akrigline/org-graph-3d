import { useGraphStore } from '../store/useGraphStore.js';

const DEFAULT_CAMERA_Z = 500;

export default function BottomControls({ cameraRef, onLoadNew }) {
  const clearSelection = useGraphStore(s => s.clearSelection);

  function handleResetCamera() {
    const cam = cameraRef?.current;
    if (!cam) return;
    cam.position.set(0, 0, DEFAULT_CAMERA_Z);
    cam.lookAt(0, 0, 0);
  }

  const btnClass = 'px-3 py-1.5 rounded border border-[rgba(100,130,160,0.35)] bg-[rgba(40,55,75,0.7)] text-[rgba(200,220,240,0.9)] cursor-pointer text-[12px] font-medium whitespace-nowrap';

  return (
    <div className="fixed bottom-5 right-5 flex gap-1.5 bg-black/80 border border-white/10 rounded-xl px-2.5 py-2 z-10">
      <button className={btnClass} onClick={handleResetCamera}>Reset Camera</button>
      <button className={btnClass} onClick={clearSelection}>Clear Selection</button>
      <button className={btnClass} onClick={onLoadNew}>Load New File</button>
    </div>
  );
}
