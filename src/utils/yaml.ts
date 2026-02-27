import { Document, parseDocument } from 'yaml';
import { WidgetNode, WidgetType, StyleProperties, StyleReference } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Parses ESPHome LVGL YAML into our internal WidgetNode tree format.
 * Uses YAML CST to preserve node identities for non-destructive exporting later.
 */
export class YamlEngine {
    private yamlDoc: Document | null = null;
    private styles: Map<string, StyleProperties> = new Map();
    private substitutions: Map<string, string> = new Map();
    private fontMap: Map<string, string> = new Map();
    private assets: any[] = [];

    constructor() { }

    /**
     * Parses the full ESPHome YAML string.
     * Extracts the 'lvgl' section from 'display' or top-level.
     */
    parse(yamlString: string): { widgets: WidgetNode[], assets: any[], substitutions: Record<string, string>, global_styles: Record<string, StyleProperties> } {
        try {
            this.yamlDoc = parseDocument(yamlString);
            if (!this.yamlDoc || !this.yamlDoc.contents) return { widgets: [], assets: [], substitutions: {}, global_styles: {} };

            this.styles.clear();
            this.substitutions.clear();
            this.assets = [];
            this.fontMap.clear();

            // 1. Extract global substitutions
            const subs = this.yamlDoc.get('substitutions') as any;
            if (subs && subs.items) {
                for (const item of subs.items) {
                    const keyNode = (item.key && item.key.value !== undefined) ? item.key : { value: String(item.key) };
                    const valNode = (item.value && item.value.value !== undefined) ? item.value : { value: String(item.value) };
                    this.substitutions.set(String(keyNode.value), String(valNode.value));
                }
            }

            // 2. Extract fonts
            const assets: any[] = [];
            const fonts = this.yamlDoc.get('font') as any;
            if (fonts && fonts.items) {
                for (const fontItem of fonts.items) {
                    const id = fontItem.get('id');
                    const file = fontItem.get('file');
                    if (id && file) {
                        const styleId = String(this.resolveText(id));
                        const size = fontItem.get('size');
                        this.fontMap.set(styleId, String(file));
                        assets.push({
                            id: uuidv4(),
                            name: styleId,
                            type: 'font',
                            value: styleId,
                            family: styleId, // Default family to ID if not specified, ESPHome uses ID for style
                            size: size ? Number(this.resolveText(size)) : undefined,
                            source: String(file)
                        });

                        // Also extract glyphs as individual icon assets if they are in the font
                        const glyphs = fontItem.get('glyphs');
                        if (glyphs && glyphs.items) {
                            for (const glyph of glyphs.items) {
                                const rawVal = String(glyph.value || glyph);
                                const val = this.resolveText(rawVal);
                                if (val) {
                                    assets.push({
                                        id: uuidv4(),
                                        name: `Glyph ${rawVal}`,
                                        type: 'icon',
                                        value: val,
                                        fontFamily: String(file)
                                    });
                                }
                            }
                        }
                    }
                }
            }

            // 2. Find the LVGL section anywhere in the tree (limit depth to be safe)
            const lvglNode = this.findLvglNode(this.yamlDoc.contents, 0);

            if (!lvglNode) {
                console.warn("No LVGL configuration found in YAML");
                const subsRecord: Record<string, string> = {};
                this.substitutions.forEach((v, k) => subsRecord[k] = v);
                return { widgets: [], assets, substitutions: subsRecord, global_styles: {} };
            }

            // 3. Resolve style definitions
            if (typeof lvglNode.has === 'function' && lvglNode.has('style_definitions')) {
                const styleDefs = lvglNode.get('style_definitions');
                if (styleDefs && styleDefs.items) {
                    for (const defItem of styleDefs.items) {
                        const id = defItem.get('id');
                        if (id) {
                            this.styles.set(String(this.resolveText(id)), this.parseStyles(defItem));
                        }
                    }
                }
            }

            const widgets = this.parseLvglTree(lvglNode);

            // Default first level (pages) to 480x480 if they are 'object' or 'page' types and have no x/y
            for (const w of widgets) {
                if ((w.type === 'object' || w.type === 'page') && (w.width === 100 || w.width === 0) && (w.height === 100 || w.height === 0)) {
                    w.width = 480;
                    w.height = 480;
                }
            }

            const subsRecord: Record<string, string> = {};
            this.substitutions.forEach((v, k) => subsRecord[k] = v);

            const globalStyles: Record<string, StyleProperties> = {};
            this.styles.forEach((v, k) => globalStyles[k] = v);

            this.assets = assets;
            return { widgets, assets, substitutions: subsRecord, global_styles: globalStyles };
        } catch (e) {
            console.error("YAML Parse Error:", e);
            return { widgets: [], assets: [], substitutions: {}, global_styles: {} };
        }
    }

    private resolveFont(fontId: any): string {
        return this.resolveText(fontId);
    }

    private resolveText(text: any, options: { resolveSubs?: boolean } = { resolveSubs: true }): string {
        if (text === null || text === undefined) return '';
        let str = String((text && text.value !== undefined) ? text.value : text);

        // Handle ESPHome \U and \u hex escapes
        str = str.replace(/\\U([0-9A-Fa-f]{8})/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
        str = str.replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

        if (options.resolveSubs) {
            // Resolve substitutions ${name} or $name
            this.substitutions.forEach((val, key) => {
                str = str.replace(new RegExp(`\\$\\{${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g'), val);
                str = str.replace(new RegExp(`\\$${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-zA-Z0-9_])`, 'g'), val);
            });
        }

        return str;
    }

    private findLvglNode(node: any, depth: number): any {
        if (!node || depth > 30) return null;

        // If it's a map, check for 'lvgl' key
        if (typeof node.has === 'function' && node.has('lvgl')) {
            return node.get('lvgl');
        }

        // Broaden search: if it's a map or sequence, look inside
        if (node.items) {
            for (const item of node.items) {
                // For Maps, items are Pairs. For Seqs, they are Nodes.
                const value = (item && item.value !== undefined) ? item.value : item;
                if (value === node) continue; // Basic cycle protection
                const found = this.findLvglNode(value, depth + 1);
                if (found) return found;
            }
        }

        return null;
    }

    private parseLvglTree(lvglNode: any): WidgetNode[] {
        let widgets: WidgetNode[] = [];

        if (!lvglNode || (typeof lvglNode.has !== 'function' && !lvglNode.items)) return [];

        // 1. Check for direct list of widgets (SEQ)
        if (lvglNode.type === 'SEQ') {
            return lvglNode.items.map((item: any) => this.parseWidgetNode(item)).filter(Boolean);
        }

        // 2. Check for 'pages' key
        if (typeof lvglNode.has === 'function' && lvglNode.has('pages')) {
            const pagesNode = lvglNode.get('pages');
            if (pagesNode && pagesNode.items) {
                for (const pageItem of pagesNode.items) {
                    // Each page is effectively a screen-level object
                    const pageWidget = this.parseWidgetNode(pageItem, 'page');
                    if (pageWidget) widgets.push(pageWidget);
                }
            }
        }

        // 3. Check for 'widgets' key (at top level or alongside pages)
        if (typeof lvglNode.has === 'function' && lvglNode.has('widgets')) {
            const widgetsNode = lvglNode.get('widgets');
            if (widgetsNode && widgetsNode.items) {
                for (const item of widgetsNode.items) {
                    const w = this.parseWidgetNode(item);
                    if (w) widgets.push(w);
                }
            }
        }

        // 4. Fallback: if it's a map and we haven't found anything, maybe it *is* the widget?
        if (widgets.length === 0 && lvglNode.type === 'MAP') {
            const w = this.parseWidgetNode(lvglNode);
            if (w) widgets.push(w);
        }

        return widgets;
    }

    private parseWidgetNode(yamlMap: any, forceType?: WidgetType): WidgetNode | null {
        if (!yamlMap || !yamlMap.items) {
            console.log("parseWidgetNode: no items or null map");
            return null;
        }

        // Known widget types in ESPHome LVGL
        const knownTypes: Record<string, WidgetType> = {
            'page': 'page',
            'label': 'label',
            'button': 'button',
            'btn': 'button',
            'obj': 'object',
            'object': 'object',
            'arc': 'arc',
            'bar': 'bar',
            'slider': 'slider',
            'switch': 'switch',
            'checkbox': 'checkbox',
            'spinbox': 'spinbox',
            'dropdown': 'dropdown',
            'roller': 'roller',
            'textarea': 'textarea',
            'led': 'led'
        };

        let foundType: WidgetType | null = forceType || null;
        let propsNode: any = null;
        let actions: Record<string, any> = {};

        // Loop through all items to find type AND capture any on_ actions at this level
        if (yamlMap.items) {
            for (const pair of yamlMap.items) {
                const key = this.resolveText(pair.key);
                if (knownTypes[key] && !foundType) {
                    foundType = knownTypes[key];
                    propsNode = pair.value;
                }
                if (key && key.startsWith('on_')) {
                    actions[key] = pair.value.toJSON ? pair.value.toJSON() : pair.value;
                }
            }
        }

        if (!foundType && forceType) foundType = forceType;
        if (!foundType) return null;

        const finalPropsNode = (propsNode && (propsNode.type === 'MAP' || propsNode.items)) ? propsNode : yamlMap;

        // If propsNode is a map, also capture actions from it
        if (finalPropsNode && finalPropsNode !== yamlMap && finalPropsNode.items) {
            for (const pair of finalPropsNode.items) {
                const key = this.resolveText(pair.key);
                if (key && key.startsWith('on_')) {
                    actions[key] = pair.value.toJSON ? pair.value.toJSON() : pair.value;
                }
            }
        }

        let name = `${foundType}_${uuidv4().slice(0, 4)}`;
        let x: number | string = 0;
        let y: number | string = 0;
        let width: number | string = 'size_content';
        let height: number | string = 'size_content';
        let text: string | undefined = undefined;
        let align: string | undefined = undefined;
        let layout: any = undefined;
        let styles: StyleProperties = {};
        let grid_cell_column_pos: number | undefined = undefined;
        let grid_cell_column_span: number | undefined = undefined;
        let grid_cell_row_pos: number | undefined = undefined;
        let grid_cell_row_span: number | undefined = undefined;
        let grid_cell_x_align: string | undefined = undefined;
        let grid_cell_y_align: string | undefined = undefined;

        let class_names: string[] | undefined = undefined;
        let options: string | undefined = undefined;

        let hidden: boolean | undefined = undefined;
        let clickable: boolean | undefined = undefined;
        let checkable: boolean | undefined = undefined;
        let checked: boolean | undefined = undefined;
        let long_mode: any = undefined;
        let min_value: number | undefined = undefined;
        let max_value: number | undefined = undefined;
        let value: number | undefined = undefined;
        let range_min: number | undefined = undefined;
        let range_max: number | undefined = undefined;
        let rotation: number | undefined = undefined;
        let start_angle: number | undefined = undefined;
        let end_angle: number | undefined = undefined;
        let style_references_node: StyleReference[] | undefined = undefined;

        const children: WidgetNode[] = [];

        if (finalPropsNode && typeof finalPropsNode.get === 'function') {
            // Resolve basic properties with substitutions
            // Keep original ID exactly, or default to generated name
            if (finalPropsNode.has('id')) {
                const idVal = finalPropsNode.get('id');
                name = String((idVal && idVal.value !== undefined) ? idVal.value : idVal);
            }
            if (finalPropsNode.has('x')) x = this.parseDimension(this.resolveText(finalPropsNode.get('x'), { resolveSubs: false }));
            if (finalPropsNode.has('y')) y = this.parseDimension(this.resolveText(finalPropsNode.get('y'), { resolveSubs: false }));
            if (finalPropsNode.has('width')) width = this.parseDimension(this.resolveText(finalPropsNode.get('width'), { resolveSubs: false }));
            if (finalPropsNode.has('height')) height = this.parseDimension(this.resolveText(finalPropsNode.get('height'), { resolveSubs: false }));

            // Text can be in 'text' key or if the pair value was a scalar
            if (finalPropsNode.has('text')) {
                text = this.resolveText(finalPropsNode.get('text'), { resolveSubs: false });
            } else if (propsNode && propsNode.type === 'SCALAR' && foundType === 'label') {
                text = this.resolveText(propsNode.value, { resolveSubs: false });
            }

            if (finalPropsNode.has('align')) align = this.resolveText(finalPropsNode.get('align'), { resolveSubs: false });

            // Layout
            if (finalPropsNode.has('layout')) {
                const layoutNode = finalPropsNode.get('layout');
                if (layoutNode && typeof layoutNode.toJSON === 'function') {
                    const l = layoutNode.toJSON();
                    layout = {
                        type: l.type || 'absolute',
                        flex_flow: l.flex_flow,
                        flex_align_main: l.flex_align_main,
                        flex_align_cross: l.flex_align_cross,
                        flex_grow: l.flex_grow,
                        grid_dsc_cols: Array.isArray(l.grid_dsc_cols || l.grid_columns) ? (l.grid_dsc_cols || l.grid_columns).map((v: any) => this.parseGridValue(v)) : undefined,
                        grid_dsc_rows: Array.isArray(l.grid_dsc_rows || l.grid_rows) ? (l.grid_dsc_rows || l.grid_rows).map((v: any) => this.parseGridValue(v)) : undefined,
                        pad_row: l.pad_row,
                        pad_column: l.pad_column
                    };
                }
            }

            // Also check for top-level flex_grow/grid props which are common in ESPHome
            if (finalPropsNode.has('flex_grow') || finalPropsNode.has('grid_cell_column_pos') || finalPropsNode.has('grid_cell_row_pos')) {
                if (!layout) layout = { type: 'absolute' };
                if (finalPropsNode.has('flex_grow')) layout.flex_grow = Number(this.resolveText(finalPropsNode.get('flex_grow')));

                if (finalPropsNode.has('grid_cell_column_pos')) grid_cell_column_pos = Number(this.resolveText(finalPropsNode.get('grid_cell_column_pos')));
                if (finalPropsNode.has('grid_cell_column_span')) grid_cell_column_span = Number(this.resolveText(finalPropsNode.get('grid_cell_column_span')));
                if (finalPropsNode.has('grid_cell_row_pos')) grid_cell_row_pos = Number(this.resolveText(finalPropsNode.get('grid_cell_row_pos')));
                if (finalPropsNode.has('grid_cell_row_span')) grid_cell_row_span = Number(this.resolveText(finalPropsNode.get('grid_cell_row_span')));
                if (finalPropsNode.has('grid_cell_x_align')) grid_cell_x_align = this.resolveText(finalPropsNode.get('grid_cell_x_align')) as any;
                if (finalPropsNode.has('grid_cell_y_align')) grid_cell_y_align = this.resolveText(finalPropsNode.get('grid_cell_y_align')) as any;
            }

            // Resolve Styles (ESPHome can have styles: style_id OR styles: [s1, s2, {id: s3, state: PRESSED}])
            if (finalPropsNode.has('styles')) {
                const stylesValue = finalPropsNode.get('styles');
                const styleRefs: StyleReference[] = [];

                if (stylesValue && stylesValue.type === 'SEQ') {
                    for (const item of stylesValue.items) {
                        if (item.type === 'MAP' || (item.items && !item.value)) {
                            // It's a mapping {id: ..., state: ..., bg_color: ...}
                            const sId = this.resolveText(item.get('id') || item.get('style_id'));
                            const state = this.resolveText(item.get('state'))?.toUpperCase() as any;
                            const itemStyles = this.parseStyles(item);
                            if (sId || Object.keys(itemStyles).length > 0) {
                                styleRefs.push({
                                    style_id: sId,
                                    state,
                                    styles: Object.keys(itemStyles).length > 0 ? itemStyles : undefined
                                });
                            }
                        } else {
                            // It's a simple string ID
                            const sId = this.resolveText(item);
                            if (sId) styleRefs.push({ style_id: sId });
                        }
                    }
                } else if (stylesValue) {
                    const sId = this.resolveText(stylesValue);
                    if (sId) styleRefs.push({ style_id: sId });
                }

                if (styleRefs.length > 0) {
                    const style_references: StyleReference[] = [];
                    const class_names_legacy: string[] = [];

                    for (const ref of styleRefs) {
                        style_references.push(ref);
                        if (ref.style_id) class_names_legacy.push(ref.style_id);

                        // DO NOT apply default styles to the widget preview immediately here!
                        // This prevents "baking" and ensures global style changes in the editor
                        // are reflected in the preview via the WidgetRenderer.

                        // Also apply inline styles if it's default state
                        if (ref.styles && (!ref.state || ref.state === 'DEFAULT')) {
                            Object.assign(styles, ref.styles);
                        }
                    }

                    style_references_node = style_references;
                    class_names = class_names_legacy;
                }
            }

            // Direct styles override style_definitions
            Object.assign(styles, this.parseStyles(finalPropsNode));

            // Core states
            if (finalPropsNode.has('hidden')) hidden = this.resolveText(finalPropsNode.get('hidden')) === 'true';
            if (finalPropsNode.has('clickable')) clickable = this.resolveText(finalPropsNode.get('clickable')) === 'true';
            if (finalPropsNode.has('checkable')) checkable = this.resolveText(finalPropsNode.get('checkable')) === 'true';
            if (finalPropsNode.has('checked')) checked = this.resolveText(finalPropsNode.get('checked')) === 'true';

            // Specific Widget Props
            if (finalPropsNode.has('options')) options = this.resolveText(finalPropsNode.get('options'));
            if (finalPropsNode.has('long_mode')) long_mode = this.resolveText(finalPropsNode.get('long_mode')).toUpperCase() as any;
            if (finalPropsNode.has('min_value')) min_value = Number(this.resolveText(finalPropsNode.get('min_value')));
            if (finalPropsNode.has('max_value')) max_value = Number(this.resolveText(finalPropsNode.get('max_value')));
            if (finalPropsNode.has('value')) value = Number(this.resolveText(finalPropsNode.get('value')));
            if (finalPropsNode.has('rotation')) rotation = Number(this.resolveText(finalPropsNode.get('rotation')));
            if (finalPropsNode.has('start_angle')) start_angle = Number(this.resolveText(finalPropsNode.get('start_angle')));
            if (finalPropsNode.has('end_angle')) end_angle = Number(this.resolveText(finalPropsNode.get('end_angle')));

            // Handle range: { min: ..., max: ... }
            if (finalPropsNode.has('range')) {
                const rangeNode = finalPropsNode.get('range');
                if (rangeNode && typeof rangeNode.get === 'function') {
                    if (rangeNode.has('min')) range_min = Number(this.resolveText(rangeNode.get('min')));
                    if (rangeNode.has('max')) range_max = Number(this.resolveText(rangeNode.get('max')));
                }
            }

            // Recursive children
            const childrenKeys = ['widgets', 'children', 'pages'];
            for (const cKey of childrenKeys) {
                if (finalPropsNode.has(cKey)) {
                    const childNodes = finalPropsNode.get(cKey);
                    if (childNodes && childNodes.items) {
                        for (const childItem of childNodes.items) {
                            const parsedChild = this.parseWidgetNode(childItem);
                            if (parsedChild) children.push(parsedChild);
                        }
                    }
                }
            }
        }

        return {
            id: uuidv4(),
            type: foundType,
            name,
            x, y, width, height, text, align, styles, layout, children,
            grid_cell_column_pos, grid_cell_column_span, grid_cell_row_pos, grid_cell_row_span,
            grid_cell_x_align, grid_cell_y_align, class_names, options,
            hidden, clickable, checkable, checked,
            long_mode, min_value, max_value, value, range_min, range_max,
            rotation, start_angle, end_angle,
            style_references: style_references_node,
            actions
        } as any;
    }

    private parseDimension(val: any): number | string {
        if (val === null || val === undefined) return 100;

        const strVal = this.resolveText(val);

        if (strVal === 'size_content' || strVal === 'lv.SIZE.CONTENT') return 'content';
        if (strVal === '100%' || strVal === 'lv.pct(100)') return '100%';

        if (/^-?\d+$/.test(strVal)) return parseInt(strVal, 10);
        return strVal;
    }

    private parseColor(val: any): string {
        if (val === null || val === undefined) return 'transparent';

        let strVal = this.resolveText(val);

        // Handle the case where a numeric 0x hex might have been resolved to a decimal string
        if (/^\d+$/.test(strVal)) {
            const num = parseInt(strVal, 10);
            strVal = `0x${num.toString(16).padStart(6, '0')}`;
        }

        if (strVal.startsWith('0x')) {
            let hex = strVal.slice(2);
            if (hex.length === 6) return `#${hex.toUpperCase()}`;
            if (hex.length === 3) return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toUpperCase();
            if (hex === '0') return '#000000';
            return `#${hex.padStart(6, '0').toUpperCase()}`;
        }
        return strVal;
    }

    private parseStyles(node: any): StyleProperties {
        const s: StyleProperties = {};
        if (!node || typeof node.has !== 'function') return s;

        if (node.has('bg_color')) s.bg_color = this.parseColor(node.get('bg_color'));
        if (node.has('text_color')) s.text_color = this.parseColor(node.get('text_color'));
        if (node.has('border_color')) s.border_color = this.parseColor(node.get('border_color'));
        if (node.has('shadow_color')) s.shadow_color = this.parseColor(node.get('shadow_color'));

        if (node.has('radius')) s.radius = parseInt(this.resolveText(node.get('radius')), 10);
        if (node.has('border_width')) s.border_width = parseInt(this.resolveText(node.get('border_width')), 10);
        if (node.has('shadow_width')) s.shadow_width = parseInt(this.resolveText(node.get('shadow_width')), 10);
        if (node.has('shadow_ofs_x')) s.shadow_ofs_x = parseInt(this.resolveText(node.get('shadow_ofs_x')), 10);
        if (node.has('shadow_ofs_y')) s.shadow_ofs_y = parseInt(this.resolveText(node.get('shadow_ofs_y')), 10);

        if (node.has('bg_opa')) s.bg_opa = parseFloat(this.resolveText(node.get('bg_opa'))) / 255;

        if (node.has('text_font')) s.text_font = this.resolveFont(node.get('text_font'));
        if (node.has('text_align')) s.text_align = this.resolveText(node.get('text_align')).toUpperCase() as any;

        if (node.has('pad_all')) s.pad_all = parseInt(this.resolveText(node.get('pad_all')), 10);
        if (node.has('pad_top')) s.pad_top = parseInt(this.resolveText(node.get('pad_top')), 10);
        if (node.has('pad_bottom')) s.pad_bottom = parseInt(this.resolveText(node.get('pad_bottom')), 10);
        if (node.has('pad_left')) s.pad_left = parseInt(this.resolveText(node.get('pad_left')), 10);
        if (node.has('pad_right')) s.pad_right = parseInt(this.resolveText(node.get('pad_right')), 10);

        if (node.has('line_width')) s.line_width = parseInt(this.resolveText(node.get('line_width')), 10);
        if (node.has('line_color')) s.line_color = this.parseColor(node.get('line_color'));
        if (node.has('arc_width')) s.arc_width = parseInt(this.resolveText(node.get('arc_width')), 10);
        if (node.has('arc_color')) s.arc_color = this.parseColor(node.get('arc_color'));

        return s;
    }

    /**
     * Serializes the current internal WidgetNode tree BACK into the Yaml Document,
     * maintaining all non-LVGL components and comments.
     */
    generate(widgets: WidgetNode[], assets: any[], global_styles: Record<string, StyleProperties> = {}): string {
        if (!this.yamlDoc) {
            this.yamlDoc = parseDocument(DEFAULT_ESPHOME_YAML);
        }

        this.syncSubstitutions(widgets);
        this.syncFonts(assets);

        const rootContent = this.yamlDoc.contents as any;
        const lvglNode = this.findLvglNode(rootContent, 0);

        if (lvglNode) {
            // Write style definitions
            if (Object.keys(global_styles).length > 0) {
                const styleDefs = Object.entries(global_styles).map(([id, styles]) => {
                    const yamlStyle: any = { id };
                    if (styles.bg_color) yamlStyle.bg_color = this.formatColor(styles.bg_color);
                    if (styles.text_color) yamlStyle.text_color = this.formatColor(styles.text_color);
                    if (styles.border_color) yamlStyle.border_color = this.formatColor(styles.border_color);
                    if (styles.radius !== undefined) yamlStyle.radius = styles.radius;
                    if (styles.border_width !== undefined) yamlStyle.border_width = styles.border_width;
                    if (styles.pad_all !== undefined) yamlStyle.pad_all = styles.pad_all;
                    if (styles.pad_left !== undefined) yamlStyle.pad_left = styles.pad_left;
                    if (styles.pad_right !== undefined) yamlStyle.pad_right = styles.pad_right;
                    if (styles.pad_top !== undefined) yamlStyle.pad_top = styles.pad_top;
                    if (styles.pad_bottom !== undefined) yamlStyle.pad_bottom = styles.pad_bottom;
                    if (styles.bg_opa !== undefined) yamlStyle.bg_opa = Math.round(styles.bg_opa * 255);
                    if (styles.text_font) yamlStyle.text_font = styles.text_font;
                    if (styles.text_align) yamlStyle.text_align = styles.text_align;
                    if (styles.arc_color) yamlStyle.arc_color = this.formatColor(styles.arc_color);
                    if (styles.arc_width !== undefined) yamlStyle.arc_width = styles.arc_width;
                    if (styles.line_color) yamlStyle.line_color = this.formatColor(styles.line_color);
                    if (styles.line_width !== undefined) yamlStyle.line_width = styles.line_width;
                    return yamlStyle;
                });
                lvglNode.set('style_definitions', this.yamlDoc.createNode(styleDefs));
            }

            const yamlWidgets = widgets.map(w => this.buildYamlWidget(w));

            // Check if we should use 'pages' or 'widgets'
            if (typeof lvglNode.has === 'function' && lvglNode.has('pages')) {
                lvglNode.set('pages', this.yamlDoc.createNode(yamlWidgets));
                if (lvglNode.has('widgets')) lvglNode.delete('widgets');
            } else if (lvglNode.type === 'SEQ') {
                const seqNode = this.yamlDoc.createNode(yamlWidgets);
                lvglNode.items = seqNode.items;
            } else {
                lvglNode.set('widgets', this.yamlDoc.createNode(yamlWidgets));
            }
        }

        // After generating the string, replace any literal PUA characters with \U hex escapes
        let finalYaml = String(this.yamlDoc);
        finalYaml = this.formatText(finalYaml) || finalYaml;

        return finalYaml;
    }

    private syncFonts(_widgets: WidgetNode[]) {
        if (!this.yamlDoc) return;

        // Find all font assets in the store
        // We actually need the assets from the store, but YamlEngine is a utility.
        // The generate() method should probably take assets too.
        // For now, we'll assume the assets were provided or we'll just use what we parsed.
        // BETTER: Update generate signature to (widgets, assets)
    }

    private syncSubstitutions(widgets: WidgetNode[]) {
        if (!this.yamlDoc) return;
        // Do not auto-inject structural substitutions. 
        // We will preserve the user's substitutions entirely as they were.
    }

    private formatColor(hex: string | undefined): string | undefined {
        if (!hex) return undefined;
        if (hex === 'transparent') return '0x00000000';
        if (hex.startsWith('0x')) return hex;
        return hex.replace('#', '0x');
    }

    private formatText(text: string | undefined): string | undefined {
        if (!text) return text;
        // Convert any PUA characters back to \U escapes for ESPHome YAML
        const chars = Array.from(text);
        let out = '';
        for (const char of chars) {
            const cp = char.codePointAt(0);
            if (cp && ((cp >= 0xE000 && cp <= 0xF8FF) || (cp >= 0xF0000 && cp <= 0xFFFFD) || (cp >= 0x100000 && cp <= 0x10FFFD))) {
                out += `\\U${cp.toString(16).padStart(8, '0').toUpperCase()}`;
            } else {
                out += char;
            }
        }
        return out;
    }

    private buildYamlWidget(w: WidgetNode): any {
        const props: any = {};

        if (w.name) {
            props.id = w.name;
        }

        if (w.x !== undefined) props.x = w.x;
        if (w.y !== undefined) props.y = w.y;
        if (w.width !== undefined) props.width = w.width;
        if (w.height !== undefined) props.height = w.height;
        if (w.text) props.text = this.formatText(w.text) || '';
        if (w.align) props.align = w.align;

        // Grid cell props
        if (w.grid_cell_column_pos !== undefined) props.grid_cell_column_pos = w.grid_cell_column_pos;
        if (w.grid_cell_column_span !== undefined) props.grid_cell_column_span = w.grid_cell_column_span;
        if (w.grid_cell_row_pos !== undefined) props.grid_cell_row_pos = w.grid_cell_row_pos;
        if (w.grid_cell_row_span !== undefined) props.grid_cell_row_span = w.grid_cell_row_span;
        if (w.grid_cell_x_align) props.grid_cell_x_align = w.grid_cell_x_align;
        if (w.grid_cell_y_align) props.grid_cell_y_align = w.grid_cell_y_align;

        // Core states
        if (w.hidden !== undefined) props.hidden = w.hidden;
        if (w.clickable !== undefined) props.clickable = w.clickable;
        if (w.checkable !== undefined) props.checkable = w.checkable;
        if (w.checked !== undefined) props.checked = w.checked;
        if (w.options) props.options = this.formatText(w.options) || '';

        // Specific Widget Props
        if (w.long_mode) props.long_mode = w.long_mode;
        if (w.min_value !== undefined) props.min_value = w.min_value;
        if (w.max_value !== undefined) props.max_value = w.max_value;
        if (w.value !== undefined) props.value = w.value;
        if (w.rotation !== undefined) props.rotation = w.rotation;
        if (w.start_angle !== undefined) props.start_angle = w.start_angle;
        if (w.end_angle !== undefined) props.end_angle = w.end_angle;

        if (w.range_min !== undefined || w.range_max !== undefined) {
            props.range = {
                min: w.range_min ?? 0,
                max: w.range_max ?? 100
            };
        }

        if (w.layout) {
            const l: any = { type: w.layout.type };
            if (w.layout.flex_flow) l.flex_flow = w.layout.flex_flow;
            if (w.layout.flex_align_main) l.flex_align_main = w.layout.flex_align_main;
            if (w.layout.flex_align_cross) l.flex_align_cross = w.layout.flex_align_cross;
            if (w.layout.flex_grow !== undefined) l.flex_grow = w.layout.flex_grow;
            if (w.layout.grid_dsc_cols) l.grid_dsc_cols = w.layout.grid_dsc_cols.map(v => this.formatGridValue(v));
            if (w.layout.grid_dsc_rows) l.grid_dsc_rows = w.layout.grid_dsc_rows.map(v => this.formatGridValue(v));
            if (w.layout.pad_row !== undefined) l.pad_row = w.layout.pad_row;
            if (w.layout.pad_column !== undefined) l.pad_column = w.layout.pad_column;
            props.layout = l;
        }

        if (w.styles) {
            const s = w.styles;
            if (s.bg_color) props.bg_color = this.formatColor(s.bg_color);
            if (s.bg_opa !== undefined) props.bg_opa = Math.round(s.bg_opa * 255);
            if (s.text_color) props.text_color = this.formatColor(s.text_color);
            if (s.text_font) props.text_font = s.text_font;
            if (s.text_align) props.text_align = s.text_align;
            if (s.radius !== undefined) props.radius = s.radius;
            if (s.border_width !== undefined) props.border_width = s.border_width;
            if (s.border_color) props.border_color = this.formatColor(s.border_color);
            if (s.pad_all !== undefined) props.pad_all = s.pad_all;
            if (s.pad_top !== undefined) props.pad_top = s.pad_top;
            if (s.pad_bottom !== undefined) props.pad_bottom = s.pad_bottom;
            if (s.pad_left !== undefined) props.pad_left = s.pad_left;
            if (s.pad_right !== undefined) props.pad_right = s.pad_right;
            if (s.shadow_width !== undefined) props.shadow_width = s.shadow_width;
            if (s.shadow_color) props.shadow_color = this.formatColor(s.shadow_color);
            if (s.shadow_ofs_x !== undefined) props.shadow_ofs_x = s.shadow_ofs_x;
            if (s.shadow_ofs_y !== undefined) props.shadow_ofs_y = s.shadow_ofs_y;
            if (s.line_width !== undefined) props.line_width = s.line_width;
            if (s.line_color) props.line_color = this.formatColor(s.line_color);
            if (s.arc_width !== undefined) props.arc_width = s.arc_width;
            if (s.arc_color) props.arc_color = this.formatColor(s.arc_color);
        }

        if (w.actions) {
            Object.assign(props, w.actions);
        }

        if (w.style_references && w.style_references.length > 0) {
            props.styles = w.style_references.map(ref => {
                const hasInlineStyles = ref.styles && Object.keys(ref.styles).length > 0;
                if ((ref.state && ref.state !== 'DEFAULT') || hasInlineStyles) {
                    const result: any = {};
                    if (ref.style_id) result.id = ref.style_id;
                    if (ref.state && ref.state !== 'DEFAULT') result.state = ref.state;

                    if (hasInlineStyles && ref.styles) {
                        const s = ref.styles;
                        if (s.bg_color) result.bg_color = this.formatColor(s.bg_color);
                        if (s.bg_opa !== undefined) result.bg_opa = Math.round(s.bg_opa * 255);
                        if (s.text_color) result.text_color = this.formatColor(s.text_color);
                        if (s.text_font) result.text_font = s.text_font;
                        if (s.text_align) result.text_align = s.text_align;
                        if (s.radius !== undefined) result.radius = s.radius;
                        if (s.border_width !== undefined) result.border_width = s.border_width;
                        if (s.border_color) result.border_color = this.formatColor(s.border_color);
                        if (s.pad_all !== undefined) result.pad_all = s.pad_all;
                        if (s.pad_top !== undefined) result.pad_top = s.pad_top;
                        if (s.pad_bottom !== undefined) result.pad_bottom = s.pad_bottom;
                        if (s.pad_left !== undefined) result.pad_left = s.pad_left;
                        if (s.pad_right !== undefined) result.pad_right = s.pad_right;
                        if (s.shadow_width !== undefined) result.shadow_width = s.shadow_width;
                        if (s.shadow_color) result.shadow_color = this.formatColor(s.shadow_color);
                        if (s.shadow_ofs_x !== undefined) result.shadow_ofs_x = s.shadow_ofs_x;
                        if (s.shadow_ofs_y !== undefined) result.shadow_ofs_y = s.shadow_ofs_y;
                        if (s.line_width !== undefined) result.line_width = s.line_width;
                        if (s.line_color) result.line_color = this.formatColor(s.line_color);
                        if (s.arc_width !== undefined) result.arc_width = s.arc_width;
                        if (s.arc_color) result.arc_color = this.formatColor(s.arc_color);
                    }
                    return result;
                }
                return ref.style_id;
            });
        } else if (w.class_names && w.class_names.length > 0) {
            props.styles = w.class_names;
        }

        if (w.children && w.children.length > 0) {
            props.widgets = w.children.map(c => this.buildYamlWidget(c));
        }

        const tag = w.type === 'object' ? 'obj' : (w.type === 'button' ? 'btn' : w.type);
        return { [tag]: props };
    }

    private formatGridValue(val: number | string): any {
        if (val === 'content') return 'lv.SIZE.CONTENT';
        if (typeof val === 'string' && val.endsWith('fr')) {
            return `lv.fr(${val.replace('fr', '')})`;
        }
        return val;
    }
    private parseGridValue(val: any): number | string {
        const strVal = String(val && val.value !== undefined ? val.value : val).trim();
        if (strVal === 'lv.SIZE.CONTENT' || strVal === 'size_content') return 'content';
        const frMatch = strVal.match(/lv\.fr\((\d+)\)/);
        if (frMatch) return `${frMatch[1]}fr`;
        if (strVal.includes('%')) return strVal;
        if (/^\d+$/.test(strVal)) return parseInt(strVal, 10);
        return strVal;
    }
}

const DEFAULT_ESPHOME_YAML = `
substitutions:
  name: "esphome-lvgl-dashboard"
  friendly_name: "LVGL Dashboard"

esphome:
  name: "\${name}"
  friendly_name: "\${friendly_name}"

lvgl:
  # Display background color
  disp_bg_color: 0x000000
  widgets: []
`;

export const yamlEngine = new YamlEngine();
