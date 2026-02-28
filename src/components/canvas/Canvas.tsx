import React, { useEffect } from 'react';
import { WidgetNode, Asset } from '../../types';
import { useStore } from '../../store';
import { WidgetRenderer } from '../widgets/WidgetRenderer';
import { v4 as uuidv4 } from 'uuid';
import { useDrop } from 'react-dnd';

export const Canvas: React.FC = () => {
    const { widgets, setSelectedIds, selectedIds, canvasConfig, gridConfig, substitutions } = useStore();
    const [fitScale, setFitScale] = React.useState(1);
    const [selectionBox, setSelectionBox] = React.useState<{
        x1: number;
        y1: number;
        x2: number;
        y2: number;
    } | null>(null);

    const snapValue = (val: number) => {
        if (!gridConfig.enabled) return Math.round(val);
        return Math.round(val / gridConfig.size) * gridConfig.size;
    };

    // Calculate fit scale
    React.useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            const area = entries[0].contentRect;
            const padding = 40;
            const horizontalScale = (area.width - padding) / canvasConfig.width;
            const verticalScale = (area.height - padding) / canvasConfig.height;
            setFitScale(Math.min(horizontalScale, verticalScale));
        });

        const areaEl = (document.querySelector('.canvas-area') as HTMLElement);
        if (areaEl) {
            areaEl.style.overflow = 'hidden';
            observer.observe(areaEl);
        }
        return () => {
            if (areaEl) areaEl.style.overflow = 'auto';
            observer.disconnect();
        };
    }, [canvasConfig.viewMode, canvasConfig.width, canvasConfig.height]);

    const currentScale = (canvasConfig.viewMode === 'fit') ? fitScale : canvasConfig.zoom;

    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        // If the event reached here, it didn't hit a draggable widget (which stop propagation).
        // It could be the root page or the canvas container itself.
        const canvasEl = e.currentTarget as HTMLElement;
        const rect = canvasEl.getBoundingClientRect();
        const startX = (e.clientX - rect.left) / currentScale;
        const startY = (e.clientY - rect.top) / currentScale;

        setSelectionBox({ x1: startX, y1: startY, x2: startX, y2: startY });

        const onMouseMove = (moveEvent: MouseEvent) => {
            const currentX = (moveEvent.clientX - rect.left) / currentScale;
            const currentY = (moveEvent.clientY - rect.top) / currentScale;
            setSelectionBox(prev => prev ? { ...prev, x2: currentX, y2: currentY } : null);
        };

        const onMouseUp = (upEvent: MouseEvent) => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);

            setSelectionBox(prev => {
                if (!prev) return null;

                const rect = canvasEl.getBoundingClientRect();
                const xMin = Math.min(prev.x1, prev.x2) * currentScale + rect.left;
                const xMax = Math.max(prev.x1, prev.x2) * currentScale + rect.left;
                const yMin = Math.min(prev.y1, prev.y2) * currentScale + rect.top;
                const yMax = Math.max(prev.y1, prev.y2) * currentScale + rect.top;

                const newSelectedIds: string[] = [];
                const widgetNodes = canvasEl.querySelectorAll('.widget-node:not(.widget-type-page)');

                widgetNodes.forEach(el => {
                    const elRect = el.getBoundingClientRect();
                    const intersects = !(elRect.left > xMax || elRect.right < xMin || elRect.top > yMax || elRect.bottom < yMin);
                    const id = el.getAttribute('data-widget-id');
                    if (intersects && id) {
                        newSelectedIds.push(id);
                    }
                });

                if (upEvent.shiftKey || upEvent.ctrlKey || upEvent.metaKey) {
                    setSelectedIds([...new Set([...selectedIds, ...newSelectedIds])]);
                } else if (Math.abs(prev.x1 - prev.x2) < 5 && Math.abs(prev.y1 - prev.y2) < 5) {
                    if (widgets.length > 0 && widgets[0].type === 'page') {
                        setSelectedIds([widgets[0].id]);
                    } else {
                        setSelectedIds([]);
                    }
                } else {
                    setSelectedIds(newSelectedIds);
                }

                return null;
            });
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const [{ isOver }, dropRef] = useDrop(() => ({
        accept: ['widget', 'asset'],
        drop: (item: any, monitor) => {
            if (monitor.didDrop()) return;

            const clientOffset = monitor.getClientOffset();
            if (!clientOffset) return;

            const canvasEl = document.querySelector('.lvgl-screen');
            if (!canvasEl) return;
            const rect = canvasEl.getBoundingClientRect();

            const x = snapValue((clientOffset.x - rect.left) / currentScale);
            const y = snapValue((clientOffset.y - rect.top) / currentScale);

            if (item.id) {
                // Final position update for legacy support/final sync
                useStore.getState().updateWidget(item.id, { x, y });
            } else if (item.type || item.asset) {
                // Create new widget
                const newWidget = item.type ? {
                    id: uuidv4(),
                    type: item.type as any,
                    name: `${item.type}_${Date.now().toString().slice(-4)}`,
                    x, y,
                    width: item.type === 'slider' || item.type === 'bar' ? 150 : 100,
                    height: item.type === 'slider' || item.type === 'bar' ? 20 : 40,
                    text: item.type === 'label' || item.type === 'button' || item.type === 'checkbox' ? `${item.type}` : undefined,
                    options: item.type === 'dropdown' || item.type === 'roller' ? "Option 1\nOption 2\nOption 3" : undefined,
                    // Defaults for specific types
                    range_min: (item.type === 'slider' || item.type === 'bar' || item.type === 'arc' || item.type === 'spinbox') ? 0 : undefined,
                    range_max: (item.type === 'slider' || item.type === 'bar' || item.type === 'arc' || item.type === 'spinbox') ? 100 : undefined,
                    value: (item.type === 'slider' || item.type === 'bar' || item.type === 'arc' || item.type === 'spinbox') ? 50 : undefined,
                    start_angle: item.type === 'arc' ? 135 : undefined,
                    end_angle: item.type === 'arc' ? 45 : undefined,
                    checkable: (item.type === 'switch' || item.type === 'checkbox') ? true : undefined,
                    children: []
                } : {
                    id: uuidv4(),
                    type: 'label' as any,
                    name: `label_${Date.now().toString().slice(-4)}`,
                    x, y,
                    width: 100, height: 40,
                    text: item.asset.type === 'icon' ? `mdi:${item.asset.value}` : 'New Label',
                    styles: item.asset.type === 'font' ? { text_font: item.asset.value } : {},
                    children: []
                };

                useStore.getState().addWidget(null, newWidget);
                useStore.getState().setSelectedIds([newWidget.id]);
            }
        },
        collect: (monitor) => ({
            isOver: !!monitor.isOver({ shallow: true }),
        }),
    }), [canvasConfig, currentScale, gridConfig]);

    const drop = dropRef as unknown as React.LegacyRef<HTMLDivElement>;

    return (
        <div
            className="lvgl-screen"
            onMouseDown={handleCanvasMouseDown}
            ref={drop}
            style={{
                width: canvasConfig.width,
                height: canvasConfig.height,
                transform: `scale(${currentScale})`,
                border: (isOver ? '4px solid hsl(var(--primary))' : '1px solid var(--border-muted)'),
                boxShadow: 'var(--shadow-lg)',
                position: 'relative',
                overflow: 'visible'
            }}
        >
            {selectionBox && (
                <div style={{
                    position: 'absolute',
                    left: Math.min(selectionBox.x1, selectionBox.x2),
                    top: Math.min(selectionBox.y1, selectionBox.y2),
                    width: Math.abs(selectionBox.x1 - selectionBox.x2),
                    height: Math.abs(selectionBox.y1 - selectionBox.y2),
                    border: '1px solid hsl(var(--primary))',
                    backgroundColor: 'hsl(var(--primary) / 0.2)',
                    pointerEvents: 'none',
                    zIndex: 1000
                }} />
            )}
            {widgets.length === 0 ? (
                <div className="empty-state">Drag widgets here</div>
            ) : (
                widgets.map((node: WidgetNode) => (
                    <WidgetRenderer key={node.id} node={node} isRoot={true} />
                ))
            )}
        </div>
    );
};
