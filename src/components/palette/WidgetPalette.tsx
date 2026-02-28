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
            className={`widget-item-icon ${isDragging ? 'dragging' : ''}`}
            title={label}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-muted)',
                cursor: 'grab'
            }}
        >
            <span className={`mdi mdi-${icon}`} style={{ fontSize: '1.5rem', color: 'hsl(var(--primary))' }} />
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
        { type: 'checkbox', label: 'Checkbox', icon: 'checkbox-marked-outline' },
        { type: 'spinbox', label: 'Spinbox', icon: 'plus-minus-box' },
        { type: 'dropdown', label: 'Dropdown', icon: 'form-dropdown' },
        { type: 'roller', label: 'Roller', icon: 'format-list-bulleted-square' },
        { type: 'textarea', label: 'Textarea', icon: 'form-textarea' },
        { type: 'led', label: 'LED', icon: 'led-on' },
        { type: 'image', label: 'Image', icon: 'image-outline' },
    ];

    return (
        <div className="widget-palette" style={{ display: 'flex', gap: '8px', padding: '8px 16px', overflowX: 'auto', alignItems: 'center' }}>
            {widgetTypes.map(({ type, label, icon }) => (
                <DraggableWidget key={type} type={type} label={label} icon={icon} />
            ))}
        </div>
    );
}
