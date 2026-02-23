export type WidgetType = 'page' | 'object' | 'button' | 'label' | 'arc' | 'bar' | 'slider' | 'switch';

export interface StyleProperties {
    bg_color?: string;
    bg_opa?: number;
    text_color?: string;
    text_font?: string;
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
    fontFamily?: string; // The actual font family (file name)
    size?: number; // Optional size (e.g. for fonts or icons)
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
    selectedId: string | null;
    assets: Asset[];
    substitutions: Record<string, string>;
    canvasConfig: CanvasConfig;
    gridConfig: GridConfig;

    // Actions
    addWidget: (parentId: string | null, widget: WidgetNode) => void;
    updateWidget: (id: string, updates: Partial<WidgetNode>) => void;
    removeWidget: (id: string) => void;
    setSelectedId: (id: string | null) => void;
    moveWidget: (id: string, parentId: string | null, index: number) => void;
    loadState: (widgets: WidgetNode[]) => void;
    setCanvasSize: (width: number, height: number) => void;
    addCanvasPreset: (preset: Resolution) => void;
    setZoom: (zoom: number) => void;
    setViewMode: (mode: '1:1' | 'fit') => void;
    setGridConfig: (config: Partial<GridConfig>) => void;

    // Asset Actions
    addAsset: (asset: Asset) => void;
    removeAsset: (id: string) => void;
    loadAssets: (assets: Asset[]) => void;
    setSubstitutions: (subs: Record<string, string>) => void;
}
