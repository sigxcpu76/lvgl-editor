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

// Helper to filter out multiple widgets from the tree
const removeWidgetsFromTree = (nodes: WidgetNode[], ids: string[]): WidgetNode[] => {
    return nodes.filter(node => !ids.includes(node.id)).map(node => {
        if (node.children && node.children.length > 0) {
            return { ...node, children: removeWidgetsFromTree(node.children, ids) };
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
    selectedIds: [],
    assets: [],
    substitutions: {},
    global_styles: {},
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
    clipboard: null,
    clipboardOffset: 0,
    theme: 'dark',
    setTheme: (theme) => set({ theme }),
    rawYaml: null,
    setRawYaml: (rawYaml) => set({ rawYaml }),

    styleEditorOpen: false,
    editingStyleId: null,
    openStyleEditor: (styleId) => set({ styleEditorOpen: true, editingStyleId: styleId || null }),
    closeStyleEditor: () => set({ styleEditorOpen: false, editingStyleId: null }),

    emulatorOpen: false,
    setEmulatorOpen: (emulatorOpen) => set({ emulatorOpen }),

    assetManagerOpen: false,
    setAssetManagerOpen: (assetManagerOpen) => set({ assetManagerOpen }),

    // History
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,

    undo: () => set((state) => {
        if (state.past.length === 0) return state;
        const previous = state.past[state.past.length - 1];
        const newPast = state.past.slice(0, state.past.length - 1);
        return {
            past: newPast,
            widgets: previous,
            future: [state.widgets, ...state.future],
            canUndo: newPast.length > 0,
            canRedo: true
        };
    }),

    redo: () => set((state) => {
        if (state.future.length === 0) return state;
        const next = state.future[0];
        const newFuture = state.future.slice(1);
        return {
            past: [...state.past, state.widgets],
            widgets: next,
            future: newFuture,
            canUndo: true,
            canRedo: newFuture.length > 0
        };
    }),

    resetState: () => set({
        widgets: initialWidgets,
        past: [],
        future: [],
        canUndo: false,
        canRedo: false,
        selectedIds: [],
        assets: [],
        substitutions: {},
        global_styles: {}
    }),

    pushHistory: () => set((state) => ({
        past: [...state.past, state.widgets],
        future: [],
        canUndo: true,
        canRedo: false
    })),

    addWidget: (parentId, widget) =>
        set((state) => {
            const newWidgets = addWidgetToTree(state.widgets, parentId, widget);
            return {
                past: [...state.past, state.widgets],
                future: [],
                widgets: newWidgets,
                selectedIds: [widget.id],
                canUndo: true,
                canRedo: false
            };
        }),

    updateWidget: (id, updates, saveHistory = true) =>
        set((state) => {
            const newWidgets = updateWidgetInTree(state.widgets, id, updates);
            if (saveHistory) {
                return {
                    past: [...state.past, state.widgets],
                    future: [],
                    widgets: newWidgets,
                    canUndo: true,
                    canRedo: false
                };
            }
            return {
                widgets: newWidgets
            };
        }),

    removeWidget: (idOrIds) =>
        set((state) => {
            const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
            const newWidgets = removeWidgetsFromTree(state.widgets, ids);
            return {
                past: [...state.past, state.widgets],
                future: [],
                widgets: newWidgets,
                selectedIds: state.selectedIds.filter(sid => !ids.includes(sid)),
                canUndo: true,
                canRedo: false
            };
        }),

    setSelectedIds: (ids) =>
        set({ selectedIds: ids }),

    // For DND reordering
    moveWidget: (id, parentId, index) =>
        set((state) => {
            const widget = findWidgetInTree(state.widgets, id);
            if (!widget) return state;
            const treeWithoutWidget = removeWidgetsFromTree(state.widgets, [id]);
            const newWidgets = insertWidgetInTree(treeWithoutWidget, parentId, widget, index);
            return {
                past: [...state.past, state.widgets],
                future: [],
                widgets: newWidgets,
                canUndo: true,
                canRedo: false
            };
        }),

    copySelectedWidget: () => set((state) => {
        if (state.selectedIds.length === 0) return state;
        const mainId = state.selectedIds[0];
        const widget = findWidgetInTree(state.widgets, mainId);
        if (!widget || widget.type === 'page') return state;
        return {
            clipboard: widget,
            clipboardOffset: 10
        };
    }),

    pasteWidget: () => set((state) => {
        if (!state.clipboard) return state;

        let parentId: string | null = null;
        if (state.selectedIds.length > 0) {
            const mainId = state.selectedIds[0];
            const selectedWidget = findWidgetInTree(state.widgets, mainId);
            if (selectedWidget) {
                if (selectedWidget.type === 'page') {
                    parentId = selectedWidget.id;
                } else {
                    const findParent = (nodes: WidgetNode[], targetId: string): string | null => {
                        for (const node of nodes) {
                            if (node.children?.some(c => c.id === targetId)) return node.id;
                            const pId = findParent(node.children || [], targetId);
                            if (pId) return pId;
                        }
                        return null;
                    };
                    parentId = findParent(state.widgets, mainId);
                }
            }
        }

        if (!parentId && state.widgets.length > 0) {
            parentId = state.widgets[0].id;
        }

        const cloneWidget = (node: WidgetNode, offset: number): WidgetNode => {
            const newId = uuidv4();
            return {
                ...node,
                id: newId,
                name: `${node.name}_copy`,
                x: typeof node.x === 'number' ? node.x + offset : node.x,
                y: typeof node.y === 'number' ? node.y + offset : node.y,
                children: (node.children || []).map(child => cloneWidget(child, 0))
            };
        };

        const newWidget = cloneWidget(state.clipboard, state.clipboardOffset);
        const newWidgets = addWidgetToTree(state.widgets, parentId, newWidget);

        return {
            past: [...state.past, state.widgets],
            future: [],
            widgets: newWidgets,
            selectedIds: [newWidget.id],
            clipboardOffset: state.clipboardOffset + 10,
            canUndo: true,
            canRedo: false
        };
    }),

    loadState: (widgets) => set({
        widgets,
        past: [],
        future: [],
        canUndo: false,
        canRedo: false
    }),

    moveSelectedWidgets: (dx, dy) => set((state) => {
        if (state.selectedIds.length === 0) return state;

        const moveNode = (nodes: WidgetNode[]): WidgetNode[] => {
            return nodes.map(node => {
                let newNode = node;
                if (state.selectedIds.includes(node.id)) {
                    const nx = typeof node.x === 'number' ? node.x + dx : node.x;
                    const ny = typeof node.y === 'number' ? node.y + dy : node.y;
                    newNode = { ...node, x: nx, y: ny };
                }
                if (newNode.children && newNode.children.length > 0) {
                    newNode = { ...newNode, children: moveNode(newNode.children) };
                }
                return newNode;
            });
        };

        const newWidgets = moveNode(state.widgets);
        return {
            past: [...state.past, state.widgets],
            future: [],
            widgets: newWidgets,
            canUndo: true,
            canRedo: false
        };
    }),

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
    setGlobalStyles: (global_styles) => set({ global_styles }),

    updateGlobalStyle: (className, styles) => set((state) => ({
        global_styles: {
            ...state.global_styles,
            [className]: styles
        }
    })),

    removeGlobalStyle: (className) => set((state) => {
        const newStyles = { ...state.global_styles };
        delete newStyles[className];
        return { global_styles: newStyles };
    }),
}));

// Persistence logic
const STORAGE_KEY = 'lvgl-editor-state';

const saveState = (state: EditorState) => {
    const data = {
        widgets: state.widgets,
        assets: state.assets,
        substitutions: state.substitutions,
        global_styles: state.global_styles,
        canvasConfig: state.canvasConfig,
        gridConfig: state.gridConfig,
        theme: state.theme,
        rawYaml: state.rawYaml
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const loadStateFromStorage = () => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        try {
            return JSON.parse(data);
        } catch (e) {
            console.error('Failed to parse stored state', e);
        }
    }
    return null;
};

// Subscribe to changes and save
useStore.subscribe((state, prevState) => {
    if (state.widgets !== prevState.widgets ||
        state.assets !== prevState.assets ||
        state.substitutions !== prevState.substitutions ||
        state.global_styles !== prevState.global_styles ||
        state.canvasConfig !== prevState.canvasConfig ||
        state.gridConfig !== prevState.gridConfig ||
        state.theme !== prevState.theme ||
        state.rawYaml !== prevState.rawYaml) {
        saveState(state);
    }
});
