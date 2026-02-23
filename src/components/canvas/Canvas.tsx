import React, { useEffect } from 'react';
import { WidgetNode, Asset } from '../../types';
import { useStore } from '../../store';
import { WidgetRenderer } from '../widgets/WidgetRenderer';
import { v4 as uuidv4 } from 'uuid';
import { useDrop } from 'react-dnd';

export const Canvas: React.FC = () => {
    const { widgets, setSelectedId, canvasConfig, gridConfig } = useStore();
    const [fitScale, setFitScale] = React.useState(1);

    const snapValue = (val: number) => {
        if (!gridConfig.enabled) return Math.round(val);
        return Math.round(val / gridConfig.size) * gridConfig.size;
    };

    // Calculate fit scale
    React.useEffect(() => {
        if (canvasConfig.viewMode !== 'fit') return;

        const observer = new ResizeObserver((entries) => {
            const area = entries[0].contentRect;
            const padding = 40; // Reduced from 120
            const horizontalScale = (area.width - padding) / canvasConfig.width;
            const verticalScale = (area.height - padding) / canvasConfig.height;
            setFitScale(Math.min(horizontalScale, verticalScale)); // Removed the cap of 1
        });

        const areaEl = document.querySelector('.canvas-area') as HTMLElement;
        if (areaEl) {
            areaEl.style.overflow = 'hidden'; // Prevent scrollbars in Fit mode
            observer.observe(areaEl);
        }
        return () => {
            if (areaEl) areaEl.style.overflow = 'auto';
            observer.disconnect();
        };
    }, [canvasConfig.viewMode, canvasConfig.width, canvasConfig.height]);

    const currentScale = canvasConfig.viewMode === 'fit' ? fitScale : canvasConfig.zoom;

    const handleCanvasClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            setSelectedId(null);
        }
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
                    text: item.type === 'label' || item.type === 'button' ? `${item.type}` : undefined,
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
                useStore.getState().setSelectedId(newWidget.id);
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
            onClick={handleCanvasClick}
            ref={drop}
            style={{
                width: canvasConfig.width,
                height: canvasConfig.height,
                transform: `scale(${currentScale})`,
                border: isOver ? '4px solid hsl(var(--primary))' : '1px solid var(--border-muted)',
                boxShadow: 'var(--shadow-lg)'
            }}
        >
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
