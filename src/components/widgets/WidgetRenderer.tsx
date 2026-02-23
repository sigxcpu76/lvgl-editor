import React, { useState, useCallback, useEffect } from 'react';
import { WidgetNode, Asset, StyleProperties } from '../../types';
import { useStore } from '../../store';
import { useDrag, useDrop } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { v4 as uuidv4 } from 'uuid';

interface Props {
    node: WidgetNode;
    isRoot?: boolean;
    parentId?: string | null;
    parentLayout?: string;
    parentFlexFlow?: string;
}

export const WidgetRenderer: React.FC<Props> = ({ node, isRoot, parentId = null, parentLayout = 'absolute', parentFlexFlow }) => {
    const { selectedId, setSelectedId, updateWidget, gridConfig, canvasConfig, assets, substitutions } = useStore();

    const resolveValue = useCallback((val: any): any => {
        if (typeof val !== 'string') return val;
        let str = val;
        Object.entries(substitutions).forEach(([key, value]) => {
            str = str.replace(new RegExp(`\\$\\{${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'g'), value);
            str = str.replace(new RegExp(`\\$${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-zA-Z0-9_])`, 'g'), value);
        });
        return str;
    }, [substitutions]);
    const isSelected = selectedId === node.id;
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

        const onMouseMove = (moveEvent: MouseEvent) => {
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
            });
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
        e.stopPropagation();
        e.preventDefault();

        setSelectedId(node.id);

        const startX = e.clientX;
        const startY = e.clientY;
        const startXPos = typeof node.x === 'number' ? node.x : 0;
        const startYPos = typeof node.y === 'number' ? node.y : 0;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const areaEl = document.querySelector('.lvgl-screen');
            const rect = areaEl?.getBoundingClientRect();
            const scale = rect ? (rect.width / canvasConfig.width) : 1;

            const deltaX = (moveEvent.clientX - startX) / scale;
            const deltaY = (moveEvent.clientY - startY) / scale;

            const x = snapValue(startXPos + deltaX);
            const y = snapValue(startYPos + deltaY);

            if (node.x !== x || node.y !== y) {
                updateWidget(node.id, { x, y });
            }
        };

        const onMouseUp = (upEvent: MouseEvent) => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);

            if (!containerRef.current) return;

            // Temporarily ignore the dragged element to find what's underneath
            const originalPointerEvents = containerRef.current.style.pointerEvents;
            containerRef.current.style.pointerEvents = 'none';

            const dropEl = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
            const targetWidget = dropEl?.closest('.widget-node') as HTMLElement;
            const targetId = targetWidget?.getAttribute('data-widget-id');
            const canvasEl = dropEl?.closest('.lvgl-screen');

            // Restore pointer events
            containerRef.current.style.pointerEvents = originalPointerEvents;

            if (targetId && targetId !== node.id && targetId !== parentId) {
                // Drop into a new container
                useStore.getState().moveWidget(node.id, targetId, 0);
            } else if (canvasEl && !targetWidget && parentId !== null) {
                // Explicitly dropped on canvas background (no other widget beneath)
                useStore.getState().moveWidget(node.id, null, 0);
            }
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }, [node.id, node.x, node.y, parentId, isResizing, updateWidget, setSelectedId, canvasConfig, snapValue]);

    const [{ isDragging }, dragRef, dragPreview] = useDrag({
        type: 'widget',
        item: { type: node.type, id: node.id, x: node.x, y: node.y },
        canDrag: false, // We use manual dragging for existing widgets now
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

            // Handle asset drop on existing widget
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
                const newWidget = {
                    id: uuidv4(),
                    type: item.type as any,
                    name: `${item.type}_${Date.now().toString().slice(-4)}`,
                    x, y,
                    width: item.type === 'slider' || item.type === 'bar' ? 150 : 100,
                    height: item.type === 'slider' || item.type === 'bar' ? 20 : 40,
                    text: item.type === 'label' || item.type === 'button' ? `${item.type}` : undefined,
                    children: []
                };
                useStore.getState().addWidget(node.id, newWidget);
                useStore.getState().setSelectedId(newWidget.id);
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
        setSelectedId(node.id);
    };

    // Map LVGL styles to CSS React styles
    const s = node.styles || {};
    const getStyles = (): React.CSSProperties => {

        // Handle background color with opacity
        let bgColor = resolveValue(s.bg_color || 'transparent');
        if (s.bg_opa !== undefined && bgColor !== 'transparent') {
            // Basic support for hex to rgba conversion
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

        // Handle dimensions
        const processDim = (dim: number | string | undefined) => {
            const resolved = resolveValue(dim);
            if (resolved === 'content' || resolved === 'size_content') return 'auto';
            if (typeof resolved === 'number') return `${resolved}px`;
            if (typeof resolved === 'string' && resolved.endsWith('fr')) return resolved;
            if (typeof resolved === 'string' && !isNaN(Number(resolved))) return `${resolved}px`;
            return resolved; // e.g. "100%"
        };

        // Handle Layout
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

        const styles: React.CSSProperties = {
            position: (isRoot || parentLayout === 'flex' || parentLayout === 'grid' || isFlex || isGrid) ? 'relative' : 'absolute',
            left: isRoot ? 0 : (node.x !== undefined ? processDim(node.x) : undefined),
            top: isRoot ? 0 : (node.y !== undefined ? processDim(node.y) : undefined),
            width: isRoot ? '100%' : processDim(node.width),
            height: isRoot ? '100%' : processDim(node.height),
            backgroundColor: bgColor,
            color: s.text_color || '#ffffff',
            borderColor: s.border_color || 'transparent',
            borderWidth: s.border_width ? `${s.border_width}px` : 0,
            borderStyle: s.border_width ? 'solid' : 'none',
            borderRadius: s.radius ? `${s.radius}px` : 0,
            paddingTop: s.pad_top ?? s.pad_all ?? 0,
            paddingBottom: s.pad_bottom ?? s.pad_all ?? 0,
            paddingLeft: s.pad_left ?? s.pad_all ?? 0,
            paddingRight: s.pad_right ?? s.pad_all ?? 0,
            boxShadow,
            display: isFlex ? 'flex' : (isGrid ? 'grid' : 'block'),
            flexDirection: isFlex ? ((nodeLayout.flex_flow && flexFlowMap[nodeLayout.flex_flow]?.split(' ')[0] as any) || 'row') : undefined,
            flexWrap: isFlex ? ((nodeLayout.flex_flow && flexFlowMap[nodeLayout.flex_flow]?.includes('wrap') ? 'wrap' : 'nowrap') as any) : undefined,
            alignItems: isFlex ? ((nodeLayout.flex_align_cross && flexAlignCrossMap[nodeLayout.flex_align_cross]) || 'stretch') : undefined,
            justifyContent: isFlex ? ((nodeLayout.flex_align_main && flexAlignMainMap[nodeLayout.flex_align_main]) || 'flex-start') : undefined,
            gridTemplateColumns: isGrid ? (nodeLayout.grid_dsc_cols?.map(c => processDim(c)).join(' ') || '1fr') : undefined,
            gridTemplateRows: isGrid ? (nodeLayout.grid_dsc_rows?.map(r => processDim(r)).join(' ') || '1fr') : undefined,
            flexGrow: nodeLayout.flex_grow || 0,
            gap: `${nodeLayout.pad_row || 0}px ${nodeLayout.pad_column || 0}px`,
            cursor: isRoot ? 'default' : 'move',
            outline: isOver ? '2px dashed var(--text-accent)' : 'none',
            outlineOffset: '-1px',
            zIndex: isRoot ? 1 : (isSelected ? 100 : 10),
            opacity: isDragging ? 0.5 : 1,
            overflow: 'visible',
            fontFamily: typeof s.text_font === 'string' ? s.text_font : 'inherit',
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
        if (node.grid_cell_x_align) {
            styles.justifySelf = node.grid_cell_x_align;
        }
        if (node.grid_cell_y_align) {
            styles.alignSelf = node.grid_cell_y_align;
        }

        // Fix for stretching in grid/flex - if stretch is requested OR flex_grow is used, width/height must be auto
        if (styles.justifySelf === 'stretch' || styles.alignSelf === 'stretch' || (nodeLayout.flex_grow && nodeLayout.flex_grow > 0)) {
            if (!isRoot) {
                const isRowParent = parentLayout === 'flex' && (!parentFlexFlow || parentFlexFlow.startsWith('row'));
                const isColParent = parentLayout === 'flex' && (parentFlexFlow && parentFlexFlow.startsWith('column'));

                if (styles.justifySelf === 'stretch' || (isRowParent && nodeLayout.flex_grow)) {
                    styles.width = 'auto';
                }
                if (styles.alignSelf === 'stretch' || (isColParent && nodeLayout.flex_grow)) {
                    styles.height = 'auto';
                }
            }
        }

        // Align property support
        if (node.align === 'center' && !isFlex) {
            styles.left = '50%';
            styles.top = '50%';
            styles.transform = 'translate(-50%, -50%)';
        }

        return styles;
    };

    const renderContent = (s: StyleProperties) => {
        const text = resolveValue(node.text || '');

        // Find font asset to get its size and weight
        const fontAsset = assets.find(a => a.type === 'font' && a.value === s.text_font);
        const fontSize = fontAsset?.size ? `${fontAsset.size}px` : undefined;
        const fontWeight = (s.text_font?.toLowerCase().includes('bold') || (fontAsset?.name?.toLowerCase().includes('bold'))) ? 'bold' : 'normal';
        const fontFamily = fontAsset?.fontFamily || s.text_font;

        // Simple check for MDI icon pattern or common ESPHome icon escapes
        // If it starts with mdi: or is a single character (or surrogate pair) in the icon range
        // Private Use Area starts at 0xE000. High surrogate pairs are also likely icons.
        const isIcon = text.startsWith('mdi:') ||
            (text.length === 1 && text.charCodeAt(0) >= 0xE000) ||
            (text.length === 2 && text.charCodeAt(0) >= 0xD800 && text.charCodeAt(0) <= 0xDBFF);
        const iconName = text.startsWith('mdi:') ? text.slice(4) : null;

        switch (node.type) {
            case 'label':
            case 'button':
                if (isIcon) {
                    if (iconName) {
                        return <i className={`mdi mdi-${iconName}`} style={{ fontSize: fontSize || '1.2em' }}></i>;
                    } else {
                        // Raw glyph - FORCE MDI font family
                        return <span style={{ fontSize: fontSize || '1.2em', fontFamily: '"Material Design Icons", sans-serif' }}>{text}</span>;
                    }
                }
                return <span style={{ fontFamily, fontSize, fontWeight }}>{text}</span>;
            case 'arc':
                return <div style={{ border: '4px solid #fff', borderRadius: '50%', width: '100%', height: '100%' }} />;
            case 'bar':
            case 'slider':
                return <div style={{ background: '#555', width: '100%', height: '100%', borderRadius: '4px' }}><div style={{ background: '#007acc', width: '50%', height: '100%', borderRadius: '4px' }} /></div>;
            case 'switch':
                return <div style={{ background: '#555', width: '40px', height: '20px', borderRadius: '10px', position: 'relative' }}><div style={{ background: '#fff', width: '16px', height: '16px', borderRadius: '50%', position: 'absolute', top: '2px', left: '2px' }} /></div>;
            case 'page':
            case 'object':
            default:
                return null;
        }
    };

    // Helper to determine if a color is light or dark
    const isColorDark = (color: string) => {
        if (color === 'transparent') return true;
        if (color.startsWith('#')) {
            const hex = color.slice(1);
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            return brightness < 128;
        }
        return true; // Default to dark background
    };

    const gridColor = isColorDark(node.styles?.bg_color || '#000000')
        ? 'rgba(255, 255, 255, 0.25)' // Brighter on dark
        : 'rgba(0, 0, 0, 0.25)';      // Darker on light

    return (
        <div
            ref={setRef}
            className={`widget-node widget-type-${node.type} ${isSelected ? 'selected' : ''}`}
            style={getStyles()}
            onClick={handleClick}
            onMouseDown={handleDragStart}
            data-widget-id={node.id}
        >
            {isRoot && gridConfig.visible && (
                <div
                    className="grid-overlay"
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: 'calc(100% + 1px)',
                        height: 'calc(100% + 1px)',
                        pointerEvents: 'none',
                        zIndex: -1,
                        backgroundImage: `radial-gradient(circle at 0px 0px, ${gridColor} 1px, transparent 0)`,
                        backgroundSize: `${gridConfig.size}px ${gridConfig.size}px`,
                        backgroundPosition: '0 0'
                    }}
                />
            )}
            {renderContent(s)}
            {node.children && node.children.map(child => (
                <WidgetRenderer
                    key={child.id}
                    node={child}
                    parentId={node.id}
                    parentLayout={node.layout?.type || 'absolute'}
                    parentFlexFlow={node.layout?.flex_flow}
                />
            ))}
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
