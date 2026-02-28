import React, { useState, useCallback, useEffect } from 'react';
import { WidgetNode, Asset, StyleProperties } from '../../types';
import { useStore } from '../../store';
import { useDrag, useDrop } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { v4 as uuidv4 } from 'uuid';
import { resolveFontFamily, resolveFontSize } from '../../utils/fontUtils';

interface Props {
    node: WidgetNode;
    isRoot?: boolean;
    parentId?: string | null;
    parentLayout?: string;
    parentFlexFlow?: string;
}

export const WidgetRenderer: React.FC<Props> = ({ node, isRoot, parentId = null, parentLayout = 'absolute', parentFlexFlow }) => {
    const { selectedIds, setSelectedIds, updateWidget, gridConfig, canvasConfig, assets, substitutions, global_styles } = useStore();

    const resolveValue = useCallback((val: any): any => {
        if (typeof val !== 'string') return val;
        let str = val;
        Object.entries(substitutions).forEach(([key, value]) => {
            str = str.replace(new RegExp(`\\$\\{${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g'), value);
            str = str.replace(new RegExp(`\\$${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-zA-Z0-9_])`, 'g'), value);
        });
        return str;
    }, [substitutions]);

    const isSelected = selectedIds.includes(node.id);
    const [isResizing, setIsResizing] = useState(false);

    const snapValue = useCallback((val: number) => {
        if (!gridConfig.enabled) return Math.round(val);
        return Math.round(val / gridConfig.size) * gridConfig.size;
    }, [gridConfig]);

    const containerRef = React.useRef<HTMLDivElement | null>(null);

    const handleResizeStart = useCallback((direction: 'nw' | 'ne' | 'sw' | 'se') => (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setIsResizing(true);

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = typeof node.width === 'number' ? node.width : (containerRef.current?.offsetWidth || 100);
        const startHeight = typeof node.height === 'number' ? node.height : (containerRef.current?.offsetHeight || 40);
        const startXPos = typeof node.x === 'number' ? node.x : 0;
        const startYPos = typeof node.y === 'number' ? node.y : 0;

        let hasMoved = false;

        const onMouseMove = (moveEvent: MouseEvent) => {
            if (!hasMoved) {
                useStore.getState().pushHistory();
                hasMoved = true;
            }

            const areaEl = document.querySelector('.lvgl-screen');
            const rect = areaEl?.getBoundingClientRect();
            const scale = rect ? (rect.width / canvasConfig.width) : 1;

            const deltaX = (moveEvent.clientX - startX) / scale;
            const deltaY = (moveEvent.clientY - startY) / scale;

            let newWidth = startWidth;
            let newHeight = startHeight;
            let newX = startXPos;
            let newY = startYPos;

            if (direction.includes('e')) {
                newWidth = Math.max(gridConfig.size, snapValue(startWidth + deltaX));
            } else if (direction.includes('w')) {
                const snappedDeltaX = Math.round(deltaX / gridConfig.size) * gridConfig.size;
                newWidth = Math.max(gridConfig.size, snapValue(startWidth - snappedDeltaX));
                newX = startXPos + (startWidth - newWidth);
            }

            if (direction.includes('s')) {
                newHeight = Math.max(gridConfig.size, snapValue(startHeight + deltaY));
            } else if (direction.includes('n')) {
                const snappedDeltaY = Math.round(deltaY / gridConfig.size) * gridConfig.size;
                newHeight = Math.max(gridConfig.size, snapValue(startHeight - snappedDeltaY));
                newY = startYPos + (startHeight - newHeight);
            }

            updateWidget(node.id, {
                width: newWidth,
                height: newHeight,
                x: newX,
                y: newY
            }, false);
        };

        const onMouseUp = () => {
            setIsResizing(false);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }, [node.id, node.width, node.height, node.x, node.y, updateWidget, gridConfig, canvasConfig, snapValue]);

    const handleDragStart = useCallback((e: React.MouseEvent) => {
        if (isResizing || isRoot) return;

        const isContainer = ['object', 'page'].includes(node.type) && !node.clickable;

        // If it's a container and NOT selected, let the event bubble to Canvas.tsx for marquee.
        if (isContainer && !isSelected) {
            return;
        }

        // For interactive widgets or selected containers, we stop propagation to start a DRAG move.
        e.stopPropagation();
        e.preventDefault();

        const state = useStore.getState();
        let currentSelectedIds = state.selectedIds;

        if (!isSelected) {
            currentSelectedIds = [node.id];
            setSelectedIds(currentSelectedIds);
        }

        const startX = e.clientX;
        const startY = e.clientY;
        const startXPos = typeof node.x === 'number' ? node.x : 0;
        const startYPos = typeof node.y === 'number' ? node.y : 0;

        const initialPositions = new Map<string, { x: number, y: number }>();
        const gatherPositions = (nodes: WidgetNode[]) => {
            nodes.forEach(n => {
                if (currentSelectedIds.includes(n.id)) {
                    initialPositions.set(n.id, {
                        x: typeof n.x === 'number' ? n.x : 0,
                        y: typeof n.y === 'number' ? n.y : 0
                    });
                }
                if (n.children) gatherPositions(n.children);
            });
        };
        gatherPositions(state.widgets);

        let hasMoved = false;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const areaEl = document.querySelector('.lvgl-screen');
            const rect = areaEl?.getBoundingClientRect();
            const scale = rect ? (rect.width / canvasConfig.width) : 1;

            const deltaX = (moveEvent.clientX - startX) / scale;
            const deltaY = (moveEvent.clientY - startY) / scale;

            if (deltaX !== 0 || deltaY !== 0) {
                if (!hasMoved) {
                    useStore.getState().pushHistory();
                    hasMoved = true;
                }

                currentSelectedIds.forEach(id => {
                    const pos = initialPositions.get(id);
                    if (pos) {
                        const newX = snapValue(pos.x + deltaX);
                        const newY = snapValue(pos.y + deltaY);
                        updateWidget(id, { x: newX, y: newY }, false);
                    }
                });
            }
        };

        const onMouseUp = (upEvent: MouseEvent) => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);

            if (!containerRef.current) return;

            if (currentSelectedIds.length === 1) {
                const originalPointerEvents = containerRef.current.style.pointerEvents;
                containerRef.current.style.pointerEvents = 'none';

                const dropEl = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
                const targetWidget = dropEl?.closest('.widget-node') as HTMLElement;
                const targetId = targetWidget?.getAttribute('data-widget-id');
                const canvasEl = dropEl?.closest('.lvgl-screen');

                containerRef.current.style.pointerEvents = originalPointerEvents;

                if (targetId && targetId !== node.id && targetId !== parentId) {
                    useStore.getState().moveWidget(node.id, targetId, 0);
                } else if (canvasEl && !targetWidget && parentId !== null) {
                    useStore.getState().moveWidget(node.id, null, 0);
                }
            }
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }, [node.id, node.x, node.y, parentId, isResizing, updateWidget, setSelectedIds, canvasConfig, snapValue, isSelected]);

    const [{ isDragging }, dragRef, dragPreview] = useDrag({
        type: 'widget',
        item: { type: node.type, id: node.id, x: node.x, y: node.y },
        canDrag: false,
        collect: (monitor) => ({
            isDragging: !!monitor.isDragging(),
        }),
    });

    useEffect(() => {
        dragPreview(getEmptyImage(), { captureDraggingState: true });
    }, [dragPreview]);

    const [{ isOver }, dropRef] = useDrop({
        accept: ['widget', 'asset'],
        drop: (item: any, monitor) => {
            if (monitor.didDrop()) return;

            const clientOffset = monitor.getClientOffset();
            if (!clientOffset) return;

            if (item.asset) {
                const asset = item.asset as Asset;
                if (asset.type === 'icon' && (node.type === 'label' || node.type === 'button')) {
                    updateWidget(node.id, { text: `mdi:${asset.value}` });
                } else if (asset.type === 'font') {
                    updateWidget(node.id, {
                        styles: {
                            ...(node.styles || {}),
                            text_font: asset.value
                        }
                    });
                } else if (asset.type === 'image' && node.type === 'image') {
                    updateWidget(node.id, { src: asset.value });
                }
                return;
            }

            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();

            const areaEl = document.querySelector('.lvgl-screen');
            const areaRect = areaEl?.getBoundingClientRect();
            const scale = areaRect ? (areaRect.width / canvasConfig.width) : 1;

            const x = snapValue((clientOffset.x - rect.left) / scale);
            const y = snapValue((clientOffset.y - rect.top) / scale);

            if (item.id && item.id !== node.id) {
                useStore.getState().moveWidget(item.id, node.id, node.children?.length || 0);
                useStore.getState().updateWidget(item.id, { x, y });
                return;
            }

            if (!item.id && item.type) {
                const newWidget: WidgetNode = {
                    id: uuidv4(),
                    type: item.type as any,
                    name: `${item.type}_${Date.now().toString().slice(-4)}`,
                    x, y,
                    width: item.type === 'slider' || item.type === 'bar' ? 150 : (item.type === 'image' ? 100 : 100),
                    height: item.type === 'slider' || item.type === 'bar' ? 20 : (item.type === 'image' ? 100 : 40),
                    text: item.type === 'label' || item.type === 'button' ? `${item.type}` : undefined,
                    src: item.type === 'image' ? undefined : undefined,
                    range_min: (item.type === 'slider' || item.type === 'bar' || item.type === 'arc') ? 0 : undefined,
                    range_max: (item.type === 'slider' || item.type === 'bar' || item.type === 'arc') ? 100 : undefined,
                    value: (item.type === 'slider' || item.type === 'bar' || item.type === 'arc') ? 50 : undefined,
                    start_angle: item.type === 'arc' ? 135 : undefined,
                    end_angle: item.type === 'arc' ? 45 : undefined,
                    checkable: item.type === 'switch' ? true : undefined,
                    children: []
                };
                useStore.getState().addWidget(node.id, newWidget);
                useStore.getState().setSelectedIds([newWidget.id]);
            }
        },
        collect: (monitor) => ({
            isOver: !!monitor.isOver({ shallow: true }),
        }),
    });

    const setRef = (element: HTMLDivElement | null) => {
        containerRef.current = element;
        dragRef(element);
        dropRef(element);
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (node.type === 'page') {
            setSelectedIds([]);
            return;
        }
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
            if (isSelected) {
                setSelectedIds(selectedIds.filter(id => id !== node.id));
            } else {
                setSelectedIds([...selectedIds, node.id]);
            }
        } else {
            setSelectedIds([node.id]);
        }
    };

    const s: StyleProperties = {
        ...((node.style_references || node.class_names?.map(c => ({ style_id: c })))?.reduce((acc: any, ref: any) => {
            let combined = { ...acc };
            if (ref.style_id && (!ref.state || ref.state === 'DEFAULT')) {
                const globalStyle = global_styles[ref.style_id];
                if (globalStyle) combined = { ...combined, ...globalStyle };
            }
            if (ref.styles && (!ref.state || ref.state === 'DEFAULT')) {
                combined = { ...combined, ...ref.styles };
            }
            return combined;
        }, {} as StyleProperties) || {}),
        ...(node.styles || {})
    };

    const getStyles = (): React.CSSProperties => {
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
            return resolved;
        };

        const nodeLayout = node.layout || { type: 'absolute' };
        const isFlex = nodeLayout.type === 'flex';
        const isGrid = nodeLayout.type === 'grid';

        const flexAlignMainMap: Record<string, string> = {
            'start': 'flex-start', 'center': 'center', 'end': 'flex-end',
            'space_between': 'space-between', 'space_around': 'space-around', 'space_evenly': 'space-evenly'
        };

        const flexAlignCrossMap: Record<string, string> = {
            'start': 'flex-start', 'center': 'center', 'end': 'flex-end', 'stretch': 'stretch'
        };

        const flexFlowMap: Record<string, string> = {
            'row': 'row', 'column': 'column', 'row_wrap': 'row wrap', 'column_wrap': 'column wrap'
        };

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
            color: resolveValue(s.text_color || '#ffffff'),
            textAlign: s.text_align ? (s.text_align.toLowerCase() as any) : 'left',
            borderWidth: s.border_width ? `${s.border_width}px` : (node.type === 'object' ? '1px' : 0),
            borderStyle: s.border_width ? 'solid' : (node.type === 'object' ? 'dashed' : 'none'),
            borderColor: resolveValue(s.border_color || (node.type === 'object' ? 'hsl(var(--primary) / 0.3)' : 'transparent')),
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
            cursor: (isRoot ? 'default' : 'move'),
            outline: isOver ? '2px dashed var(--text-accent)' : 'none',
            outlineOffset: '-1px',
            zIndex: isRoot ? 1 : (isSelected ? 100 : 10),
            opacity: isDragging ? 0.5 : (node.hidden ? 0.4 : 1),
            overflow: 'visible',
            fontFamily: `"${resolveFontFamily(s.text_font)}", sans-serif`,
            fontSize: resolveFontSize(s.text_font) ? `${resolveFontSize(s.text_font)}px` : undefined
        };

        if (node.grid_cell_column_pos !== undefined) {
            styles.gridColumn = `${node.grid_cell_column_pos + 1} / span ${node.grid_cell_column_span || 1}`;
            styles.position = 'relative'; styles.left = 'auto'; styles.top = 'auto';
        }
        if (node.grid_cell_row_pos !== undefined) {
            styles.gridRow = `${node.grid_cell_row_pos + 1} / span ${node.grid_cell_row_span || 1}`;
            styles.position = 'relative'; styles.left = 'auto'; styles.top = 'auto';
        }
        if (node.grid_cell_x_align) styles.justifySelf = node.grid_cell_x_align;
        if (node.grid_cell_y_align) styles.alignSelf = node.grid_cell_y_align;

        if (styles.justifySelf === 'stretch' || styles.alignSelf === 'stretch' || (nodeLayout.flex_grow && nodeLayout.flex_grow > 0)) {
            if (!isRoot) {
                const isRowParent = parentLayout === 'flex' && (!parentFlexFlow || parentFlexFlow.startsWith('row'));
                const isColParent = parentLayout === 'flex' && (parentFlexFlow && parentFlexFlow.startsWith('column'));
                if (styles.justifySelf === 'stretch' || (isRowParent && nodeLayout.flex_grow)) styles.width = 'auto';
                if (styles.alignSelf === 'stretch' || (isColParent && nodeLayout.flex_grow)) styles.height = 'auto';
            }
        }

        if (node.align === 'center' && !isFlex) {
            styles.left = '50%'; styles.top = '50%'; styles.transform = 'translate(-50%, -50%)';
        }

        return styles;
    };

    const renderContent = (s: StyleProperties) => {
        const text = resolveValue(node.text || '');
        const resolvedFontName = resolveValue(s.text_font);
        const fontAsset = assets.find(a => a.type === 'font' && a.value === resolvedFontName);
        const fontSize = fontAsset?.size ? `${fontAsset.size}px` : (resolveFontSize(resolvedFontName) ? `${resolveFontSize(resolvedFontName)}px` : undefined);
        const fontFamily = fontAsset?.family ? `"${fontAsset.family}", sans-serif` : `"${resolveFontFamily(resolvedFontName)}", sans-serif`;
        const fontWeight = (resolvedFontName?.toLowerCase().includes('bold') || (fontAsset?.name?.toLowerCase().includes('bold'))) ? 'bold' : 'normal';

        const isIcon = text.startsWith('mdi:') ||
            (text.length === 1 && text.charCodeAt(0) >= 0xE000) ||
            (text.length === 2 && text.charCodeAt(0) >= 0xD800 && text.charCodeAt(0) <= 0xDBFF);
        const iconName = text.startsWith('mdi:') ? text.slice(4) : null;

        switch (node.type) {
            case 'label':
            case 'button':
                if (isIcon) {
                    if (iconName) return <i className={`mdi mdi-${iconName}`} style={{ fontSize: fontSize || '1.2em' }}></i>;
                    return <span style={{ fontSize: fontSize || '1.2em', fontFamily: '"Material Design Icons", sans-serif' }}>{text}</span>;
                }
                return <span style={{ fontFamily, fontSize, fontWeight, textAlign: s.text_align ? (s.text_align.toLowerCase() as any) : 'inherit', width: '100%' }}>{text}</span>;
            case 'arc': {
                const r = 40, cx = 50, cy = 50;
                const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
                    const rad = (angle * Math.PI) / 180.0;
                    return { x: cx + (r * Math.cos(rad)), y: cy + (r * Math.sin(rad)) };
                };
                const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
                    const s = polarToCartesian(x, y, radius, endAngle), e = polarToCartesian(x, y, radius, startAngle);
                    return ["M", s.x, s.y, "A", radius, radius, 0, (endAngle - startAngle <= 180 ? "0" : "1"), 0, e.x, e.y].join(" ");
                };
                const start = node.start_angle ?? 135, end = node.end_angle ?? 45, min = node.range_min ?? 0, max = node.range_max ?? 100, val = node.value ?? 0;
                const totalRange = (end < start) ? (360 - start + end) : (end - start);
                const valAngle = start + (totalRange * (val - min) / (max - min));
                return (
                    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: `rotate(${node.rotation ?? 0}deg)` }}>
                        <path d={describeArc(cx, cy, r, start, end)} fill="none" stroke={resolveValue(s.bg_color || '#444')} strokeWidth={s.arc_width || 4} strokeLinecap="round" />
                        <path d={describeArc(cx, cy, r, start, valAngle)} fill="none" stroke={resolveValue(s.arc_color || '#007acc')} strokeWidth={s.arc_width || 4} strokeLinecap="round" />
                    </svg>
                );
            }
            case 'bar':
            case 'slider': {
                const percent = Math.min(100, Math.max(0, (((node.value ?? 0) - (node.range_min ?? 0)) / ((node.range_max ?? 100) - (node.range_min ?? 0))) * 100));
                return (
                    <div style={{ background: resolveValue(s.bg_color || '#555'), width: '100%', height: '100%', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ background: resolveValue(s.arc_color || '#007acc'), width: `${percent}%`, height: '100%', transition: 'width 0.2s' }} />
                        {node.type === 'slider' && <div style={{ position: 'absolute', left: `${percent}%`, top: '50%', transform: 'translate(-50%, -50%)', width: '12px', height: '24px', background: '#fff', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.3)', zIndex: 2 }} />}
                    </div>
                );
            }
            case 'switch':
                return (
                    <div style={{ background: node.checked ? resolveValue(s.arc_color || '#007acc') : resolveValue(s.bg_color || '#555'), width: '40px', height: '24px', borderRadius: '12px', position: 'relative', transition: 'background 0.2s' }}>
                        <div style={{ background: '#fff', width: '18px', height: '18px', borderRadius: '50%', position: 'absolute', top: '3px', left: node.checked ? '19px' : '3px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
                    </div>
                );
            case 'checkbox':
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '100%', width: '100%' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '4px', border: `2px solid ${resolveValue(s.arc_color || '#007acc')}`, background: node.checked ? resolveValue(s.arc_color || '#007acc') : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {node.checked && <span style={{ color: '#fff', fontSize: '14px' }}>✓</span>}
                        </div>
                        <span style={{ color: s.text_color || '#fff', fontSize: fontSize || '14px', fontFamily }}>{resolveValue(node.text || '')}</span>
                    </div>
                );
            case 'spinbox':
                return (
                    <div style={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%', background: resolveValue(s.bg_color || '#333'), borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ padding: '0 8px', background: '#444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>-</div>
                        <div style={{ flex: 1, textAlign: 'center', color: resolveValue(s.text_color || '#fff') }}>{node.value ?? 0}</div>
                        <div style={{ padding: '0 8px', background: '#444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>+</div>
                    </div>
                );
            case 'dropdown':
                return (
                    <div style={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%', background: resolveValue(s.bg_color || '#333'), borderRadius: '4px', padding: '0 8px', justifyContent: 'space-between' }}>
                        <span style={{ color: resolveValue(s.text_color || '#fff') }}>{(node.options?.split('\n') || ['Option 1'])[0]}</span>
                        <span style={{ color: resolveValue(s.text_color || '#fff') }}>▼</span>
                    </div>
                );
            case 'roller': {
                const options = node.options?.split('\n') || ['Opt 1', 'Opt 2', 'Opt 3'];
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', background: resolveValue(s.bg_color || '#333'), borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                        <div style={{ color: resolveValue(s.text_color || '#888'), opacity: 0.5, fontSize: '0.8em' }}>{options[0]}</div>
                        <div style={{ color: resolveValue(s.text_color || '#fff'), borderTop: `1px solid ${resolveValue(s.arc_color || '#007acc')}`, borderBottom: `1px solid ${resolveValue(s.arc_color || '#007acc')}`, width: '100%', textAlign: 'center', padding: '4px 0', margin: '4px 0' }}>{options[1] || options[0]}</div>
                        <div style={{ color: resolveValue(s.text_color || '#888'), opacity: 0.5, fontSize: '0.8em' }}>{options[2] || ''}</div>
                    </div>
                );
            }
            case 'textarea':
                return <div style={{ width: '100%', height: '100%', background: resolveValue(s.bg_color || '#222'), color: resolveValue(s.text_color || '#ccc'), padding: '8px', borderRadius: '4px', border: '1px solid #444', overflow: 'hidden', whiteSpace: 'pre-wrap', fontFamily }}>{resolveValue(node.text || 'Textarea...')}</div>;
            case 'led':
                const ledColor = node.checked ? resolveValue(s.bg_color || '#ff0000') : '#333';
                return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
                        <div style={{ width: 'min(100%, 100%)', aspectRatio: '1', borderRadius: '50%', background: ledColor, boxShadow: node.checked ? `0 0 10px ${ledColor}, inset 0 0 5px rgba(255,255,255,0.5)` : 'inset 0 2px 4px rgba(0,0,0,0.5)', transition: 'all 0.2s' }} />
                    </div>
                );
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
            default: return null;
        }
    };

    const isColorDark = (color: string) => {
        if (color === 'transparent' || !color.startsWith('#')) return true;
        const hex = color.slice(1);
        const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
        return ((r * 299 + g * 587 + b * 114) / 1000) < 128;
    };

    const gridColor = isColorDark(node.styles?.bg_color || '#000000') ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)';

    return (
        <div ref={setRef} className={`widget-node widget-type-${node.type} ${isSelected ? 'selected' : ''}`} style={getStyles()} onClick={handleClick} onMouseDown={handleDragStart} data-widget-id={node.id}>
            {isRoot && gridConfig.visible && <div className="grid-overlay" style={{ position: 'absolute', top: 0, left: 0, width: 'calc(100% + 1px)', height: 'calc(100% + 1px)', pointerEvents: 'none', zIndex: -1, backgroundImage: `radial-gradient(circle at 0px 0px, ${gridColor} 1px, transparent 0)`, backgroundSize: `${gridConfig.size}px ${gridConfig.size}px`, backgroundPosition: '0 0' }} />}
            {renderContent(s)}
            {node.children && node.children.map(child => <WidgetRenderer key={child.id} node={child} parentId={node.id} parentLayout={node.layout?.type || 'absolute'} parentFlexFlow={node.layout?.flex_flow} />)}
            {isSelected && (
                <>
                    <div className="resize-handle top-left" onMouseDown={handleResizeStart('nw')} />
                    <div className="resize-handle top-right" onMouseDown={handleResizeStart('ne')} />
                    <div className="resize-handle bottom-left" onMouseDown={handleResizeStart('sw')} />
                    <div className="resize-handle bottom-right" onMouseDown={handleResizeStart('se')} />
                </>
            )}
        </div>
    );
};
