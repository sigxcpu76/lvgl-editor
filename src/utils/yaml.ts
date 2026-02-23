import { Document, parseDocument } from 'yaml';
import { WidgetNode, WidgetType, StyleProperties } from '../types';
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

    constructor() { }

    /**
     * Parses the full ESPHome YAML string.
     * Extracts the 'lvgl' section from 'display' or top-level.
     */
    parse(yamlString: string): { widgets: WidgetNode[], assets: any[], substitutions: Record<string, string> } {
        try {
            this.yamlDoc = parseDocument(yamlString);
            if (!this.yamlDoc || !this.yamlDoc.contents) return { widgets: [], assets: [], substitutions: {} };

            this.styles.clear();
            this.substitutions.clear();

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
                            fontFamily: String(file),
                            size: size ? Number(this.resolveText(size)) : undefined
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
                return { widgets: [], assets, substitutions: subsRecord };
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

            // Default first level (pages) to 480x480 if they are 'object' types and have no x/y
            for (const w of widgets) {
                if (w.type === 'object' && (w.width === 100 || w.width === 0) && (w.height === 100 || w.height === 0)) {
                    w.width = 480;
                    w.height = 480;
                }
            }

            const subsRecord: Record<string, string> = {};
            this.substitutions.forEach((v, k) => subsRecord[k] = v);

            return { widgets, assets, substitutions: subsRecord };
        } catch (e) {
            console.error("YAML Parse Error:", e);
            return { widgets: [], assets: [], substitutions: {} };
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
                    const pageWidget = this.parseWidgetNode(pageItem, 'object');
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
            'label': 'label',
            'button': 'button',
            'btn': 'button',
            'obj': 'object',
            'object': 'object',
            'arc': 'arc',
            'bar': 'bar',
            'slider': 'slider',
            'switch': 'switch'
        };

        let foundType: WidgetType | null = forceType || null;
        let propsNode: any = null;

        for (const pair of yamlMap.items) {
            const key = String(pair.key?.value || pair.key);
            if (knownTypes[key]) {
                foundType = knownTypes[key];
                propsNode = pair.value;
                break;
            }
        }

        if (!foundType && forceType) foundType = forceType;
        if (!foundType) return null;

        const finalPropsNode = (propsNode && (propsNode.type === 'MAP' || propsNode.items)) ? propsNode : yamlMap;

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

        const children: WidgetNode[] = [];

        if (finalPropsNode && typeof finalPropsNode.get === 'function') {
            // Resolve basic properties with substitutions
            if (finalPropsNode.has('id')) name = this.resolveText(finalPropsNode.get('id'), { resolveSubs: false });
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

            // Resolve Styles (ESPHome can have styles: style_id OR styles: [s1, s2])
            if (finalPropsNode.has('styles')) {
                const stylesValue = finalPropsNode.get('styles');
                const styleIds = (stylesValue && stylesValue.type === 'SEQ') ?
                    stylesValue.items.map((i: any) => this.resolveText(i)) :
                    [this.resolveText(stylesValue)];

                for (const sId of styleIds) {
                    const resolved = this.styles.get(sId);
                    if (resolved) {
                        Object.assign(styles, resolved);
                    } else {
                        console.log(`Style ID not found: ${sId}`);
                    }
                }
            }

            // Direct styles override style_definitions
            Object.assign(styles, this.parseStyles(finalPropsNode));

            // Recursive children
            const childrenKeys = ['widgets', 'children'];
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
            grid_cell_x_align, grid_cell_y_align
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

        if (node.has('pad_all')) s.pad_all = parseInt(this.resolveText(node.get('pad_all')), 10);
        if (node.has('pad_top')) s.pad_top = parseInt(this.resolveText(node.get('pad_top')), 10);
        if (node.has('pad_bottom')) s.pad_bottom = parseInt(this.resolveText(node.get('pad_bottom')), 10);
        if (node.has('pad_left')) s.pad_left = parseInt(this.resolveText(node.get('pad_left')), 10);
        if (node.has('pad_right')) s.pad_right = parseInt(this.resolveText(node.get('pad_right')), 10);

        return s;
    }

    /**
     * Serializes the current internal WidgetNode tree BACK into the Yaml Document,
     * maintaining all non-LVGL components and comments.
     */
    generate(widgets: WidgetNode[]): string {
        if (!this.yamlDoc) {
            this.yamlDoc = parseDocument(DEFAULT_ESPHOME_YAML);
        }

        this.syncSubstitutions(widgets);

        const rootContent = this.yamlDoc.contents as any;
        const lvglNode = this.findLvglNode(rootContent, 0);

        if (lvglNode) {
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

        return String(this.yamlDoc);
    }

    private syncSubstitutions(widgets: WidgetNode[]) {
        if (!this.yamlDoc) return;

        let subs = this.yamlDoc.get('substitutions') as any;
        if (!subs) {
            subs = this.yamlDoc.createNode({});
            this.yamlDoc.set('substitutions', subs);
        }

        const collectWidgetIds = (nodes: WidgetNode[], ids: string[] = []) => {
            for (const n of nodes) {
                if (n.name) ids.push(n.name);
                if (n.children) collectWidgetIds(n.children, ids);
            }
            return ids;
        };

        const allIds = collectWidgetIds(widgets);
        for (const id of allIds) {
            const subKey = `${id}_id`;
            // Only add if not already present to avoid overwriting user customizations
            if (!subs.has(subKey)) {
                subs.set(subKey, id);
            }
        }
    }

    private buildYamlWidget(w: WidgetNode): any {
        const props: any = {};
        // Use substitution for ID if possible
        if (w.name) {
            props.id = `\${${w.name}_id}`;
        }

        if (w.x !== undefined) props.x = w.x;
        if (w.y !== undefined) props.y = w.y;
        if (w.width !== undefined) props.width = w.width;
        if (w.height !== undefined) props.height = w.height;
        if (w.text) props.text = w.text;
        if (w.align) props.align = w.align;

        // Grid cell props
        if (w.grid_cell_column_pos !== undefined) props.grid_cell_column_pos = w.grid_cell_column_pos;
        if (w.grid_cell_column_span !== undefined) props.grid_cell_column_span = w.grid_cell_column_span;
        if (w.grid_cell_row_pos !== undefined) props.grid_cell_row_pos = w.grid_cell_row_pos;
        if (w.grid_cell_row_span !== undefined) props.grid_cell_row_span = w.grid_cell_row_span;
        if (w.grid_cell_x_align) props.grid_cell_x_align = w.grid_cell_x_align;
        if (w.grid_cell_y_align) props.grid_cell_y_align = w.grid_cell_y_align;

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
            if (s.bg_color) props.bg_color = s.bg_color;
            if (s.bg_opa !== undefined) props.bg_opa = Math.round(s.bg_opa * 255);
            if (s.text_color) props.text_color = s.text_color;
            if (s.text_font) props.text_font = s.text_font;
            if (s.radius !== undefined) props.radius = s.radius;
            if (s.border_width !== undefined) props.border_width = s.border_width;
            if (s.border_color) props.border_color = s.border_color;
            if (s.pad_all !== undefined) props.pad_all = s.pad_all;
            if (s.pad_top !== undefined) props.pad_top = s.pad_top;
            if (s.pad_bottom !== undefined) props.pad_bottom = s.pad_bottom;
            if (s.pad_left !== undefined) props.pad_left = s.pad_left;
            if (s.pad_right !== undefined) props.pad_right = s.pad_right;
            if (s.shadow_width !== undefined) props.shadow_width = s.shadow_width;
            if (s.shadow_color) props.shadow_color = s.shadow_color;
            if (s.shadow_ofs_x !== undefined) props.shadow_ofs_x = s.shadow_ofs_x;
            if (s.shadow_ofs_y !== undefined) props.shadow_ofs_y = s.shadow_ofs_y;
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
