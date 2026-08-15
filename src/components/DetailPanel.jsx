import { useGraphStore } from '../store/useGraphStore.js';
import { useShallow } from 'zustand/react/shallow';
import { getNodeColor, getDeptColor } from '../lib/colors.js';

function Section({ title, items }) {
  if (!items.length) return null;
  return (
    <div className="mt-2.5">
      <div className="text-[11px] uppercase text-gray-500 mb-1">{title}</div>
      <div className="flex flex-wrap gap-1">{items}</div>
    </div>
  );
}

function NodeButton({ node, onSelect }) {
  const color = getNodeColor(node);
  return (
    <button
      onClick={() => onSelect(node.id)}
      style={{ color }}
      className="bg-transparent border-0 p-0 cursor-pointer underline text-[inherit]"
    >
      {node.label || node.id}
    </button>
  );
}

export default function DetailPanel() {
  const { selectedNodeId, rawData, setSelectedNodeId } = useGraphStore(useShallow(s => ({
    selectedNodeId: s.selectedNodeId,
    rawData: s.rawData,
    setSelectedNodeId: s.setSelectedNodeId,
  })));

  if (!selectedNodeId || !rawData) return null;
  const selectedNode = rawData.nodes.find(n => n.id === selectedNodeId);
  if (!selectedNode) return null;

  const { nodes, edges } = rawData;
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  function findNode(id) { return nodeMap.get(id) ?? null; }
  function makeButtons(nodeList) {
    return nodeList.map(n => <NodeButton key={n.id} node={n} onSelect={setSelectedNodeId} />);
  }

  let badgeColor;
  if (selectedNode.type === 'person') badgeColor = getDeptColor(selectedNode.department);
  else if (selectedNode.type === 'project') badgeColor = '#909090';
  else badgeColor = '#e8a030';

  let sections = null;

  if (selectedNode.type === 'person') {
    const overseesEdges = edges.filter(e => e.type === 'oversees' && e.source === selectedNode.id);
    sections = (
      <>
        <Section title="Department" items={[<span key="d" style={{ color: badgeColor }}>{selectedNode.department || '—'}</span>]} />
        <Section title="Reports to" items={makeButtons(edges.filter(e => e.type === 'reports-to' && e.source === selectedNode.id).map(e => findNode(e.target)).filter(Boolean))} />
        <Section title="Direct reports" items={makeButtons(edges.filter(e => e.type === 'reports-to' && e.target === selectedNode.id).map(e => findNode(e.source)).filter(Boolean))} />
        <Section title="Oversees (themes)" items={makeButtons(overseesEdges.map(e => findNode(e.target)).filter(n => n?.type === 'theme'))} />
        <Section title="Works on" items={makeButtons(edges.filter(e => e.type === 'works-on' && e.source === selectedNode.id).map(e => findNode(e.target)).filter(Boolean))} />
        <Section title="Oversees (projects)" items={makeButtons(overseesEdges.map(e => findNode(e.target)).filter(n => n?.type === 'project'))} />
      </>
    );
  } else if (selectedNode.type === 'project') {
    sections = (
      <>
        <Section title="Team" items={makeButtons(edges.filter(e => e.type === 'works-on' && e.target === selectedNode.id).map(e => findNode(e.source)).filter(Boolean))} />
        <Section title="Led by" items={makeButtons(edges.filter(e => e.type === 'oversees' && e.target === selectedNode.id).map(e => findNode(e.source)).filter(Boolean))} />
      </>
    );
  } else if (selectedNode.type === 'theme') {
    const parentNode = selectedNode.parent ? findNode(selectedNode.parent) : null;
    const childThemes = nodes.filter(n => n.type === 'theme' && n.parent === selectedNode.id);
    const overseerNodes = edges.filter(e => e.type === 'oversees' && e.target === selectedNode.id).map(e => findNode(e.source)).filter(n => n?.type === 'person');
    const projectEdges = edges.filter(e => e.type === 'belongs-to' && e.target === selectedNode.id);
    const projectNodes = [...new Map(projectEdges.map(e => findNode(e.source)).filter(n => n?.type === 'project').map(n => [n.id, n])).values()];
    sections = (
      <>
        <Section title="Parent theme" items={parentNode ? makeButtons([parentNode]) : []} />
        <Section title="Child themes" items={makeButtons(childThemes)} />
        <Section title="Overseers" items={makeButtons(overseerNodes)} />
        <Section title="Projects under this theme" items={makeButtons(projectNodes)} />
      </>
    );
  }

  return (
    <div className="fixed bottom-5 left-5 w-64 max-h-[70vh] overflow-y-auto bg-black/90 border border-white/10 rounded-lg p-4 text-[#e0e0e0] font-sans text-[13px] z-10">
      <div className="mb-2">
        <span className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-black" style={{ background: badgeColor }}>
          {selectedNode.type}
        </span>
      </div>
      <div className="font-bold text-[15px] mb-1">{selectedNode.label || selectedNode.id}</div>
      {sections}
    </div>
  );
}
