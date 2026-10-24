import React, { useState, useCallback, useEffect } from 'react';
import { WidgetNode, Asset, StyleProperties, MeterScale, MeterIndicator } from '../../types';
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
    const [activeTabIndex, setActiveTabIndex] = useState(0);

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
        if (isResizing || isRoot || node.type === 'tab') return;

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

            // If dropping a widget onto a tabview, redirect it to the active tab
            if (item.type !== 'tab' && node.type === 'tabview') {
                const tabs = node.children.filter(c => c.type === 'tab');
                const activeTab = tabs[activeTabIndex];
                if (activeTab) {
                    if (item.id) {
                        useStore.getState().moveWidget(item.id, activeTab.id, 0);
                    } else if (item.type) {
                        const newWidget: WidgetNode = {
                            id: uuidv4(),
                            type: item.type as any,
                            name: `${item.type}_${Date.now().toString().slice(-4)}`,
                            x: 0, y: 0, // Reset to 0 since it's inside the tab
                            width: (item.type === 'slider' || item.type === 'bar') ? 150 : (item.type === 'image' || item.type === 'meter' ? 100 : 100),
                            height: (item.type === 'slider' || item.type === 'bar') ? 20 : (item.type === 'image' || item.type === 'meter' ? 100 : 40),
                            text: item.type === 'label' || item.type === 'button' ? `${item.type}` : undefined,
                            children: []
                        };
                        useStore.getState().addWidget(activeTab.id, newWidget);
                    }
                    return;
                }
            }

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
                    width: (item.type === 'slider' || item.type === 'bar') ? 150 : (item.type === 'image' || item.type === 'meter' || item.type === 'scale' || item.type === 'tabview' ? 200 : 100),
                    height: (item.type === 'slider' || item.type === 'bar') ? 20 : (item.type === 'meter' || item.type === 'scale' ? 200 : (item.type === 'tabview' ? 180 : (item.type === 'image' ? 100 : 40))),
                    text: item.type === 'label' || item.type === 'button' || item.type === 'checkbox' ? `${item.type}` : undefined,
                    src: item.type === 'image' ? undefined : undefined,
                    range_min: (item.type === 'slider' || item.type === 'bar' || item.type === 'arc' || item.type === 'meter' || item.type === 'scale' || item.type === 'spinbox') ? 0 : undefined,
                    range_max: (item.type === 'slider' || item.type === 'bar' || item.type === 'arc' || item.type === 'meter' || item.type === 'scale' || item.type === 'spinbox') ? 100 : undefined,
                    value: (item.type === 'slider' || item.type === 'bar' || item.type === 'arc' || item.type === 'meter' || item.type === 'scale' || item.type === 'spinbox') ? 50 : undefined,
                    start_angle: item.type === 'arc' ? 135 : undefined,
                    end_angle: item.type === 'arc' ? 45 : undefined,
                    scale_mode: item.type === 'scale' ? 'ROUND_OUTER' : undefined,
                    angle_range: item.type === 'scale' ? 270 : undefined,
                    rotation: item.type === 'scale' ? 135 : undefined,
                    digits: item.type === 'spinbox' ? 3 : undefined,
                    decimal_places: item.type === 'spinbox' ? 0 : undefined,
                    selected_digit: item.type === 'spinbox' ? 0 : undefined,
                    scale: item.type === 'image' ? 1.0 : undefined,
                    checkable: (item.type === 'switch' || item.type === 'checkbox') ? true : undefined,
                    children: item.type === 'tabview' ? [{
                        id: uuidv4(),
                        type: 'tab',
                        name: `tab_1`,
                        text: 'Tab 1',
                        x: 0, y: 0, width: '100%', height: '100%',
                        children: []
                    }] : []
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
            width: (isRoot || node.type === 'tab') ? '100%' : processDim(node.width),
            height: (isRoot || node.type === 'tab') ? '100%' : processDim(node.height),
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
            case 'spinbox': {
                const rawVal = node.value ?? 0;
                const digitsCount = node.digits ?? 3;
                const decPlaces = node.decimal_places ?? 0;
                const selDigit = node.selected_digit ?? 0;

                let str = Math.abs(rawVal).toString().padStart(digitsCount, '0');
                if (decPlaces > 0 && decPlaces < str.length) {
                    str = str.slice(0, str.length - decPlaces) + '.' + str.slice(str.length - decPlaces);
                }
                const chars = str.split('');
                let digitCounter = 0;

                return (
                    <div style={{ display: 'flex', alignItems: 'center', height: '100%', width: '100%', background: resolveValue(s.bg_color || '#333'), borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ padding: '0 8px', background: '#444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', height: '100%', userSelect: 'none' }}>-</div>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: resolveValue(s.text_color || '#fff'), fontFamily: 'monospace', fontSize: fontSize || '1rem', letterSpacing: '2px' }}>
                            {rawVal < 0 && <span>-</span>}
                            {chars.map((char, cIdx) => {
                                if (char === '.') return <span key={cIdx}>.</span>;
                                const curDigitPos = digitsCount - 1 - (digitCounter++);
                                const isSelected = curDigitPos === selDigit;
                                return (
                                    <span key={cIdx} style={{
                                        borderBottom: isSelected ? '2px solid hsl(var(--primary))' : 'none',
                                        background: isSelected ? 'rgba(0, 150, 255, 0.25)' : 'transparent',
                                        borderRadius: '2px',
                                        padding: '0 1px'
                                    }}>
                                        {char}
                                    </span>
                                );
                            })}
                        </div>
                        <div style={{ padding: '0 8px', background: '#444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', height: '100%', userSelect: 'none' }}>+</div>
                    </div>
                );
            }
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
            case 'meter': {
                const scales: MeterScale[] = node.meter_scales && node.meter_scales.length > 0 ? node.meter_scales : [{
                    range_from: node.range_min ?? 0,
                    range_to: node.range_max ?? 100,
                    angle_range: 270,
                    rotation: 0,
                    ticks: { count: 12, color: '#888', width: 2, length: 10, major: { stride: 3, width: 4, length: '15%', color: '#fff' } },
                    indicators: [{ type: 'line', value: node.value ?? 50, color: '#ff4444', width: 3 }]
                }];

                return (
                    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
                            {scales.map((scale, sIdx) => {
                                const min = scale.range_from;
                                const max = scale.range_to;
                                const angleRange = scale.angle_range ?? 270;
                                const rotationOffset = (scale.rotation ?? 0) + 135; // LVGL 0 is usually at 135deg (top-leftish)

                                const valToAngle = (val: number) => {
                                    const percent = (val - min) / (max - min);
                                    return rotationOffset + (percent * angleRange);
                                };

                                return (
                                    <g key={sIdx}>
                                        {/* Ticks */}
                                        {[...Array(scale.ticks.count)].map((_, i) => {
                                            const angle = (rotationOffset + (i * (angleRange / (scale.ticks.count - 1)))) * Math.PI / 180;
                                            const isMajor = scale.ticks.major && scale.ticks.major.stride && (i % scale.ticks.major.stride === 0);

                                            const tickLen = isMajor
                                                ? (typeof scale.ticks.major?.length === 'string' ? parseFloat(scale.ticks.major.length) / 2 : (scale.ticks.major?.length || 15))
                                                : (scale.ticks.length || 10);
                                            const tickWidth = isMajor ? (scale.ticks.major?.width || 4) : (scale.ticks.width || 2);
                                            const tickColor = isMajor ? (scale.ticks.major?.color || '#fff') : (scale.ticks.color || '#888');

                                            const x1 = 50 + (48 - tickLen) * Math.cos(angle);
                                            const y1 = 50 + (48 - tickLen) * Math.sin(angle);
                                            const x2 = 50 + 48 * Math.cos(angle);
                                            const y2 = 50 + 48 * Math.sin(angle);

                                            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={resolveValue(tickColor)} strokeWidth={tickWidth / 2} />;
                                        })}

                                        {/* Indicators */}
                                        {scale.indicators?.map((ind: MeterIndicator, iIdx: number) => {
                                            if (ind.type === 'arc') {
                                                const start = valToAngle(ind.start_value ?? min);
                                                const end = valToAngle(ind.end_value ?? max);
                                                const r = 40 + (ind.r_mod ?? 0);

                                                const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
                                                    const rad = (angle * Math.PI) / 180.0;
                                                    return { x: cx + (r * Math.cos(rad)), y: cy + (r * Math.sin(rad)) };
                                                };

                                                const sP = polarToCartesian(50, 50, r, start);
                                                const eP = polarToCartesian(50, 50, r, end);
                                                const largeArcFlag = end - start <= 180 ? "0" : "1";
                                                const d = ["M", sP.x, sP.y, "A", r, r, 0, largeArcFlag, 1, eP.x, eP.y].join(" ");

                                                return <path key={iIdx} d={d} fill="none" stroke={resolveValue(ind.color || '#007acc')} strokeWidth={ind.width || 4} strokeLinecap="round" style={{ opacity: (ind.opa ?? 100) / 100 }} />;
                                            }

                                            if (ind.type === 'line') {
                                                const angle = valToAngle(ind.value ?? node.value ?? 50) * Math.PI / 180;
                                                const r = 40 + (ind.r_mod ?? 0);
                                                const x2 = 50 + r * Math.cos(angle);
                                                const y2 = 50 + r * Math.sin(angle);

                                                return (
                                                    <g key={iIdx}>
                                                        <line
                                                            x1="50" y1="50"
                                                            x2={x2} y2={y2}
                                                            stroke={resolveValue(ind.color || '#ff4444')}
                                                            strokeWidth={ind.width || 3}
                                                            strokeLinecap="round"
                                                            style={{ opacity: (ind.opa ?? 100) / 100 }}
                                                        />
                                                        <circle cx="50" cy="50" r="4" fill={resolveValue(ind.color || '#ff4444')} />
                                                    </g>
                                                );
                                            }

                                            if (ind.type === 'image') {
                                                const angle = valToAngle(ind.value ?? node.value ?? 50);
                                                const imgAsset = assets.find(a => a.type === 'image' && (a.value === ind.src || a.name === ind.src));
                                                if (imgAsset && imgAsset.source) {
                                                    return (
                                                        <image
                                                            key={iIdx}
                                                            href={imgAsset.source}
                                                            x={50 - (ind.pivot_x ?? 50)}
                                                            y={50 - (ind.pivot_y ?? 10)}
                                                            width={imgAsset.width ? (imgAsset.width / (imgAsset.height || 100) * 100) : 100}
                                                            height="100"
                                                            style={{
                                                                transform: `rotate(${angle}deg)`,
                                                                transformOrigin: `${ind.pivot_x ?? 50}px ${ind.pivot_y ?? 10}px`,
                                                                opacity: (ind.opa ?? 100) / 100
                                                            }}
                                                        />
                                                    );
                                                }
                                            }
                                            return null;
                                        })}
                                    </g>
                                );
                            })}
                        </svg>
                    </div>
                );
            }
            case 'scale': {
                const mode = node.scale_mode || 'ROUND_OUTER';
                const min = node.range_min ?? node.min_value ?? 0;
                const max = node.range_max ?? node.max_value ?? 100;
                const val = Math.max(min, Math.min(max, node.value ?? min));
                const totalTicks = node.ticks_count || 11;
                const majorStride = node.major_ticks_stride || 2;
                const tickColor = resolveValue(s.line_color || s.border_color || '#888');
                const majorColor = resolveValue(s.text_color || '#fff');
                const accentColor = resolveValue(s.arc_color || '#007acc');

                if (mode === 'HORIZONTAL_TOP' || mode === 'HORIZONTAL_BOTTOM') {
                    const isTop = mode === 'HORIZONTAL_TOP';
                    const percent = (val - min) / (max - min || 1);
                    return (
                        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', padding: '0 10px', boxSizing: 'border-box' }}>
                            <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                                <line x1="0" y1="20" x2="100" y2="20" stroke={tickColor} strokeWidth="1.5" />
                                {[...Array(totalTicks)].map((_, i) => {
                                    const x = (i / (totalTicks - 1)) * 100;
                                    const isMajor = i % majorStride === 0;
                                    const len = isMajor ? 10 : 5;
                                    const y2 = isTop ? 20 - len : 20 + len;
                                    const tickVal = Math.round(min + (i / (totalTicks - 1)) * (max - min));
                                    return (
                                        <g key={i}>
                                            <line x1={x} y1="20" x2={x} y2={y2} stroke={isMajor ? majorColor : tickColor} strokeWidth={isMajor ? 1.5 : 1} />
                                            {isMajor && (
                                                <text x={x} y={isTop ? 20 - len - 3 : 20 + len + 8} fill={majorColor} fontSize="5" textAnchor="middle" style={{ userSelect: 'none' }}>
                                                    {tickVal}
                                                </text>
                                            )}
                                        </g>
                                    );
                                })}
                                <polygon points={`${percent * 100 - 3},${isTop ? 23 : 17} ${percent * 100 + 3},${isTop ? 23 : 17} ${percent * 100},20`} fill={accentColor} />
                            </svg>
                        </div>
                    );
                }

                if (mode === 'VERTICAL_LEFT' || mode === 'VERTICAL_RIGHT') {
                    const isLeft = mode === 'VERTICAL_LEFT';
                    const percent = (val - min) / (max - min || 1);
                    return (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '10px 0', boxSizing: 'border-box' }}>
                            <svg viewBox="0 0 40 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                                <line x1="20" y1="0" x2="20" y2="100" stroke={tickColor} strokeWidth="1.5" />
                                {[...Array(totalTicks)].map((_, i) => {
                                    const y = 100 - (i / (totalTicks - 1)) * 100;
                                    const isMajor = i % majorStride === 0;
                                    const len = isMajor ? 10 : 5;
                                    const x2 = isLeft ? 20 - len : 20 + len;
                                    const tickVal = Math.round(min + (i / (totalTicks - 1)) * (max - min));
                                    return (
                                        <g key={i}>
                                            <line x1="20" y1={y} x2={x2} y2={y} stroke={isMajor ? majorColor : tickColor} strokeWidth={isMajor ? 1.5 : 1} />
                                            {isMajor && (
                                                <text x={isLeft ? 20 - len - 3 : 20 + len + 3} y={y + 2} fill={majorColor} fontSize="5" textAnchor={isLeft ? 'end' : 'start'} dominantBaseline="middle" style={{ userSelect: 'none' }}>
                                                    {tickVal}
                                                </text>
                                            )}
                                        </g>
                                    );
                                })}
                                <polygon points={`${isLeft ? 23 : 17},${100 - percent * 100 - 3} ${isLeft ? 23 : 17},${100 - percent * 100 + 3} 20,${100 - percent * 100}`} fill={accentColor} />
                            </svg>
                        </div>
                    );
                }

                // Round Mode
                const angleRange = node.angle_range ?? 270;
                const rotationOffset = (node.rotation ?? 135);
                const percent = (val - min) / (max - min || 1);
                const needleAngle = (rotationOffset + percent * angleRange) * Math.PI / 180;
                const isInner = mode === 'ROUND_INNER';

                return (
                    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
                            {[...Array(totalTicks)].map((_, i) => {
                                const angle = (rotationOffset + (i / (totalTicks - 1)) * angleRange) * Math.PI / 180;
                                const isMajor = i % majorStride === 0;
                                const tickLen = isMajor ? 12 : 7;
                                const tickW = isMajor ? 2.5 : 1.2;
                                const rOuter = 46;
                                const rInner = isInner ? rOuter - tickLen : rOuter - tickLen;

                                const x1 = 50 + rInner * Math.cos(angle);
                                const y1 = 50 + rInner * Math.sin(angle);
                                const x2 = 50 + rOuter * Math.cos(angle);
                                const y2 = 50 + rOuter * Math.sin(angle);

                                const tickVal = Math.round(min + (i / (totalTicks - 1)) * (max - min));
                                const labelR = isInner ? rOuter - tickLen - 6 : rOuter - tickLen - 6;
                                const lx = 50 + labelR * Math.cos(angle);
                                const ly = 50 + labelR * Math.sin(angle);

                                return (
                                    <g key={i}>
                                        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={isMajor ? majorColor : tickColor} strokeWidth={tickW} strokeLinecap="round" />
                                        {isMajor && (
                                            <text x={lx} y={ly} fill={majorColor} fontSize="4.5" textAnchor="middle" dominantBaseline="middle" style={{ userSelect: 'none' }}>
                                                {tickVal}
                                            </text>
                                        )}
                                    </g>
                                );
                            })}
                            <line
                                x1="50" y1="50"
                                x2={50 + 36 * Math.cos(needleAngle)}
                                y2={50 + 36 * Math.sin(needleAngle)}
                                stroke={accentColor}
                                strokeWidth="2.5"
                                strokeLinecap="round"
                            />
                            <circle cx="50" cy="50" r="4" fill={accentColor} />
                            <circle cx="50" cy="50" r="2" fill="#fff" />
                        </svg>
                    </div>
                );
            }
            case 'image': {
                const imgAsset = assets.find(a => a.type === 'image' && (a.value === node.src || a.name === node.src));
                const scaleX = node.scale_x ?? node.scale ?? 1.0;
                const scaleY = node.scale_y ?? node.scale ?? 1.0;
                const rot = node.rotation ?? 0;
                const transform = `scale(${scaleX}, ${scaleY}) rotate(${rot}deg)`;

                if (imgAsset && imgAsset.source) {
                    const isRenderable = imgAsset.source.startsWith('http') || imgAsset.source.startsWith('data:');
                    if (isRenderable) {
                        return <img src={imgAsset.source} style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', transform, transformOrigin: 'center center', transition: 'transform 0.2s' }} alt={node.name} />;
                    }
                }
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '4px', overflow: 'hidden', transform, transformOrigin: 'center center' }}>
                        <span className="mdi mdi-image-outline" style={{ fontSize: '1.5rem', opacity: 0.3 }} />
                        <span style={{ fontSize: '0.6rem', opacity: 0.5, marginTop: '4px', textAlign: 'center', padding: '0 4px', wordBreak: 'break-all' }}>{node.src || 'No Image'}</span>
                    </div>
                );
            }
            case 'tabview': {
                const tabs = node.children.filter(c => c.type === 'tab');
                const pos = node.tab_position || 'TOP';
                const isVertical = pos === 'LEFT' || pos === 'RIGHT';
                const isReverse = pos === 'BOTTOM' || pos === 'RIGHT';

                return (
                    <div style={{
                        display: 'flex',
                        flexDirection: isVertical ? (isReverse ? 'row-reverse' : 'row') : (isReverse ? 'column-reverse' : 'column'),
                        width: '100%',
                        height: '100%',
                        background: resolveValue(s.bg_color || '#333'),
                        borderRadius: '4px',
                        overflow: 'hidden'
                    }}>
                        <div className="tabview-header" style={{
                            display: 'flex',
                            flexDirection: isVertical ? 'column' : 'row',
                            background: 'rgba(0,0,0,0.2)',
                            height: isVertical ? '100%' : '40px',
                            width: isVertical ? '80px' : '100%',
                            borderBottom: !isVertical && pos === 'TOP' ? '1px solid rgba(255,255,255,0.1)' : 'none',
                            borderTop: !isVertical && pos === 'BOTTOM' ? '1px solid rgba(255,255,255,0.1)' : 'none',
                            borderRight: isVertical && pos === 'LEFT' ? '1px solid rgba(255,255,255,0.1)' : 'none',
                            borderLeft: isVertical && pos === 'RIGHT' ? '1px solid rgba(255,255,255,0.1)' : 'none',
                            overflowX: isVertical ? 'hidden' : 'auto',
                            overflowY: isVertical ? 'auto' : 'hidden',
                            flexShrink: 0
                        }}>
                            {tabs.map((tab, idx) => (
                                <div
                                    key={tab.id}
                                    onClick={(e) => { e.stopPropagation(); setActiveTabIndex(idx); }}
                                    style={{
                                        padding: isVertical ? '12px 8px' : '0 16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        fontSize: '0.8rem',
                                        fontWeight: activeTabIndex === idx ? 'bold' : 'normal',
                                        color: activeTabIndex === idx ? 'hsl(var(--primary))' : 'hsl(var(--text-muted))',
                                        borderBottom: (!isVertical && activeTabIndex === idx) ? '2px solid hsl(var(--primary))' : 'none',
                                        borderLeft: (isVertical && activeTabIndex === idx && pos === 'LEFT') ? '3px solid hsl(var(--primary))' : 'none',
                                        borderRight: (isVertical && activeTabIndex === idx && pos === 'RIGHT') ? '3px solid hsl(var(--primary))' : 'none',
                                        background: activeTabIndex === idx ? 'rgba(255,255,255,0.05)' : 'transparent',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {tab.text || tab.name}
                                </div>
                            ))}
                        </div>
                        <div className="tabview-content" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                            {tabs[activeTabIndex] && (
                                <WidgetRenderer
                                    key={tabs[activeTabIndex].id}
                                    node={tabs[activeTabIndex]}
                                    parentId={node.id}
                                    parentLayout="absolute"
                                />
                            )}
                        </div>
                    </div>
                );
            }
            case 'tab': {
                return (
                    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                        {node.children && node.children.map(child => (
                            <WidgetRenderer
                                key={child.id}
                                node={child}
                                parentId={node.id}
                                parentLayout={node.layout?.type || 'absolute'}
                                parentFlexFlow={node.layout?.flex_flow}
                            />
                        ))}
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
            {node.type !== 'tabview' && node.type !== 'tab' && node.children && node.children.map(child => <WidgetRenderer key={child.id} node={child} parentId={node.id} parentLayout={node.layout?.type || 'absolute'} parentFlexFlow={node.layout?.flex_flow} />)}
            {isSelected && node.type !== 'tab' && (
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
