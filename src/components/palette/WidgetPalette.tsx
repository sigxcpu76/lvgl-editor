import React from 'react';
import { useDrag } from 'react-dnd';

const DraggableWidget: React.FC<{ type: string, label: string, icon: string }> = ({ type, label, icon }) => {
    const [{ isDragging }, dragRef] = useDrag(() => ({
        type: 'widget',
        item: { type },
        collect: (monitor) => ({
            isDragging: !!monitor.isDragging()
        })
    }));

    const drag = dragRef as unknown as React.LegacyRef<HTMLDivElement>;

    return (
        <div
            ref={drag}
            className={`widget-item ${isDragging ? 'dragging' : ''}`}
        >
            <span className={`mdi mdi-${icon}`} style={{ fontSize: '1.2rem', color: 'hsl(var(--primary))' }} />
            {label}
        </div>
    );
};

export const WidgetPalette: React.FC = () => {
    const widgetTypes = [
        { type: 'object', label: 'Container', icon: 'square-outline' },
        { type: 'button', label: 'Button', icon: 'gesture-tap-button' },
        { type: 'label', label: 'Label', icon: 'format-text' },
        { type: 'arc', label: 'Arc', icon: 'circle-outline' },
        { type: 'bar', label: 'Bar', icon: 'chart-gantt' },
        { type: 'slider', label: 'Slider', icon: 'tune' },
        { type: 'switch', label: 'Switch', icon: 'toggle-switch' },
    ];

    return (
        <div className="widget-palette" style={{ padding: '12px 0' }}>
            {widgetTypes.map(({ type, label, icon }) => (
                <DraggableWidget key={type} type={type} label={label} icon={icon} />
            ))}
        </div>
    );
}
