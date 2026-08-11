import { useState, useEffect } from 'react';
import { useGraphStore } from '../store/useGraphStore.js';
import { getTooltipContent } from '../lib/tooltip.js';

export default function HoverTooltip() {
  const hoveredNodeId = useGraphStore(s => s.hoveredNodeId);
  const rawData = useGraphStore(s => s.rawData);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    return () => useGraphStore.getState().setHoveredNodeId(null);
  }, []);

  useEffect(() => {
    if (!hoveredNodeId) return;
    function onMove(e) { setPos({ x: e.clientX, y: e.clientY }); }
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [hoveredNodeId]);

  if (!hoveredNodeId || !rawData) return null;
  const node = rawData.nodes.find(n => n.id === hoveredNodeId);
  if (!node) return null;

  const content = getTooltipContent(node, rawData);
  if (!content) return null;

  const x = Math.max(8, Math.min(pos.x + 12, window.innerWidth - 160));
  const y = Math.max(8, Math.min(pos.y + 12, window.innerHeight - 60));

  return (
    <div
      className="fixed bg-black/90 border border-white/10 rounded-md px-3 py-1.5 text-[13px] text-[#e0e0e0] pointer-events-none z-20"
      style={{ left: x, top: y }}
    >
      <div>{content.line1}</div>
      {content.line2 && <div className="text-[11px] text-gray-400">{content.line2}</div>}
    </div>
  );
}
