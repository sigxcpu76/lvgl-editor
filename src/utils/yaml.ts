import { Document, parseDocument } from 'yaml';
import { WidgetNode, WidgetType, StyleProperties, StyleReference, MeterScale, MeterTicks, MeterIndicator } from '../types';
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
                            family: styleId,
                            size: size ? Number(this.resolveText(size)) : undefined,
                            source: String(file)
                        });

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

            // 2b. Extract images
            const images = this.yamlDoc.get('image') as any;
            if (images && images.items) {
                for (const imgItem of images.items) {
                    const id = String(this.resolveText(imgItem.get('id')));
                    const file = String(this.resolveText(imgItem.get('file')));
                    const width = imgItem.get('width');
                    const height = imgItem.get('height');
                    const resize = imgItem.get('resize');

                    let w = width ? Number(this.resolveText(width)) : undefined;
                    let h = height ? Number(this.resolveText(height)) : undefined;

                    if (!w && !h && resize) {
                        const match = String(this.resolveText(resize)).match(/(\d+)x(\d+)/);
                        if (match) {
                            w = parseInt(match[1]);
                            h = parseInt(match[2]);
                        }
                    }

                    assets.push({
                        id: uuidv4(),
                        name: id,
                        type: 'image',
                        value: id,
                        source: file,
                        width: w,
                        height: h
                    });
                }
            }

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

            // Default first level (pages) to 480x480 if appropriate
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

        str = str.replace(/\\U([0-9A-Fa-f]{8})/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
        str = str.replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

        if (options.resolveSubs) {
            this.substitutions.forEach((val, key) => {
                str = str.replace(new RegExp(`\\$\\{${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g'), val);
                str = str.replace(new RegExp(`\\$${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-zA-Z0-9_])`, 'g'), val);
            });
        }
        return str;
    }

    private findLvglNode(node: any, depth: number): any {
        if (!node || depth > 30) return null;
        if (typeof node.has === 'function' && node.has('lvgl')) return node.get('lvgl');
        if (node.items) {
            for (const item of node.items) {
                const value = (item && item.value !== undefined) ? item.value : item;
                if (value === node) continue;
                const found = this.findLvglNode(value, depth + 1);
                if (found) return found;
            }
        }
        return null;
    }

    private parseLvglTree(lvglNode: any): WidgetNode[] {
        let widgets: WidgetNode[] = [];
        if (!lvglNode) return [];

        if (typeof lvglNode.has === 'function' && lvglNode.has('pages')) {
            const pagesNode = lvglNode.get('pages');
            if (pagesNode && pagesNode.items) {
                for (const pageItem of pagesNode.items) {
                    const pageWidget = this.parseWidgetNode(pageItem, 'page');
                    if (pageWidget) widgets.push(pageWidget);
                }
            }
        }

        if (typeof lvglNode.has === 'function' && lvglNode.has('widgets')) {
            const widgetsNode = lvglNode.get('widgets');
            if (widgetsNode && widgetsNode.items) {
                for (const item of widgetsNode.items) {
                    const w = this.parseWidgetNode(item);
                    if (w) widgets.push(w);
                }
            }
        }

        if (lvglNode.type === 'SEQ') {
            for (const item of lvglNode.items) {
                const w = this.parseWidgetNode(item);
                if (w) widgets.push(w);
            }
        }

        if (widgets.length === 0 && lvglNode.type === 'MAP' && lvglNode.items) {
            for (const pair of lvglNode.items) {
                const key = this.resolveText(pair.key);
                if (this.isWidgetType(key)) {
                    // Try to parse this pair as a widget
                    const w = this.parseWidgetNode(pair);
                    if (w) widgets.push(w);
                }
            }
        }

        return widgets;
    }

    private isWidgetType(key: string): boolean {
        const knownTypes = ['page', 'label', 'button', 'btn', 'obj', 'object', 'arc', 'bar', 'slider', 'switch', 'checkbox', 'spinbox', 'dropdown', 'roller', 'textarea', 'led', 'image', 'img', 'meter'];
        return knownTypes.includes(key);
    }

    private parseWidgetNode(node: any, forceType?: WidgetType): WidgetNode | null {
        if (!node) return null;

        let items: any[] = [];
        let contextNode: any = null;

        if (node.items) {
            items = node.items;
            contextNode = node;
        } else if (node.key && node.value !== undefined) {
            // It's a Pair
            items = [node];
            contextNode = node;
        } else {
            return null;
        }

        const knownTypes: Record<string, WidgetType> = {
            'page': 'page', 'label': 'label', 'button': 'button', 'btn': 'button',
            'obj': 'object', 'object': 'object', 'arc': 'arc', 'bar': 'bar',
            'slider': 'slider', 'switch': 'switch', 'checkbox': 'checkbox',
            'spinbox': 'spinbox', 'dropdown': 'dropdown', 'roller': 'roller',
            'textarea': 'textarea', 'led': 'led', 'image': 'image', 'img': 'image',
            'meter': 'meter'
        };

        let foundType: WidgetType | null = forceType || null;
        let propsNode: any = null;
        let actions: Record<string, any> = {};

        for (const pair of items) {
            const key = this.resolveText(pair.key);
            if (knownTypes[key]) {
                if (!foundType || foundType === forceType || foundType === 'object') {
                    foundType = knownTypes[key];
                    propsNode = pair.value;
                }
            }
            if (key && key.startsWith('on_')) {
                actions[key] = pair.value.toJSON ? pair.value.toJSON() : pair.value;
            }
        }

        if (!foundType) return null;

        const isPropsMap = propsNode && (propsNode.type === 'MAP' || propsNode.items);
        const finalPropsNode = isPropsMap ? propsNode : contextNode;

        const hasKey = (n: any, k: string) => {
            if (!n) return false;
            if (typeof n.has === 'function') return n.has(k);
            if (n.items) return n.items.some((i: any) => this.resolveText(i.key) === k);
            return false;
        };

        const getKey = (n: any, k: string) => {
            if (!n) return null;
            if (typeof n.get === 'function') return n.get(k);
            if (n.items) {
                const pair = n.items.find((i: any) => this.resolveText(i.key) === k);
                return pair ? pair.value : null;
            }
            return null;
        };

        // If propsNode is a map, also check it for actions
        if (isPropsMap && propsNode.items) {
            for (const pair of propsNode.items) {
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
        let grid_cell_column_pos: number | undefined;
        let grid_cell_column_span: number | undefined;
        let grid_cell_row_pos: number | undefined;
        let grid_cell_row_span: number | undefined;
        let grid_cell_x_align: string | undefined;
        let grid_cell_y_align: string | undefined;
        let class_names: string[] | undefined;
        let options: string | undefined;
        let hidden: boolean | undefined;
        let clickable: boolean | undefined;
        let checkable: boolean | undefined;
        let checked: boolean | undefined;
        let long_mode: any;
        let min_value: number | undefined;
        let max_value: number | undefined;
        let value: number | undefined;
        let range_min: number | undefined;
        let range_max: number | undefined;
        let rotation: number | undefined;
        let start_angle: number | undefined;
        let end_angle: number | undefined;
        let src: string | undefined;
        let style_references_node: StyleReference[] | undefined;
        let meter_scales: MeterScale[] | undefined;
        const children: WidgetNode[] = [];

        if (hasKey(finalPropsNode, 'scales') && foundType === 'meter') {
            const scalesNode = getKey(finalPropsNode, 'scales');
            if (scalesNode && scalesNode.type === 'SEQ') {
                meter_scales = scalesNode.items.map((scaleItem: any) => {
                    const range_from = Number(this.resolveText(getKey(scaleItem, 'range_from')) || 0);
                    const range_to = Number(this.resolveText(getKey(scaleItem, 'range_to')) || 100);
                    const angle_range = hasKey(scaleItem, 'angle_range') ? Number(this.resolveText(getKey(scaleItem, 'angle_range'))) : 270;
                    const rotation = hasKey(scaleItem, 'rotation') ? Number(this.resolveText(getKey(scaleItem, 'rotation'))) : 0;

                    const ticksNode = getKey(scaleItem, 'ticks');
                    const ticks: MeterTicks = {
                        count: ticksNode && hasKey(ticksNode, 'count') ? Number(this.resolveText(getKey(ticksNode, 'count'))) : 12,
                        color: ticksNode && hasKey(ticksNode, 'color') ? this.parseColor(getKey(ticksNode, 'color')) : undefined,
                        width: ticksNode && hasKey(ticksNode, 'width') ? Number(this.resolveText(getKey(ticksNode, 'width'))) : undefined,
                        length: ticksNode && hasKey(ticksNode, 'length') ? Number(this.resolveText(getKey(ticksNode, 'length'))) : undefined,
                    };

                    if (ticksNode && hasKey(ticksNode, 'major')) {
                        const majorNode = getKey(ticksNode, 'major');
                        ticks.major = {
                            stride: hasKey(majorNode, 'stride') ? Number(this.resolveText(getKey(majorNode, 'stride'))) : 3,
                            width: hasKey(majorNode, 'width') ? Number(this.resolveText(getKey(majorNode, 'width'))) : undefined,
                            length: hasKey(majorNode, 'length') ? this.resolveText(getKey(majorNode, 'length')) : undefined,
                            color: hasKey(majorNode, 'color') ? this.parseColor(getKey(majorNode, 'color')) : undefined,
                            label_gap: hasKey(majorNode, 'label_gap') ? Number(this.resolveText(getKey(majorNode, 'label_gap'))) : undefined,
                        };
                    }

                    const indicators: MeterIndicator[] = [];
                    if (hasKey(scaleItem, 'indicators')) {
                        const indNode = getKey(scaleItem, 'indicators');
                        if (indNode && indNode.type === 'SEQ') {
                            for (const item of indNode.items) {
                                if (hasKey(item, 'arc')) {
                                    const arc = getKey(item, 'arc');
                                    indicators.push({
                                        type: 'arc',
                                        color: hasKey(arc, 'color') ? this.parseColor(getKey(arc, 'color')) : undefined,
                                        start_value: hasKey(arc, 'start_value') ? Number(this.resolveText(getKey(arc, 'start_value'))) : undefined,
                                        end_value: hasKey(arc, 'end_value') ? Number(this.resolveText(getKey(arc, 'end_value'))) : undefined,
                                        width: hasKey(arc, 'width') ? Number(this.resolveText(getKey(arc, 'width'))) : undefined,
                                        r_mod: hasKey(arc, 'r_mod') ? Number(this.resolveText(getKey(arc, 'r_mod'))) : undefined,
                                        opa: hasKey(arc, 'opa') ? parseFloat(this.resolveText(getKey(arc, 'opa'))) : 100
                                    });
                                } else if (hasKey(item, 'line')) {
                                    const line = getKey(item, 'line');
                                    indicators.push({
                                        type: 'line',
                                        color: hasKey(line, 'color') ? this.parseColor(getKey(line, 'color')) : undefined,
                                        value: hasKey(line, 'value') ? Number(this.resolveText(getKey(line, 'value'))) : undefined,
                                        width: hasKey(line, 'width') ? Number(this.resolveText(getKey(line, 'width'))) : undefined,
                                        r_mod: hasKey(line, 'r_mod') ? Number(this.resolveText(getKey(line, 'r_mod'))) : undefined,
                                        opa: hasKey(line, 'opa') ? parseFloat(this.resolveText(getKey(line, 'opa'))) : 100
                                    });
                                } else if (hasKey(item, 'image')) {
                                    const img = getKey(item, 'image');
                                    indicators.push({
                                        type: 'image',
                                        src: hasKey(img, 'src') ? this.resolveText(getKey(img, 'src')) : undefined,
                                        value: hasKey(img, 'value') ? Number(this.resolveText(getKey(img, 'value'))) : undefined,
                                        pivot_x: hasKey(img, 'pivot_x') ? Number(this.resolveText(getKey(img, 'pivot_x'))) : undefined,
                                        pivot_y: hasKey(img, 'pivot_y') ? Number(this.resolveText(getKey(img, 'pivot_y'))) : undefined,
                                        opa: hasKey(img, 'opa') ? parseFloat(this.resolveText(getKey(img, 'opa'))) : 100
                                    });
                                }
                            }
                        }
                    }

                    return { range_from, range_to, angle_range, rotation, ticks, indicators };
                });
            }
        }

        if (hasKey(finalPropsNode, 'id')) name = this.resolveText(getKey(finalPropsNode, 'id'));
        if (hasKey(finalPropsNode, 'x')) x = this.parseDimension(getKey(finalPropsNode, 'x'));
        if (hasKey(finalPropsNode, 'y')) y = this.parseDimension(getKey(finalPropsNode, 'y'));
        if (hasKey(finalPropsNode, 'width')) width = this.parseDimension(getKey(finalPropsNode, 'width'));
        if (hasKey(finalPropsNode, 'height')) height = this.parseDimension(getKey(finalPropsNode, 'height'));
        if (hasKey(finalPropsNode, 'src')) src = this.resolveText(getKey(finalPropsNode, 'src'));

        if (hasKey(finalPropsNode, 'text')) {
            text = this.resolveText(getKey(finalPropsNode, 'text'), { resolveSubs: false });
        } else if (foundType === 'label' && propsNode && propsNode.type === 'SCALAR') {
            text = this.resolveText(propsNode, { resolveSubs: false });
        }

        if (hasKey(finalPropsNode, 'align')) align = this.resolveText(getKey(finalPropsNode, 'align'), { resolveSubs: false });

        if (hasKey(finalPropsNode, 'layout')) {
            const lNode = getKey(finalPropsNode, 'layout');
            if (lNode && typeof lNode.toJSON === 'function') {
                const l = lNode.toJSON();
                layout = {
                    type: l.type || 'absolute',
                    flex_flow: l.flex_flow, flex_align_main: l.flex_align_main, flex_align_cross: l.flex_align_cross,
                    flex_grow: l.flex_grow,
                    grid_dsc_cols: Array.isArray(l.grid_dsc_cols || l.grid_columns) ? (l.grid_dsc_cols || l.grid_columns).map((v: any) => this.parseGridValue(v)) : undefined,
                    grid_dsc_rows: Array.isArray(l.grid_dsc_rows || l.grid_rows) ? (l.grid_dsc_rows || l.grid_rows).map((v: any) => this.parseGridValue(v)) : undefined,
                    pad_row: l.pad_row, pad_column: l.pad_column
                };
            }
        }

        if (hasKey(finalPropsNode, 'hidden')) hidden = String(this.resolveText(getKey(finalPropsNode, 'hidden'))) === 'true';
        if (hasKey(finalPropsNode, 'clickable')) clickable = String(this.resolveText(getKey(finalPropsNode, 'clickable'))) === 'true';
        if (hasKey(finalPropsNode, 'checkable')) checkable = String(this.resolveText(getKey(finalPropsNode, 'checkable'))) === 'true';
        if (hasKey(finalPropsNode, 'checked')) checked = String(this.resolveText(getKey(finalPropsNode, 'checked'))) === 'true';

        if (hasKey(finalPropsNode, 'options')) options = this.resolveText(getKey(finalPropsNode, 'options'));
        if (hasKey(finalPropsNode, 'long_mode')) long_mode = String(this.resolveText(getKey(finalPropsNode, 'long_mode'))).toUpperCase() as any;
        if (hasKey(finalPropsNode, 'min_value')) min_value = Number(this.resolveText(getKey(finalPropsNode, 'min_value')));
        if (hasKey(finalPropsNode, 'max_value')) max_value = Number(this.resolveText(getKey(finalPropsNode, 'max_value')));
        if (hasKey(finalPropsNode, 'value')) value = Number(this.resolveText(getKey(finalPropsNode, 'value')));
        if (hasKey(finalPropsNode, 'rotation')) rotation = Number(this.resolveText(getKey(finalPropsNode, 'rotation')));
        if (hasKey(finalPropsNode, 'start_angle')) start_angle = Number(this.resolveText(getKey(finalPropsNode, 'start_angle')));
        if (hasKey(finalPropsNode, 'end_angle')) end_angle = Number(this.resolveText(getKey(finalPropsNode, 'end_angle')));

        if (hasKey(finalPropsNode, 'range')) {
            const rNode = getKey(finalPropsNode, 'range');
            if (rNode && typeof rNode.get === 'function') {
                if (rNode.has('min')) range_min = Number(this.resolveText(rNode.get('min')));
                if (rNode.has('max')) range_max = Number(this.resolveText(rNode.get('max')));
            }
        }

        if (hasKey(finalPropsNode, 'styles')) {
            const stylesValue = getKey(finalPropsNode, 'styles');
            const styleRefs: StyleReference[] = [];
            if (stylesValue && stylesValue.type === 'SEQ') {
                for (const item of stylesValue.items) {
                    if (item.type === 'MAP' || (item.items && !item.value)) {
                        const sId = this.resolveText(getKey(item, 'id') || getKey(item, 'style_id'));
                        const state = String(this.resolveText(getKey(item, 'state')) || '').toUpperCase() as any;
                        const itemStyles = this.parseStyles(item);
                        if (sId || Object.keys(itemStyles).length > 0) {
                            styleRefs.push({ style_id: sId, state: state || undefined, styles: Object.keys(itemStyles).length > 0 ? itemStyles : undefined });
                        }
                    } else {
                        const sId = this.resolveText(item);
                        if (sId) styleRefs.push({ style_id: sId });
                    }
                }
            } else if (stylesValue) {
                const sId = this.resolveText(stylesValue);
                if (sId) styleRefs.push({ style_id: sId });
            }
            if (styleRefs.length > 0) {
                style_references_node = styleRefs;
                class_names = styleRefs.filter(r => r.style_id).map(r => r.style_id!);
                styleRefs.forEach(ref => {
                    if (ref.styles && (!ref.state || ref.state === 'DEFAULT')) Object.assign(styles, ref.styles);
                });
            }
        }

        Object.assign(styles, this.parseStyles(finalPropsNode));

        const childrenKeys = ['widgets', 'children', 'pages'];
        for (const cKey of childrenKeys) {
            if (hasKey(finalPropsNode, cKey)) {
                const childNodes = getKey(finalPropsNode, cKey);
                if (childNodes && childNodes.items) {
                    for (const childItem of childNodes.items) {
                        const parsedChild = this.parseWidgetNode(childItem);
                        if (parsedChild) children.push(parsedChild);
                    }
                }
            }
        }

        return {
            id: uuidv4(), type: foundType, name, x, y, width, height, text, align, styles, layout, children,
            grid_cell_column_pos, grid_cell_column_span, grid_cell_row_pos, grid_cell_row_span,
            grid_cell_x_align, grid_cell_y_align, class_names, options,
            hidden, clickable, checkable, checked, long_mode, min_value, max_value, value, range_min, range_max,
            rotation, start_angle, end_angle, src, style_references: style_references_node, actions,
            meter_scales
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
        if (/^\d+$/.test(strVal)) {
            const num = parseInt(strVal, 10);
            strVal = `0x${num.toString(16).padStart(6, '0')}`;
        }
        if (strVal.startsWith('0x')) {
            let hex = strVal.slice(2);
            if (hex.length === 6) return `#${hex.toUpperCase()}`;
            if (hex.length === 8) return `#${hex.slice(2).toUpperCase()}`; // Handle RGBA by stripping alpha for now
            if (hex.length === 3) return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toUpperCase();
            if (hex === '0') return '#000000';
            return `#${hex.padStart(6, '0').toUpperCase()}`;
        }
        return strVal;
    }

    private parseStyles(node: any): StyleProperties {
        const s: StyleProperties = {};
        if (!node) return s;
        const has = (k: string) => typeof node.has === 'function' ? node.has(k) : (node.items && node.items.some((i: any) => this.resolveText(i.key) === k));
        const get = (k: string) => typeof node.get === 'function' ? node.get(k) : (node.items && node.items.find((i: any) => this.resolveText(i.key) === k)?.value);

        if (has('bg_color')) s.bg_color = this.parseColor(get('bg_color'));
        if (has('text_color')) s.text_color = this.parseColor(get('text_color'));
        if (has('border_color')) s.border_color = this.parseColor(get('border_color'));
        if (has('shadow_color')) s.shadow_color = this.parseColor(get('shadow_color'));
        if (has('radius')) s.radius = parseInt(this.resolveText(get('radius')), 10);
        if (has('border_width')) s.border_width = parseInt(this.resolveText(get('border_width')), 10);
        if (has('shadow_width')) s.shadow_width = parseInt(this.resolveText(get('shadow_width')), 10);
        if (has('shadow_ofs_x')) s.shadow_ofs_x = parseInt(this.resolveText(get('shadow_ofs_x')), 10);
        if (has('shadow_ofs_y')) s.shadow_ofs_y = parseInt(this.resolveText(get('shadow_ofs_y')), 10);
        if (has('bg_opa')) s.bg_opa = parseFloat(this.resolveText(get('bg_opa'))) / 255;
        if (has('text_font')) s.text_font = this.resolveFont(get('text_font'));
        if (has('text_align')) s.text_align = this.resolveText(get('text_align')).toUpperCase() as any;
        if (has('pad_all')) s.pad_all = parseInt(this.resolveText(get('pad_all')), 10);
        if (has('pad_top')) s.pad_top = parseInt(this.resolveText(get('pad_top')), 10);
        if (has('pad_bottom')) s.pad_bottom = parseInt(this.resolveText(get('pad_bottom')), 10);
        if (has('pad_left')) s.pad_left = parseInt(this.resolveText(get('pad_left')), 10);
        if (has('pad_right')) s.pad_right = parseInt(this.resolveText(get('pad_right')), 10);
        if (has('line_width')) s.line_width = parseInt(this.resolveText(get('line_width')), 10);
        if (has('line_color')) s.line_color = this.parseColor(get('line_color'));
        if (has('arc_width')) s.arc_width = parseInt(this.resolveText(get('arc_width')), 10);
        if (has('arc_color')) s.arc_color = this.parseColor(get('arc_color'));
        return s;
    }

    generate(widgets: WidgetNode[], assets: any[], global_styles: Record<string, StyleProperties> = {}, substitutions: Record<string, string> = {}): string {
        if (!this.yamlDoc) this.yamlDoc = parseDocument(DEFAULT_ESPHOME_YAML);
        const rootContent = this.yamlDoc.contents as any;

        // 1. Update Substitutions
        if (Object.keys(substitutions).length > 0) {
            rootContent.set('substitutions', this.yamlDoc.createNode(substitutions));
        } else {
            rootContent.delete('substitutions');
        }

        // 2. Update Fonts
        const fontAssets = assets.filter(a => a.type === 'font');
        if (fontAssets.length > 0) {
            const fontNodes = fontAssets.map(a => ({
                file: a.source || a.family,
                id: a.name,
                size: a.size
            }));
            rootContent.set('font', this.yamlDoc.createNode(fontNodes));
        } else {
            rootContent.delete('font');
        }

        // 2b. Update Images
        const imageAssets = assets.filter(a => a.type === 'image');
        if (imageAssets.length > 0) {
            const imageNodes = imageAssets.map(a => {
                const node: any = {
                    id: a.name,
                    file: a.source
                };
                if (a.width && a.height) {
                    node.resize = `${a.width}x${a.height}`;
                }
                return node;
            });
            rootContent.set('image', this.yamlDoc.createNode(imageNodes));
        } else {
            rootContent.delete('image');
        }

        const lvglNode = this.findLvglNode(rootContent, 0);

        if (lvglNode) {
            if (Object.keys(global_styles).length > 0) {
                const styleDefs = Object.entries(global_styles).map(([id, st]) => {
                    const yamlStyle: any = { id };
                    if (st.bg_color) yamlStyle.bg_color = this.formatColor(st.bg_color);
                    if (st.text_color) yamlStyle.text_color = this.formatColor(st.text_color);
                    if (st.border_color) yamlStyle.border_color = this.formatColor(st.border_color);
                    if (st.radius !== undefined) yamlStyle.radius = st.radius;
                    if (st.border_width !== undefined) yamlStyle.border_width = st.border_width;
                    if (st.pad_all !== undefined) yamlStyle.pad_all = st.pad_all;
                    if (st.bg_opa !== undefined) yamlStyle.bg_opa = Math.round(st.bg_opa * 255);
                    if (st.text_font) yamlStyle.text_font = st.text_font;
                    return yamlStyle;
                });
                lvglNode.set('style_definitions', this.yamlDoc.createNode(styleDefs));
            } else {
                lvglNode.delete('style_definitions');
            }

            const yamlWidgets = widgets.map(w => this.buildYamlWidget(w));
            if (typeof lvglNode.has === 'function' && lvglNode.has('pages')) {
                lvglNode.set('pages', this.yamlDoc.createNode(yamlWidgets));
            } else if (lvglNode.type === 'SEQ') {
                const seq = this.yamlDoc.createNode(yamlWidgets);
                lvglNode.items = seq.items;
            } else {
                lvglNode.set('widgets', this.yamlDoc.createNode(yamlWidgets));
            }
        }

        let finalYaml = String(this.yamlDoc);
        finalYaml = this.formatText(finalYaml) || finalYaml;
        return finalYaml;
    }

    private formatColor(hex: string | undefined): string | undefined {
        if (!hex) return undefined;
        if (hex === 'transparent') return '0x00000000';
        if (hex.startsWith('0x')) return hex;
        return hex.replace('#', '0x');
    }

    private formatText(text: string | undefined): string | undefined {
        if (!text) return text;
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
        if (w.name) props.id = w.name;
        if (w.x !== undefined) props.x = w.x;
        if (w.y !== undefined) props.y = w.y;
        if (w.width !== undefined) props.width = w.width;
        if (w.height !== undefined) props.height = w.height;
        if (w.text) props.text = this.formatText(w.text);
        if (w.align) props.align = w.align;
        if (w.src) props.src = w.src;

        if (w.hidden !== undefined) props.hidden = w.hidden;
        if (w.clickable !== undefined) props.clickable = w.clickable;
        if (w.checkable !== undefined) props.checkable = w.checkable;
        if (w.checked !== undefined) props.checked = w.checked;
        if (w.options) props.options = this.formatText(w.options);

        if (w.long_mode) props.long_mode = w.long_mode;
        if (w.min_value !== undefined) props.min_value = w.min_value;
        if (w.max_value !== undefined) props.max_value = w.max_value;
        if (w.value !== undefined) props.value = w.value;

        if (w.range_min !== undefined || w.range_max !== undefined) {
            props.range = { min: w.range_min ?? 0, max: w.range_max ?? 100 };
        }

        if (w.meter_scales && w.meter_scales.length > 0) {
            props.scales = w.meter_scales.map(scale => {
                const s: any = {
                    range_from: scale.range_from,
                    range_to: scale.range_to,
                    angle_range: scale.angle_range ?? 270,
                };
                if (scale.rotation) s.rotation = scale.rotation;

                s.ticks = { count: scale.ticks.count };
                if (scale.ticks.color) s.ticks.color = this.formatColor(scale.ticks.color);
                if (scale.ticks.width) s.ticks.width = scale.ticks.width;
                if (scale.ticks.length) s.ticks.length = scale.ticks.length;
                if (scale.ticks.major) {
                    const m = scale.ticks.major;
                    s.ticks.major = {};
                    if (m.stride) s.ticks.major.stride = m.stride;
                    if (m.width) s.ticks.major.width = m.width;
                    if (m.length) s.ticks.major.length = m.length;
                    if (m.color) s.ticks.major.color = this.formatColor(m.color);
                    if (m.label_gap) s.ticks.major.label_gap = m.label_gap;
                }

                if (scale.indicators && scale.indicators.length > 0) {
                    s.indicators = scale.indicators.map(ind => {
                        const i: any = {};
                        const type = ind.type;
                        const data: any = {};
                        if (ind.id) data.id = ind.id;
                        if (ind.color) data.color = this.formatColor(ind.color);
                        if (ind.opa !== 100) data.opa = `${ind.opa}%`;

                        if (type === 'arc') {
                            if (ind.start_value !== undefined) data.start_value = ind.start_value;
                            if (ind.end_value !== undefined) data.end_value = ind.end_value;
                            if (ind.width) data.width = ind.width;
                            if (ind.r_mod) data.r_mod = ind.r_mod;
                            i.arc = data;
                        } else if (type === 'line') {
                            if (ind.value !== undefined) data.value = ind.value;
                            if (ind.width) data.width = ind.width;
                            if (ind.r_mod) data.r_mod = ind.r_mod;
                            i.line = data;
                        } else if (type === 'image') {
                            if (ind.src) data.src = ind.src;
                            if (ind.value !== undefined) data.value = ind.value;
                            if (ind.pivot_x !== undefined) data.pivot_x = ind.pivot_x;
                            if (ind.pivot_y !== undefined) data.pivot_y = ind.pivot_y;
                            i.image = data;
                        }
                        return i;
                    });
                }
                return s;
            });
        }

        if (w.layout) {
            const l: any = { type: w.layout.type };
            if (w.layout.flex_flow) l.flex_flow = w.layout.flex_flow;
            if (w.layout.flex_grow !== undefined) l.flex_grow = w.layout.flex_grow;
            if (w.layout.grid_dsc_cols) l.grid_dsc_cols = w.layout.grid_dsc_cols.map(v => this.formatGridValue(v));
            if (w.layout.grid_dsc_rows) l.grid_dsc_rows = w.layout.grid_dsc_rows.map(v => this.formatGridValue(v));
            props.layout = l;
        }

        if (w.styles && Object.keys(w.styles).length > 0) {
            const s = w.styles;
            if (s.bg_color) props.bg_color = this.formatColor(s.bg_color);
            if (s.text_color) props.text_color = this.formatColor(s.text_color);
            if (s.text_font) props.text_font = s.text_font;
            if (s.bg_opa !== undefined) props.bg_opa = Math.round(s.bg_opa * 255);
        }

        if (w.style_references && w.style_references.length > 0) {
            props.styles = w.style_references.map(ref => {
                if ((ref.state && ref.state !== 'DEFAULT') || (ref.styles && Object.keys(ref.styles).length > 0)) {
                    const res: any = { id: ref.style_id };
                    if (ref.state) res.state = ref.state;
                    return res;
                }
                return ref.style_id;
            });
        }

        if (w.actions) Object.assign(props, w.actions);

        if (w.children && w.children.length > 0) {
            props.widgets = w.children.map(c => this.buildYamlWidget(c));
        }

        const tag = w.type === 'object' ? 'obj' : (w.type === 'button' ? 'btn' : w.type);
        return { [tag]: props };
    }

    private formatGridValue(val: number | string): any {
        if (val === 'content') return 'lv.SIZE.CONTENT';
        if (typeof val === 'string' && val.endsWith('fr')) return `lv.fr(${val.replace('fr', '')})`;
        return val;
    }

    private parseGridValue(val: any): number | string {
        const strVal = String(val && val.value !== undefined ? val.value : val).trim();
        if (strVal === 'lv.SIZE.CONTENT' || strVal === 'size_content') return 'content';
        const frMatch = strVal.match(/lv\.fr\((\d+)\)/);
        if (frMatch) return `${frMatch[1]}fr`;
        return strVal;
    }
}

const DEFAULT_ESPHOME_YAML = `
substitutions:
  name: "esphome-lvgl-dashboard"

lvgl:
  widgets: []
`;

export const yamlEngine = new YamlEngine();
