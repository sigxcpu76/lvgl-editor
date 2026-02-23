import React from 'react';
import { useStore } from '../../store';
import { WidgetType, StyleProperties, WidgetNode } from '../../types';

export const PropertiesPanel: React.FC = () => {
    const { widgets, selectedId, updateWidget } = useStore();

    const findSelectedWidget = (): WidgetNode | null => {
        let result: WidgetNode | null = null;
        const search = (nodes: WidgetNode[]) => {
            for (const node of nodes) {
                if (node.id === selectedId) {
                    result = node;
                    return;
                }
                if (node.children) {
                    search(node.children);
                }
            }
        };
        search(widgets);
        return result;
    };

    const selectedNode = findSelectedWidget();

    if (!selectedNode) {
        return (
            <div className="properties-panel empty">
                <div className="empty-state">Select a widget to edit properties</div>
            </div>
        );
    }

    const handlePropChange = (key: string, value: any) => {
        updateWidget(selectedNode.id, { [key]: value });
    };

    const handleStyleChange = (key: keyof StyleProperties, value: any) => {
        const currentStyles = selectedNode.styles || {};
        updateWidget(selectedNode.id, {
            styles: {
                ...currentStyles,
                [key]: value
            }
        });
    };

    return (
        <div className="properties-panel">
            <div className="property-group">
                <h3>General</h3>
                <div className="prop-row">
                    <label>ID</label>
                    <input
                        type="text"
                        value={selectedNode.name}
                        onChange={(e) => handlePropChange('name', e.target.value)}
                    />
                </div>
                <div className="prop-row">
                    <label>Type</label>
                    <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', fontWeight: 500 }}>
                        {selectedNode.type.toUpperCase()}
                    </div>
                </div>
            </div>

            <div className="property-group">
                <h3>Layout</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="prop-row" style={{ gridTemplateColumns: '40px 1fr' }}>
                        <label>X</label>
                        <input
                            type="text"
                            value={selectedNode.x ?? ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                handlePropChange('x', isNaN(Number(val)) || val === '' ? val : Number(val));
                            }}
                        />
                    </div>
                    <div className="prop-row" style={{ gridTemplateColumns: '40px 1fr' }}>
                        <label>Y</label>
                        <input
                            type="text"
                            value={selectedNode.y ?? ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                handlePropChange('y', isNaN(Number(val)) || val === '' ? val : Number(val));
                            }}
                        />
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="prop-row" style={{ gridTemplateColumns: '40px 1fr' }}>
                        <label>W</label>
                        <input
                            type="text"
                            value={selectedNode.width ?? ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                handlePropChange('width', isNaN(Number(val)) || val === '' ? val : Number(val));
                            }}
                        />
                    </div>
                    <div className="prop-row" style={{ gridTemplateColumns: '40px 1fr' }}>
                        <label>H</label>
                        <input
                            type="text"
                            value={selectedNode.height ?? ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                handlePropChange('height', isNaN(Number(val)) || val === '' ? val : Number(val));
                            }}
                        />
                    </div>
                </div>
            </div>

            {(selectedNode.type === 'label' || selectedNode.type === 'button') && (
                <div className="property-group">
                    <h3>Content</h3>
                    <div className="prop-row">
                        <label>Text</label>
                        <input
                            type="text"
                            value={selectedNode.text || ''}
                            onChange={(e) => handlePropChange('text', e.target.value)}
                            placeholder="mdi:home or text"
                        />
                    </div>
                </div>
            )}

            <div className="property-group">
                <h3>Style</h3>
                <div className="prop-row">
                    <label>Font</label>
                    <select
                        value={selectedNode.styles?.text_font || ''}
                        onChange={(e) => handleStyleChange('text_font', e.target.value)}
                    >
                        <option value="">Default</option>
                        {useStore.getState().assets
                            .filter(a => a.type === 'font')
                            .map(font => (
                                <option key={font.id} value={font.value}>{font.name}</option>
                            ))
                        }
                    </select>
                </div>
                <div className="prop-row">
                    <label>Background</label>
                    <div className="color-input-group">
                        <input
                            type="color"
                            value={selectedNode.styles?.bg_color || '#000000'}
                            onChange={(e) => handleStyleChange('bg_color', e.target.value)}
                        />
                        <input
                            type="text"
                            value={selectedNode.styles?.bg_color || ''}
                            onChange={(e) => handleStyleChange('bg_color', e.target.value)}
                            placeholder="hex"
                            className="text-input-compact"
                        />
                    </div>
                </div>
                <div className="prop-row">
                    <label>Text Color</label>
                    <div className="color-input-group">
                        <input
                            type="color"
                            value={selectedNode.styles?.text_color || '#ffffff'}
                            onChange={(e) => handleStyleChange('text_color', e.target.value)}
                        />
                        <input
                            type="text"
                            value={selectedNode.styles?.text_color || ''}
                            onChange={(e) => handleStyleChange('text_color', e.target.value)}
                            placeholder="hex"
                            className="text-input-compact"
                        />
                    </div>
                </div>
                <div className="prop-row">
                    <label>Radius</label>
                    <input
                        type="number"
                        value={selectedNode.styles?.radius || 0}
                        onChange={(e) => handleStyleChange('radius', Number(e.target.value))}
                    />
                </div>
            </div>

            <style>{`
                .color-input-group {
                    display: grid;
                    grid-template-columns: 32px 1fr;
                    gap: 8px;
                }
                .color-input-group input[type="color"] {
                    padding: 0;
                    height: 28px;
                    border: 1px solid var(--border-subtle);
                    cursor: pointer;
                    overflow: hidden;
                }
                .text-input-compact {
                    font-family: monospace;
                    font-size: 0.75rem !important;
                }
            `}</style>
        </div>
    );
};
