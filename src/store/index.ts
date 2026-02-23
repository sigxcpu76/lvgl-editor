import { create } from 'zustand';
import { EditorState, WidgetNode } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Helper to find and update a widget in the tree
const updateWidgetInTree = (nodes: WidgetNode[], id: string, updates: Partial<WidgetNode>): WidgetNode[] => {
    return nodes.map(node => {
        if (node.id === id) {
            return { ...node, ...updates };
        }
        if (node.children && node.children.length > 0) {
            return { ...node, children: updateWidgetInTree(node.children, id, updates) };
        }
        return node;
    });
};

// Helper to filter out a widget from the tree
const removeWidgetFromTree = (nodes: WidgetNode[], id: string): WidgetNode[] => {
    return nodes.filter(node => node.id !== id).map(node => {
        if (node.children && node.children.length > 0) {
            return { ...node, children: removeWidgetFromTree(node.children, id) };
        }
        return node;
    });
};

// Helper to add a widget to a specific parent (or root if parentId is null)
const addWidgetToTree = (nodes: WidgetNode[], parentId: string | null, newWidget: WidgetNode): WidgetNode[] => {
    if (parentId === null) {
        return [...nodes, newWidget];
    }
    return nodes.map(node => {
        if (node.id === parentId) {
            return { ...node, children: [...(node.children || []), newWidget] };
        }
        if (node.children && node.children.length > 0) {
            return { ...node, children: addWidgetToTree(node.children, parentId, newWidget) };
        }
        return node;
    });
};

// Helper to find a widget in the tree
const findWidgetInTree = (nodes: WidgetNode[], id: string): WidgetNode | null => {
    for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children && node.children.length > 0) {
            const found = findWidgetInTree(node.children, id);
            if (found) return found;
        }
    }
    return null;
};

// Helper to insert a widget at a specific index
const insertWidgetInTree = (nodes: WidgetNode[], parentId: string | null, newWidget: WidgetNode, index: number): WidgetNode[] => {
    if (parentId === null) {
        const newNodes = [...nodes];
        newNodes.splice(index, 0, newWidget);
        return newNodes;
    }
    return nodes.map(node => {
        if (node.id === parentId) {
            const newChildren = [...(node.children || [])];
            newChildren.splice(index, 0, newWidget);
            return { ...node, children: newChildren };
        }
        if (node.children && node.children.length > 0) {
            return { ...node, children: insertWidgetInTree(node.children, parentId, newWidget, index) };
        }
        return node;
    });
};

const initialWidgets: WidgetNode[] = [
    {
        id: uuidv4(),
        type: 'page',
        name: 'main_page',
        x: 0,
        y: 0,
        width: '100%',
        height: '100%',
        styles: {
            bg_color: '#000000',
        },
        children: [
            {
                id: uuidv4(),
                type: 'label',
                name: 'title_label',
                text: 'ESPHome LVGL Demo',
                x: 20,
                y: 20,
                width: 200,
                height: 30,
                styles: {
                    text_color: '#00ff00',
                },
                children: []
            },
            {
                id: uuidv4(),
                type: 'button',
                name: 'action_btn',
                text: 'Click Me',
                x: 100,
                y: 200,
                width: 120,
                height: 50,
                align: 'CENTER',
                styles: {
                    bg_color: '#007acc',
                    radius: 8,
                },
                children: []
            }
        ]
    }
];

export const useStore = create<EditorState>((set) => ({
    widgets: initialWidgets,
    selectedId: null,
    assets: [],
    substitutions: {},
    canvasConfig: {
        width: 480,
        height: 480,
        presets: [
            { name: 'Guition (1:1)', width: 480, height: 480 },
            { name: 'QVGA Landscape', width: 320, height: 240 },
            { name: 'QVGA Portrait', width: 240, height: 320 },
            { name: '7" Display', width: 800, height: 480 },
            { name: '10" Display', width: 1024, height: 600 },
        ],
        zoom: 1.0,
        viewMode: '1:1',
    },
    gridConfig: {
        enabled: true,
        size: 10,
        visible: true,
    },

    addWidget: (parentId, widget) =>
        set((state) => ({
            widgets: addWidgetToTree(state.widgets, parentId, widget)
        })),

    updateWidget: (id, updates) =>
        set((state) => ({
            widgets: updateWidgetInTree(state.widgets, id, updates)
        })),

    removeWidget: (id) =>
        set((state) => ({
            widgets: removeWidgetFromTree(state.widgets, id),
            // clear selection if we deleted the selected widget
            selectedId: state.selectedId === id ? null : state.selectedId
        })),

    setSelectedId: (id) =>
        set({ selectedId: id }),

    // For DND reordering
    moveWidget: (id, parentId, index) =>
        set((state) => {
            const widget = findWidgetInTree(state.widgets, id);
            if (!widget) return state;
            const treeWithoutWidget = removeWidgetFromTree(state.widgets, id);
            return {
                widgets: insertWidgetInTree(treeWithoutWidget, parentId, widget, index)
            };
        }),

    loadState: (widgets) => set({ widgets }),

    setCanvasSize: (width, height) =>
        set((state) => ({
            canvasConfig: { ...state.canvasConfig, width, height }
        })),

    addCanvasPreset: (preset) =>
        set((state) => ({
            canvasConfig: {
                ...state.canvasConfig,
                presets: [...state.canvasConfig.presets, preset]
            }
        })),

    setZoom: (zoom) =>
        set((state) => ({
            canvasConfig: { ...state.canvasConfig, zoom }
        })),

    setViewMode: (viewMode) =>
        set((state) => ({
            canvasConfig: { ...state.canvasConfig, viewMode }
        })),

    setGridConfig: (config) =>
        set((state) => ({
            gridConfig: { ...state.gridConfig, ...config }
        })),

    addAsset: (asset) =>
        set((state) => ({
            assets: [...state.assets, asset]
        })),

    removeAsset: (id) =>
        set((state) => ({
            assets: state.assets.filter(a => a.id !== id)
        })),

    loadAssets: (assets) => set({ assets }),
    setSubstitutions: (substitutions) => set({ substitutions }),
}));
