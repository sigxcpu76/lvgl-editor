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
            className={`widget-item-modern ${isDragging ? 'dragging' : ''}`}
            title={label}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '44px',
                height: '44px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'hsl(var(--bg-surface-elevated))',
                border: '1px solid var(--border-subtle)',
                cursor: 'grab',
                transition: 'var(--transition-fast)',
                boxShadow: 'var(--shadow-sm)',
                opacity: isDragging ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'hsl(var(--primary))';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
        >
            <span className={`mdi mdi-${icon}`} style={{ fontSize: '1.4rem', color: 'hsl(var(--primary))' }} />
        </div>
    );
};

export const WidgetPalette: React.FC = () => {
    const categories = [
        {
            name: 'Basic',
            widgets: [
                { type: 'object', label: 'Container', icon: 'square-outline' },
                { type: 'tabview', label: 'Tab View', icon: 'tab' },
                { type: 'label', label: 'Label', icon: 'format-text' },
                { type: 'image', label: 'Image', icon: 'image-outline' },
            ]
        },
        {
            name: 'Input',
            widgets: [
                { type: 'button', label: 'Button', icon: 'gesture-tap-button' },
                { type: 'switch', label: 'Switch', icon: 'toggle-switch' },
                { type: 'checkbox', label: 'Checkbox', icon: 'checkbox-marked-outline' },
                { type: 'slider', label: 'Slider', icon: 'tune' },
                { type: 'spinbox', label: 'Spinbox', icon: 'plus-minus-box' },
            ]
        },
        {
            name: 'Selection',
            widgets: [
                { type: 'dropdown', label: 'Dropdown', icon: 'form-dropdown' },
                { type: 'roller', label: 'Roller', icon: 'format-list-bulleted-square' },
                { type: 'textarea', label: 'Textarea', icon: 'form-textarea' },
            ]
        },
        {
            name: 'Display',
            widgets: [
                { type: 'bar', label: 'Bar', icon: 'chart-gantt' },
                { type: 'arc', label: 'Arc', icon: 'circle-outline' },
                { type: 'led', label: 'LED', icon: 'led-on' },
                { type: 'meter', label: 'Meter', icon: 'gauge' },
                { type: 'scale', label: 'Scale (LVGL 9)', icon: 'speedometer' },
            ]
        }
    ];

    return (
        <div className="widget-palette-container" style={{ display: 'flex', gap: '20px', padding: '12px 20px', overflowX: 'auto', alignItems: 'center' }}>
            {categories.map((cat) => (
                <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'hsl(var(--text-dim))',
                        writingMode: 'vertical-lr',
                        transform: 'rotate(180deg)',
                        marginRight: '4px',
                        userSelect: 'none'
                    }}>
                        {cat.name}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {cat.widgets.map(({ type, label, icon }) => (
                            <DraggableWidget key={type} type={type} label={label} icon={icon} />
                        ))}
                    </div>
                    {cat.name !== categories[categories.length - 1].name && (
                        <div style={{ width: '1px', height: '32px', background: 'var(--border-subtle)', marginLeft: '12px' }} />
                    )}
                </div>
            ))}
        </div>
    );
}
