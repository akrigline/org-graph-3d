import { create } from 'zustand';
import { getFocusSet } from '../lib/focusSet.js';

export const DEFAULT_LAYOUT_PARAMS = {
  cylinderR:     120,
  outerR:        240,
  managerStep:    40,
  projectSpread: 200,
};

export const useGraphStore = create((set, get) => ({
  rawData: null,
  selectedNodeId: null,
  hoveredNodeId: null,
  focusNodeId: null,
  focusSet: new Set(),
  hudVisible: true,
  layers: { org: true, oversight: true, work: true, themes: true, projects: true },
  layoutParams: { ...DEFAULT_LAYOUT_PARAMS },

  setRawData: (data) => set({ rawData: data, selectedNodeId: null, hoveredNodeId: null, focusNodeId: null, focusSet: new Set() }),

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setHoveredNodeId: (id) => set({ hoveredNodeId: id }),
  toggleHUD: () => set(s => ({ hudVisible: !s.hudVisible })),

  toggleLayer: (name) => set(s => ({ layers: { ...s.layers, [name]: !s.layers[name] } })),

  setFocusNodeId: (id) => {
    if (!id) { set({ focusNodeId: null, focusSet: new Set() }); return; }
    const raw = get().rawData;
    if (!raw) return;
    const focusNode = raw.nodes.find(n => n.id === id);
    const focusSet = focusNode ? getFocusSet(focusNode, raw) : new Set();
    set({ focusNodeId: id, focusSet });
  },

  setLayoutParam: (key, value) => set(s => ({ layoutParams: { ...s.layoutParams, [key]: value } })),
  resetLayoutParams: () => set({ layoutParams: { ...DEFAULT_LAYOUT_PARAMS } }),

  clearSelection: () => set({ selectedNodeId: null }),

  resetAll: () => set({
    rawData: null,
    selectedNodeId: null,
    hoveredNodeId: null,
    focusNodeId: null,
    focusSet: new Set(),
    hudVisible: true,
  }),
}));
