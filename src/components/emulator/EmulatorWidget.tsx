import React, { useState, useCallback, useMemo } from 'react';
import { WidgetNode, Asset, StyleProperties } from '../../types';
import { useStore } from '../../store';

interface Props {
    node: WidgetNode;
    isRoot?: boolean;
    parentId?: string | null;
    parentLayout?: string;
    parentFlexFlow?: string;
}

export const EmulatorWidget: React.FC<Props> = ({ node, isRoot, parentId = null, parentLayout = 'absolute', parentFlexFlow }) => {
    const { assets, substitutions, global_styles } = useStore();

    const [isPressed, setIsPressed] = useState(false);
    const [isChecked, setIsChecked] = useState(node.checked || false);
    const [isFocused, setIsFocused] = useState(false);

    const resolveValue = useCallback((val: any): any => {
        if (typeof val !== 'string') return val;
        let str = val;
        Object.entries(substitutions).forEach(([key, value]) => {
            str = str.replace(new RegExp(`\\$\\{${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g'), value);
            str = str.replace(new RegExp(`\\$${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-zA-Z0-9_])`, 'g'), value);
        });
        return str;
    }, [substitutions]);

    const handleAction = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (node.checkable || node.type === 'switch' || node.type === 'checkbox') {
            setIsChecked(!isChecked);
        }
    };

    // Style resolution logic
    const resolvedStyles = useMemo(() => {
        // Base styles (Default)
        let base: StyleProperties = {
            ...(node.class_names?.reduce((acc, className) => {
                if (global_styles[className]) {
                    return { ...acc, ...global_styles[className] };
                }
                return acc;
            }, {} as StyleProperties) || {}),
            ...(node.styles || {})
        };

        // Overlay state-specific styles
        const applyStateStyles = (stateStyles: StyleProperties) => {
            base = { ...base, ...stateStyles };
        };

        const styleRefs = node.style_references || [];

        // Apply state styles in order of priority (often CHECKED has high priority in LVGL)
        if (isChecked) {
            styleRefs.filter(r => r.state === 'CHECKED').forEach(r => {
                if (r.style_id && global_styles[r.style_id]) applyStateStyles(global_styles[r.style_id]);
                if (r.styles) applyStateStyles(r.styles);
            });
        }
        if (isFocused) {
            styleRefs.filter(r => r.state === 'FOCUSED').forEach(r => {
                if (r.style_id && global_styles[r.style_id]) applyStateStyles(global_styles[r.style_id]);
                if (r.styles) applyStateStyles(r.styles);
            });
        }
        if (isPressed) {
            styleRefs.filter(r => r.state === 'PRESSED').forEach(r => {
                if (r.style_id && global_styles[r.style_id]) applyStateStyles(global_styles[r.style_id]);
                if (r.styles) applyStateStyles(r.styles);
            });
        }

        return base;
    }, [node, global_styles, isPressed, isChecked, isFocused]);

    const getStyles = (): React.CSSProperties => {
        const s = resolvedStyles;

        // Handle background color with opacity
        let bgColor = resolveValue(s.bg_color || 'transparent');
        if (s.bg_opa !== undefined && bgColor !== 'transparent') {
            if (bgColor.startsWith('#')) {
                const hex = bgColor.slice(1);
                const r = parseInt(hex.slice(0, 2), 16);
                const g = parseInt(hex.slice(2, 4), 16);
                const b = parseInt(hex.slice(4, 6), 16);
                bgColor = `rgba(${r}, ${g}, ${b}, ${s.bg_opa})`;
            }
        } else if (s.bg_opa === 0) {
            bgColor = 'transparent';
        }

        const processDim = (dim: number | string | undefined) => {
            const resolved = resolveValue(dim);
            if (resolved === 'content' || resolved === 'size_content') return 'auto';
            if (typeof resolved === 'number') return `${resolved}px`;
            if (typeof resolved === 'string' && resolved.endsWith('fr')) return resolved;
            if (typeof resolved === 'string' && !isNaN(Number(resolved))) return `${resolved}px`;
            return resolved; // e.g. "100%"
        };

        const nodeLayout = node.layout || { type: 'absolute' };
        const isFlex = nodeLayout.type === 'flex';
        const isGrid = nodeLayout.type === 'grid';

        const flexAlignMainMap: Record<string, string> = {
            'start': 'flex-start',
            'center': 'center',
            'end': 'flex-end',
            'space_between': 'space-between',
            'space_around': 'space-around',
            'space_evenly': 'space-evenly'
        };

        const flexAlignCrossMap: Record<string, string> = {
            'start': 'flex-start',
            'center': 'center',
            'end': 'flex-end',
            'stretch': 'stretch'
        };

        const flexFlowMap: Record<string, string> = {
            'row': 'row',
            'column': 'column',
            'row_wrap': 'row wrap',
            'column_wrap': 'column wrap'
        };

        // Box Shadow
        let boxShadow = 'none';
        if (s.shadow_width) {
            const color = s.shadow_color || 'rgba(0,0,0,0.5)';
            const ox = s.shadow_ofs_x || 0;
            const oy = s.shadow_ofs_y || 0;
            boxShadow = `${ox}px ${oy}px ${s.shadow_width}px ${color}`;
        }

        const isLabelOrButton = node.type === 'label' || node.type === 'button';
        const effectiveDisplay = node.hidden ? 'none' : (isFlex ? 'flex' : (isGrid ? 'grid' : (isLabelOrButton ? 'flex' : 'block')));

        const styles: React.CSSProperties = {
            position: (isRoot || parentLayout === 'flex' || parentLayout === 'grid' || isFlex || isGrid) ? 'relative' : 'absolute',
            left: isRoot ? 0 : (node.x !== undefined ? processDim(node.x) : undefined),
            top: isRoot ? 0 : (node.y !== undefined ? processDim(node.y) : undefined),
            width: isRoot ? '100%' : processDim(node.width),
            height: isRoot ? '100%' : processDim(node.height),
            backgroundColor: bgColor,
            color: s.text_color || '#ffffff',
            textAlign: s.text_align ? (s.text_align.toLowerCase() as any) : 'left',
            borderWidth: s.border_width ? `${s.border_width}px` : (node.type === 'object' ? '1px' : 0),
            borderStyle: s.border_width ? 'solid' : (node.type === 'object' ? 'dashed' : 'none'),
            borderColor: s.border_color || (node.type === 'object' ? 'hsl(var(--primary) / 0.3)' : 'transparent'),
            borderRadius: s.radius ? `${s.radius}px` : 0,
            paddingTop: s.pad_top ?? s.pad_all ?? 0,
            paddingBottom: s.pad_bottom ?? s.pad_all ?? 0,
            paddingLeft: s.pad_left ?? s.pad_all ?? 0,
            paddingRight: s.pad_right ?? s.pad_all ?? 0,
            boxShadow,
            display: effectiveDisplay,
            flexDirection: (isFlex || isLabelOrButton) ? ((nodeLayout.flex_flow && flexFlowMap[nodeLayout.flex_flow]?.split(' ')[0] as any) || 'row') : undefined,
            flexWrap: (isFlex || isLabelOrButton) ? ((nodeLayout.flex_flow && flexFlowMap[nodeLayout.flex_flow]?.includes('wrap') ? 'wrap' : 'nowrap') as any) : undefined,
            alignItems: (isFlex || isLabelOrButton) ? ((nodeLayout.flex_align_cross && flexAlignCrossMap[nodeLayout.flex_align_cross]) || 'center') : undefined,
            justifyContent: isFlex ? ((nodeLayout.flex_align_main && flexAlignMainMap[nodeLayout.flex_align_main]) || 'flex-start') :
                (isLabelOrButton ? (s.text_align === 'CENTER' ? 'center' : (s.text_align === 'RIGHT' ? 'flex-end' : 'flex-start')) : undefined),
            gridTemplateColumns: isGrid ? (nodeLayout.grid_dsc_cols?.map(c => processDim(c)).join(' ') || '1fr') : undefined,
            gridTemplateRows: isGrid ? (nodeLayout.grid_dsc_rows?.map(r => processDim(r)).join(' ') || '1fr') : undefined,
            flexGrow: nodeLayout.flex_grow || 0,
            gap: `${nodeLayout.pad_row || 0}px ${nodeLayout.pad_column || 0}px`,
            cursor: (node.clickable || node.checkable || ['button', 'switch', 'checkbox', 'slider', 'arc', 'spinbox', 'dropdown', 'roller', 'textarea'].includes(node.type)) ? 'pointer' : 'default',
            overflow: 'hidden',
            fontFamily: typeof s.text_font === 'string' ? `"${s.text_font}", sans-serif` : 'inherit',
            transition: 'all 0.1s ease', // Smooth state transitions
            userSelect: 'none',
            zIndex: isRoot ? 1 : 10,
            // pointer-events fix: ensure interactive widgets receive events
            pointerEvents: (node.clickable || node.checkable || ['button', 'switch', 'checkbox', 'slider', 'arc', 'spinbox', 'dropdown', 'roller', 'textarea', 'object', 'page'].includes(node.type) || isRoot) ? 'auto' : 'none',
        };

        // Grid child positioning
        if (node.grid_cell_column_pos !== undefined) {
            const col = node.grid_cell_column_pos;
            const span = node.grid_cell_column_span || 1;
            styles.gridColumn = `${col + 1} / span ${span}`;
            styles.position = 'relative';
            styles.left = 'auto';
            styles.top = 'auto';
        }
        if (node.grid_cell_row_pos !== undefined) {
            const row = node.grid_cell_row_pos;
            const span = node.grid_cell_row_span || 1;
            styles.gridRow = `${row + 1} / span ${span}`;
            styles.position = 'relative';
            styles.left = 'auto';
            styles.top = 'auto';
        }

        // Align property support
        if (node.align === 'center' && !isFlex) {
            styles.left = '50%';
            styles.top = '50%';
            styles.transform = 'translate(-50%, -50%)';
        }

        // Fix for stretching in grid/flex - if stretch is requested OR flex_grow is used, width/height must be auto
        if (styles.justifySelf === 'stretch' || styles.alignSelf === 'stretch' || (nodeLayout.flex_grow && nodeLayout.flex_grow > 0)) {
            if (!isRoot) {
                const isRowParent = parentLayout === 'flex' && (!parentFlexFlow || (parentFlexFlow && parentFlexFlow.startsWith('row')));
                const isColParent = parentLayout === 'flex' && (parentFlexFlow && parentFlexFlow.startsWith('column'));

                if (styles.justifySelf === 'stretch' || (isRowParent && nodeLayout.flex_grow)) {
                    styles.width = 'auto';
                }
                if (styles.alignSelf === 'stretch' || (isColParent && nodeLayout.flex_grow)) {
                    styles.height = 'auto';
                }
            }
        }

        return styles;
    };

    const renderContent = () => {
        const text = resolveValue(node.text || '');
        const s = resolvedStyles;
        const fontAsset = assets.find(a => a.type === 'font' && a.value === s.text_font);
        const fontSize = fontAsset?.size ? `${fontAsset.size}px` : undefined;
        const fontWeight = (s.text_font?.toLowerCase().includes('bold') || (fontAsset?.name?.toLowerCase().includes('bold'))) ? 'bold' : 'normal';
        const fontFamily = fontAsset?.family ? `"${fontAsset.family}", sans-serif` : (typeof s.text_font === 'string' ? `"${s.text_font}", sans-serif` : 'inherit');

        const isIcon = text.startsWith('mdi:') ||
            (text.length === 1 && text.charCodeAt(0) >= 0xE000) ||
            (text.length === 2 && text.charCodeAt(0) >= 0xD800 && text.charCodeAt(0) <= 0xDBFF);
        const iconName = text.startsWith('mdi:') ? text.slice(4) : null;

        switch (node.type) {
            case 'label':
            case 'button':
                if (isIcon) {
                    if (iconName) {
                        return <i className={`mdi mdi-${iconName}`} style={{ fontSize: fontSize || '1.2em', pointerEvents: 'none' }}></i>;
                    } else {
                        return <span style={{ fontSize: fontSize || '1.2em', fontFamily: '"Material Design Icons", sans-serif', pointerEvents: 'none' }}>{text}</span>;
                    }
                }
                return <span style={{ fontFamily, fontSize, fontWeight, textAlign: s.text_align ? (s.text_align.toLowerCase() as any) : 'inherit', width: '100%', pointerEvents: 'none' }}>{text}</span>;
            case 'arc': {
                const start = node.start_angle ?? 135;
                const end = node.end_angle ?? 45;
                const min = node.range_min ?? 0;
                const max = node.range_max ?? 100;
                const val = node.value ?? 0;
                const rot = node.rotation ?? 0;

                const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
                    const rad = (angle * Math.PI) / 180.0;
                    return { x: cx + (r * Math.cos(rad)), y: cy + (r * Math.sin(rad)) };
                };

                const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
                    const start = polarToCartesian(x, y, radius, endAngle);
                    const end = polarToCartesian(x, y, radius, startAngle);
                    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
                    return ["M", start.x, start.y, "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(" ");
                };

                const totalRange = (end < start) ? (360 - start + end) : (end - start);
                const valAngle = start + (totalRange * ((val - min) / (max - min)));

                return (
                    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: `rotate(${rot}deg)` }}>
                        <path d={describeArc(50, 50, 40, start, end)} fill="none" stroke={s.bg_color || '#444'} strokeWidth={s.arc_width || 4} strokeLinecap="round" />
                        <path d={describeArc(50, 50, 40, start, valAngle)} fill="none" stroke={s.arc_color || '#007acc'} strokeWidth={s.arc_width || 4} strokeLinecap="round" />
                    </svg>
                );
            }
            case 'bar':
            case 'slider': {
                const min = node.range_min ?? 0;
                const max = node.range_max ?? 100;
                const val = node.value ?? 0;
                const percent = Math.min(100, Math.max(0, ((val - min) / (max - min)) * 100));

                return (
                    <div style={{ background: s.bg_color || '#555', width: '100%', height: '100%', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{
                            background: s.arc_color || '#007acc',
                            width: `${percent}%`,
                            height: '100%',
                            transition: 'width 0.2s'
                        }} />
                        {node.type === 'slider' && (
                            <div style={{
                                position: 'absolute',
                                left: `${percent}%`,
                                top: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: '12px',
                                height: '24px',
                                background: '#fff',
                                borderRadius: '4px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                zIndex: 2
                            }} />
                        )}
                    </div>
                );
            }
            case 'switch':
                return (
                    <div style={{ background: isChecked ? (s.arc_color || '#007acc') : (s.bg_color || '#555'), width: '40px', height: '24px', borderRadius: '12px', position: 'relative', transition: 'background 0.2s', pointerEvents: 'none' }}>
                        <div style={{ background: '#fff', width: '18px', height: '18px', borderRadius: '50%', position: 'absolute', top: '3px', left: isChecked ? '19px' : '3px', transition: 'left 0.2s' }} />
                    </div>
                );
            case 'checkbox':
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '100%', width: '100%', pointerEvents: 'none' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '4px', border: `2px solid ${s.arc_color || '#007acc'}`, background: isChecked ? (s.arc_color || '#007acc') : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {isChecked && <span style={{ color: '#fff', fontSize: '14px' }}>✓</span>}
                        </div>
                        <span style={{ color: s.text_color || '#fff', fontSize, fontFamily }}>{text}</span>
                    </div>
                );
            case 'spinbox': {
                const val = node.value ?? 0;
                return (
                    <div style={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%', background: s.bg_color || '#333', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ padding: '0 8px', background: '#444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>-</div>
                        <div style={{ flex: 1, textAlign: 'center', color: s.text_color || '#fff' }}>{val}</div>
                        <div style={{ padding: '0 8px', background: '#444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>+</div>
                    </div>
                );
            }
            case 'dropdown': {
                const options = node.options?.split('\n') || ['Option 1'];
                return (
                    <div style={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%', background: s.bg_color || '#333', borderRadius: '4px', padding: '0 8px', justifyContent: 'space-between' }}>
                        <span style={{ color: s.text_color || '#fff' }}>{options[0]}</span>
                        <span style={{ color: s.text_color || '#fff' }}>▼</span>
                    </div>
                );
            }
            case 'roller': {
                const options = node.options?.split('\n') || ['Opt 1', 'Opt 2', 'Opt 3'];
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', background: s.bg_color || '#333', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                        <div style={{ color: s.text_color || '#888', opacity: 0.5, fontSize: '0.8em' }}>{options[0]}</div>
                        <div style={{ color: s.text_color || '#fff', borderTop: `1px solid ${s.arc_color || '#007acc'}`, borderBottom: `1px solid ${s.arc_color || '#007acc'}`, width: '100%', textAlign: 'center', padding: '4px 0', margin: '4px 0' }}>{options[1] || options[0]}</div>
                        <div style={{ color: s.text_color || '#888', opacity: 0.5, fontSize: '0.8em' }}>{options[2] || ''}</div>
                    </div>
                );
            }
            case 'textarea': {
                const text = resolveValue(node.text || 'Textarea...');
                return (
                    <div style={{ width: '100%', height: '100%', background: s.bg_color || '#222', color: s.text_color || '#ccc', padding: '8px', borderRadius: '4px', border: '1px solid #444', overflow: 'hidden', whiteSpace: 'pre-wrap', fontFamily }}>
                        {text}
                    </div>
                );
            }
            case 'led': {
                const active = isChecked;
                const ledColor = active ? (s.bg_color || '#ff0000') : '#333';
                const shadow = active ? `0 0 10px ${ledColor}, inset 0 0 5px rgba(255,255,255,0.5)` : 'inset 0 2px 4px rgba(0,0,0,0.5)';
                return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
                        <div style={{
                            width: 'min(100%, 100%)',
                            aspectRatio: '1',
                            borderRadius: '50%',
                            background: ledColor,
                            boxShadow: shadow,
                            transition: 'all 0.2s'
                        }} />
                    </div>
                );
            }
            case 'image': {
                const imgAsset = assets.find(a => a.type === 'image' && (a.value === node.src || a.name === node.src));
                if (imgAsset && imgAsset.source) {
                    const isRenderable = imgAsset.source.startsWith('http') || imgAsset.source.startsWith('data:');
                    if (isRenderable) {
                        return <img src={imgAsset.source} style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} alt={node.name} />;
                    }
                }
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '4px', overflow: 'hidden' }}>
                        <span className="mdi mdi-image-outline" style={{ fontSize: '1.5rem', opacity: 0.3 }} />
                        <span style={{ fontSize: '0.6rem', opacity: 0.5, marginTop: '4px', textAlign: 'center', padding: '0 4px', wordBreak: 'break-all' }}>{node.src || 'No Image'}</span>
                    </div>
                );
            }
            case 'page':
            case 'object':
            default:
                return null;
        }
    };

    return (
        <div
            className={`emulator-widget widget-type-${node.type} ${isPressed ? 'state-pressed' : ''} ${isChecked ? 'state-checked' : ''} ${isFocused ? 'state-focused' : ''}`}
            style={getStyles()}
            data-id={node.id}
            onMouseDown={(e) => {
                setIsPressed(true);
                handleAction(e);
            }}
            onMouseUp={(e) => {
                setIsPressed(false);
            }}
            onMouseEnter={() => setIsFocused(true)}
            onMouseLeave={() => {
                setIsPressed(false);
                setIsFocused(false);
            }}
        >
            {renderContent()}
            {node.children?.map(child => (
                <EmulatorWidget
                    key={child.id}
                    node={child}
                    parentLayout={node.layout?.type || 'absolute'}
                    parentFlexFlow={node.layout?.flex_flow}
                />
            ))}
        </div>
    );
};
