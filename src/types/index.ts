export type WidgetType = 'page' | 'object' | 'button' | 'label' | 'arc' | 'bar' | 'slider' | 'switch' | 'checkbox' | 'spinbox' | 'dropdown' | 'roller' | 'textarea' | 'led';

export interface StyleProperties {
    bg_color?: string;
    bg_opa?: number;
    text_color?: string;
    text_font?: string;
    text_align?: 'LEFT' | 'CENTER' | 'RIGHT';
    radius?: number;
    border_width?: number;
    border_color?: string;
    pad_all?: number;
    pad_top?: number;
    pad_bottom?: number;
    pad_left?: number;
    pad_right?: number;
    shadow_width?: number;
    shadow_color?: string;
    shadow_ofs_x?: number;
    shadow_ofs_y?: number;
    // New style properties
    line_width?: number;
    line_color?: string;
    arc_width?: number;
    arc_color?: string;
}

export type StyleState = 'DEFAULT' | 'CHECKED' | 'FOCUSED' | 'PRESSED' | 'DISABLED';

export interface StyleReference {
    style_id?: string;
    state?: StyleState;
    styles?: StyleProperties;
}

export interface WidgetNode {
    id: string;
    type: WidgetType;
    name: string; // The ESPHome ID/name
    x: number | string;
    y: number | string;
    width: number | string;
    height: number | string;
    text?: string;
    align?: string;

    // Core states
    hidden?: boolean;
    clickable?: boolean;
    checkable?: boolean;
    checked?: boolean;
    class_names?: string[]; // Kept for backward compatibility, but we will migrate to style_references
    style_references?: StyleReference[];

    // Specific Widget Props
    options?: string; // For dropdown/roller (e.g. "Opt1\nOpt2")
    long_mode?: 'WRAP' | 'DOT' | 'SCROLL' | 'SCROLL_CIRC' | 'CLIP';
    min_value?: number;
    max_value?: number;
    value?: number;
    range_min?: number; // fallback for range
    range_max?: number;
    rotation?: number;
    start_angle?: number;
    end_angle?: number;

    layout?: {
        type: 'flex' | 'grid' | 'absolute';
        flex_flow?: 'row' | 'column' | 'row_wrap' | 'column_wrap';
        flex_align_main?: 'start' | 'center' | 'end' | 'space_between' | 'space_around' | 'space_evenly';
        flex_align_cross?: 'start' | 'center' | 'end' | 'stretch';
        flex_grow?: number;
        grid_dsc_cols?: (number | string)[];
        grid_dsc_rows?: (number | string)[];
        pad_row?: number;
        pad_column?: number;
        [key: string]: any;
    };
    grid_cell_column_pos?: number;
    grid_cell_column_span?: number;
    grid_cell_row_pos?: number;
    grid_cell_row_span?: number;
    grid_cell_x_align?: 'start' | 'center' | 'end' | 'stretch';
    grid_cell_y_align?: 'start' | 'center' | 'end' | 'stretch';
    styles?: StyleProperties;
    children: WidgetNode[];
}

export interface Asset {
    id: string;
    name: string;
    type: 'icon' | 'font';
    value: string; // The font ID (handle) or Icon text
    family?: string; // The actual font family (e.g. "Roboto")
    size?: number; // Optional size
    source?: string; // ESPHome file path (e.g. "gfonts://Roboto" or "fonts/arial.ttf")
}

export interface Resolution {
    name: string;
    width: number;
    height: number;
}

export interface GridConfig {
    enabled: boolean;
    size: number;
    visible: boolean;
}

export interface CanvasConfig {
    width: number;
    height: number;
    presets: Resolution[];
    zoom: number;
    viewMode: '1:1' | 'fit';
}

export interface EditorState {
    widgets: WidgetNode[];
    selectedIds: string[];
    assets: Asset[];
    substitutions: Record<string, string>;
    global_styles: Record<string, StyleProperties>;
    canvasConfig: CanvasConfig;
    gridConfig: GridConfig;
    clipboard: WidgetNode | null;
    clipboardOffset: number;

    // History
    past: WidgetNode[][];
    future: WidgetNode[][];
    canUndo: boolean;
    canRedo: boolean;

    // Actions
    addWidget: (parentId: string | null, widget: WidgetNode) => void;
    updateWidget: (id: string, updates: Partial<WidgetNode>, saveHistory?: boolean) => void;
    removeWidget: (id: string | string[]) => void;
    setSelectedIds: (ids: string[]) => void;
    moveWidget: (id: string, parentId: string | null, index: number) => void;
    copySelectedWidget: () => void;
    pasteWidget: () => void;
    moveSelectedWidgets: (dx: number, dy: number) => void;
    loadState: (widgets: WidgetNode[]) => void;
    setCanvasSize: (width: number, height: number) => void;
    addCanvasPreset: (preset: Resolution) => void;
    setZoom: (zoom: number) => void;
    setViewMode: (mode: '1:1' | 'fit') => void;
    theme: 'dark' | 'light';
    setTheme: (theme: 'dark' | 'light') => void;
    rawYaml: string | null;
    setRawYaml: (yaml: string | null) => void;
    setGridConfig: (config: Partial<GridConfig>) => void;

    // History
    undo: () => void;
    redo: () => void;
    resetState: () => void;
    pushHistory: () => void;

    // Asset Actions
    addAsset: (asset: Asset) => void;
    removeAsset: (id: string) => void;
    loadAssets: (assets: Asset[]) => void;
    setSubstitutions: (subs: Record<string, string>) => void;

    // Global Styles
    updateGlobalStyle: (className: string, styles: StyleProperties) => void;
    removeGlobalStyle: (className: string) => void;

    // Style Editor State
    styleEditorOpen: boolean;
    editingStyleId: string | null;
    openStyleEditor: (styleId?: string) => void;
    closeStyleEditor: () => void;

    // Emulator State
    emulatorOpen: boolean;
    setEmulatorOpen: (open: boolean) => void;

    // Asset Manager State
    assetManagerOpen: boolean;
    setAssetManagerOpen: (open: boolean) => void;
}
