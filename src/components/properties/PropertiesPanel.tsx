import React from 'react';
import { useStore } from '../../store';
import { WidgetType, StyleProperties, WidgetNode } from '../../types';

const ACTION_TEMPLATES: Record<string, any> = {
    'homeassistant.service': {
        service: 'homeassistant.toggle',
        data: { entity_id: '' }
    },
    'lvgl.label.update': {
        id: '',
        text: ''
    },
    'lvgl.widget.update': {
        id: '',
        state: { checked: true }
    },
    'lvgl.page.show': 'main_page',
    'light.turn_on': {
        id: '',
        brightness: '100%'
    },
    'logger.log': 'Action executed',
    'lambda': 'return;'
};

const ActionStepEditor: React.FC<{
    step: any;
    onChange: (newStep: any) => void;
}> = ({ step, onChange }) => {
    const [isRaw, setIsRaw] = React.useState(false);

    // Detect type
    let actionType = 'custom';
    let actionValue: any = step;

    if (typeof step === 'object' && step !== null) {
        const keys = Object.keys(step);
        if (keys.length === 1 && ACTION_TEMPLATES[keys[0]] !== undefined) {
            actionType = keys[0];
            actionValue = step[keys[0]];
        }
    }

    const handleTypeChange = (newType: string) => {
        if (newType === 'custom') {
            onChange({});
        } else {
            onChange({ [newType]: ACTION_TEMPLATES[newType] });
        }
    };

    const handleFieldChange = (key: string, val: any) => {
        if (actionType === 'custom') {
            onChange(val);
            return;
        }

        if (typeof actionValue === 'object' && actionValue !== null) {
            onChange({ [actionType]: { ...actionValue, [key]: val } });
        } else {
            onChange({ [actionType]: val });
        }
    };

    if (isRaw) {
        return (
            <div className="action-step-editor-raw">
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
                    <button onClick={() => setIsRaw(false)} style={{ fontSize: '0.65rem', padding: '2px 4px', background: 'hsl(var(--bg-base))', border: '1px solid var(--border-subtle)', color: 'hsl(var(--text-muted))', borderRadius: '4px', cursor: 'pointer' }}>Form Mode</button>
                </div>
                <textarea
                    value={typeof step === 'string' ? step : JSON.stringify(step, null, 2)}
                    onChange={(e) => {
                        try {
                            const val = e.target.value;
                            if (val.trim().startsWith('{') || val.trim().startsWith('[')) {
                                onChange(JSON.parse(val));
                            } else {
                                onChange(val);
                            }
                        } catch (err) {
                            onChange(e.target.value);
                        }
                    }}
                    style={{ width: '100%', minHeight: '80px', background: 'hsl(var(--bg-base))', border: '1px solid var(--border-subtle)', color: 'hsl(var(--text-main))', fontSize: '0.75rem', fontFamily: 'monospace', padding: '8px', borderRadius: '4px' }}
                />
            </div>
        );
    }

    return (
        <div className="action-step-editor-form" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                    value={actionType}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    style={{
                        flex: 1,
                        fontSize: '0.75rem',
                        padding: '4px',
                        background: 'hsl(var(--bg-surface-elevated))',
                        color: 'hsl(var(--text-main))',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '4px'
                    }}
                >
                    <option value="custom">Custom/Raw</option>
                    {Object.keys(ACTION_TEMPLATES).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button onClick={() => setIsRaw(true)} style={{ fontSize: '0.65rem', padding: '4px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'hsl(var(--text-muted))', borderRadius: '4px', cursor: 'pointer' }}>JSON</button>
            </div>

            {actionType !== 'custom' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '8px', borderLeft: '2px solid var(--primary)' }}>
                    {typeof actionValue === 'object' && actionValue !== null ? (
                        Object.entries(actionValue).map(([k, v]) => (
                            <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <label style={{ fontSize: '0.65rem', color: 'hsl(var(--text-muted))', fontWeight: 'bold' }}>{k}</label>
                                {typeof v === 'object' ? (
                                    <textarea
                                        value={JSON.stringify(v)}
                                        onChange={(e) => {
                                            try { handleFieldChange(k, JSON.parse(e.target.value)); } catch (err) { handleFieldChange(k, e.target.value); }
                                        }}
                                        style={{ width: '100%', fontSize: '0.7rem', padding: '4px', background: 'hsl(var(--bg-base))', border: '1px solid var(--border-subtle)', color: 'hsl(var(--text-main))', borderRadius: '4px' }}
                                    />
                                ) : (
                                    <input
                                        type="text"
                                        value={String(v)}
                                        onChange={(e) => handleFieldChange(k, e.target.value)}
                                        style={{ width: '100%', fontSize: '0.75rem', padding: '4px', background: 'hsl(var(--bg-base))', border: '1px solid var(--border-subtle)', color: 'hsl(var(--text-main))', borderRadius: '4px' }}
                                    />
                                )}
                            </div>
                        ))
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <label style={{ fontSize: '0.65rem', color: 'hsl(var(--text-muted))', fontWeight: 'bold' }}>Value</label>
                            {actionType === 'lambda' ? (
                                <textarea
                                    value={String(actionValue)}
                                    onChange={(e) => onChange({ [actionType]: e.target.value })}
                                    style={{ width: '100%', fontSize: '0.75rem', padding: '4px', minHeight: '60px', background: 'hsl(var(--bg-base))', border: '1px solid var(--border-subtle)', color: 'hsl(var(--text-main))', borderRadius: '4px', fontFamily: 'monospace' }}
                                />
                            ) : (
                                <input
                                    type="text"
                                    value={String(actionValue)}
                                    onChange={(e) => onChange({ [actionType]: e.target.value })}
                                    style={{ width: '100%', fontSize: '0.75rem', padding: '4px', background: 'hsl(var(--bg-base))', border: '1px solid var(--border-subtle)', color: 'hsl(var(--text-main))', borderRadius: '4px' }}
                                />
                            )}
                        </div>
                    )}
                </div>
            )}
            {actionType === 'custom' && <div style={{ fontSize: '0.7rem', color: 'hsl(var(--text-dim))' }}>Use JSON mode for complex or unknown actions.</div>}
        </div>
    );
};

export const PropertiesPanel: React.FC = () => {
    const { widgets, selectedIds, updateWidget, global_styles, assets } = useStore();
    const [activeState, setActiveState] = React.useState<string>('DEFAULT');
    const [newActionInput, setNewActionInput] = React.useState('');
    const [showIconPopover, setShowIconPopover] = React.useState(false);

    // Close popover when clicking outside
    React.useEffect(() => {
        if (!showIconPopover) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('.icon-helper')) {
                setShowIconPopover(false);
            }
        };
        window.addEventListener('mousedown', handleClickOutside);
        return () => window.removeEventListener('mousedown', handleClickOutside);
    }, [showIconPopover]);

    const findSelectedWidget = (): WidgetNode | null => {
        let result: WidgetNode | null = null;
        const search = (nodes: WidgetNode[]) => {
            for (const node of nodes) {
                if (node.id === selectedIds[0]) {
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
        if (activeState === 'DEFAULT') {
            const currentStyles = selectedNode.styles || {};
            updateWidget(selectedNode.id, {
                styles: {
                    ...currentStyles,
                    [key]: value
                }
            });
        } else {
            // Find or create a style reference for this state
            const style_references = [...(selectedNode.style_references || [])];
            let refIndex = style_references.findIndex(r => r.state === activeState);

            if (refIndex === -1) {
                // Create a new reference for this state
                style_references.push({
                    state: activeState as any,
                    styles: { [key]: value }
                });
            } else {
                // Update existing reference
                style_references[refIndex] = {
                    ...style_references[refIndex],
                    styles: {
                        ...(style_references[refIndex].styles || {}),
                        [key]: value
                    }
                };
            }

            updateWidget(selectedNode.id, { style_references });
        }
    };

    const getStyleValue = (key: keyof StyleProperties) => {
        if (activeState === 'DEFAULT') {
            const val = selectedNode.styles?.[key];
            if (val !== undefined) return val;

            // If local style is missing, try to resolve from global styles (inheritance preview)
            if (selectedNode.style_references) {
                for (const ref of selectedNode.style_references) {
                    if ((!ref.state || ref.state === 'DEFAULT') && ref.style_id) {
                        const globalStyle = global_styles[ref.style_id];
                        if (globalStyle && globalStyle[key] !== undefined) {
                            return globalStyle[key];
                        }
                    }
                }
            }
            return undefined;
        }
        const ref = selectedNode.style_references?.find(r => r.state === activeState);
        return ref?.styles?.[key];
    };

    const handleNumberProp = (key: string, val: string) => {
        handlePropChange(key, val === '' ? undefined : Number(val));
    };

    const handleNumberStyle = (key: keyof StyleProperties, val: string) => {
        handleStyleChange(key, val === '' ? undefined : Number(val));
    };

    const isMultiple = selectedIds.length > 1;

    return (
        <div className="properties-panel">
            {isMultiple && (
                <div style={{ padding: '10px 20px', background: 'rgba(255,165,0,0.1)', color: 'orange', fontSize: '0.8rem', borderBottom: '1px solid var(--border-subtle)' }}>
                    Editing primary selection ({selectedIds.length} items selected)
                </div>
            )}
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
                <h3>State</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div className="prop-row-checkbox">
                        <input
                            type="checkbox"
                            checked={selectedNode.hidden || false}
                            onChange={(e) => handlePropChange('hidden', e.target.checked)}
                            id="prop-hidden"
                        />
                        <label htmlFor="prop-hidden">Hidden</label>
                    </div>
                    <div className="prop-row-checkbox">
                        <input
                            type="checkbox"
                            checked={selectedNode.clickable ?? true}
                            onChange={(e) => handlePropChange('clickable', e.target.checked)}
                            id="prop-clickable"
                        />
                        <label htmlFor="prop-clickable">Clickable</label>
                    </div>
                    <div className="prop-row-checkbox">
                        <input
                            type="checkbox"
                            checked={selectedNode.checkable || false}
                            onChange={(e) => handlePropChange('checkable', e.target.checked)}
                            id="prop-checkable"
                        />
                        <label htmlFor="prop-checkable">Checkable</label>
                    </div>
                    <div className="prop-row-checkbox">
                        <input
                            type="checkbox"
                            checked={selectedNode.checked || false}
                            onChange={(e) => handlePropChange('checked', e.target.checked)}
                            id="prop-checked"
                        />
                        <label htmlFor="prop-checked">Checked</label>
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
                <div className="prop-row">
                    <label>Align</label>
                    <select
                        value={selectedNode.align || ''}
                        onChange={(e) => handlePropChange('align', e.target.value)}
                    >
                        <option value="">None</option>
                        <option value="CENTER">Center</option>
                        <option value="TOP_LEFT">Top Left</option>
                        <option value="TOP_MID">Top Mid</option>
                        <option value="TOP_RIGHT">Top Right</option>
                        <option value="BOTTOM_LEFT">Bottom Left</option>
                        <option value="BOTTOM_MID">Bottom Mid</option>
                        <option value="BOTTOM_RIGHT">Bottom Right</option>
                        <option value="LEFT_MID">Left Mid</option>
                        <option value="RIGHT_MID">Right Mid</option>
                    </select>
                </div>

                <div className="prop-row">
                    <label>Layout</label>
                    <select
                        value={selectedNode.layout?.type || 'absolute'}
                        onChange={(e) => {
                            const type = e.target.value as any;
                            handlePropChange('layout', { ...(selectedNode.layout || {}), type });
                        }}
                    >
                        <option value="absolute">Absolute</option>
                        <option value="flex">Flex</option>
                        <option value="grid">Grid</option>
                    </select>
                </div>

                {selectedNode.layout?.type === 'flex' && (
                    <div className="nested-group">
                        <div className="prop-row">
                            <label>Flow</label>
                            <select
                                value={selectedNode.layout.flex_flow || 'row'}
                                onChange={(e) => handlePropChange('layout', { ...selectedNode.layout, flex_flow: e.target.value })}
                            >
                                <option value="row">Row</option>
                                <option value="column">Column</option>
                                <option value="row_wrap">Row Wrap</option>
                                <option value="column_wrap">Column Wrap</option>
                            </select>
                        </div>
                        <div className="prop-row">
                            <label>Main Al.</label>
                            <select
                                value={selectedNode.layout.flex_align_main || 'start'}
                                onChange={(e) => handlePropChange('layout', { ...selectedNode.layout, flex_align_main: e.target.value })}
                            >
                                <option value="start">Start</option>
                                <option value="center">Center</option>
                                <option value="end">End</option>
                                <option value="space_between">Between</option>
                                <option value="space_around">Around</option>
                                <option value="space_evenly">Evenly</option>
                            </select>
                        </div>
                        <div className="prop-row">
                            <label>Cross Al.</label>
                            <select
                                value={selectedNode.layout.flex_align_cross || 'start'}
                                onChange={(e) => handlePropChange('layout', { ...selectedNode.layout, flex_align_cross: e.target.value })}
                            >
                                <option value="start">Start</option>
                                <option value="center">Center</option>
                                <option value="end">End</option>
                                <option value="stretch">Stretch</option>
                            </select>
                        </div>
                        <div className="prop-row" style={{ gridTemplateColumns: '50px 1fr' }}>
                            <label>Grow</label>
                            <input
                                type="number"
                                value={selectedNode.layout.flex_grow ?? ''}
                                onChange={(e) => handlePropChange('layout', { ...selectedNode.layout, flex_grow: e.target.value === '' ? undefined : Number(e.target.value) })}
                            />
                        </div>
                    </div>
                )}

                {selectedNode.layout?.type === 'grid' && (
                    <div className="nested-group">
                        <div className="prop-row">
                            <label>Cols</label>
                            <input
                                type="text"
                                placeholder="lv.fr(1), 100, ..."
                                value={selectedNode.layout.grid_dsc_cols?.join(', ') || ''}
                                onChange={(e) => {
                                    const val = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                    handlePropChange('layout', { ...selectedNode.layout, grid_dsc_cols: val });
                                }}
                            />
                        </div>
                        <div className="prop-row">
                            <label>Rows</label>
                            <input
                                type="text"
                                placeholder="lv.fr(1), ..."
                                value={selectedNode.layout.grid_dsc_rows?.join(', ') || ''}
                                onChange={(e) => {
                                    const val = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                    handlePropChange('layout', { ...selectedNode.layout, grid_dsc_rows: val });
                                }}
                            />
                        </div>
                    </div>
                )}

                <div className="nested-group" style={{ borderTop: '0.5px solid var(--border-subtle)', paddingTop: '8px', marginTop: '4px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', marginBottom: '4px' }}>Cell Position (Grid Only)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div className="prop-row" style={{ gridTemplateColumns: '35px 1fr', gap: '4px' }}>
                            <label>Col</label>
                            <input
                                type="number"
                                value={selectedNode.grid_cell_column_pos ?? ''}
                                onChange={(e) => handleNumberProp('grid_cell_column_pos', e.target.value)}
                            />
                        </div>
                        <div className="prop-row" style={{ gridTemplateColumns: '35px 1fr', gap: '4px' }}>
                            <label>Row</label>
                            <input
                                type="number"
                                value={selectedNode.grid_cell_row_pos ?? ''}
                                onChange={(e) => handleNumberProp('grid_cell_row_pos', e.target.value)}
                            />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div className="prop-row" style={{ gridTemplateColumns: '55px 1fr', gap: '4px' }}>
                            <label>C-Span</label>
                            <input
                                type="number"
                                value={selectedNode.grid_cell_column_span ?? ''}
                                onChange={(e) => handleNumberProp('grid_cell_column_span', e.target.value)}
                            />
                        </div>
                        <div className="prop-row" style={{ gridTemplateColumns: '55px 1fr', gap: '4px' }}>
                            <label>R-Span</label>
                            <input
                                type="number"
                                value={selectedNode.grid_cell_row_span ?? ''}
                                onChange={(e) => handleNumberProp('grid_cell_row_span', e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>
            {(selectedNode.type === 'label' || selectedNode.type === 'button' || selectedNode.type === 'checkbox' || selectedNode.type === 'textarea') && (
                <div className="property-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h3 style={{ margin: 0 }}>Content</h3>
                        {assets.some(a => a.type === 'icon') && (
                            <div className="icon-helper" style={{ position: 'relative' }}>
                                <button
                                    className="btn-icon-small"
                                    onClick={() => setShowIconPopover(!showIconPopover)}
                                    title="Insert Icon Asset"
                                    style={{
                                        padding: '2px 6px',
                                        fontSize: '0.9rem',
                                        background: showIconPopover ? 'var(--primary)' : 'hsl(var(--bg-surface-elevated))',
                                        border: '1px solid var(--border-subtle)',
                                        borderRadius: '4px',
                                        color: showIconPopover ? 'white' : 'hsl(var(--primary))',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <span className="mdi mdi-emoticon-outline" />
                                </button>
                                {showIconPopover && (
                                    <div style={{
                                        position: 'absolute',
                                        top: 'calc(100% + 4px)',
                                        right: 0,
                                        zIndex: 1000,
                                        background: 'hsl(var(--bg-surface-elevated))',
                                        border: '1px solid var(--border-subtle)',
                                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
                                        padding: '8px',
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(4, 1fr)',
                                        gap: '4px',
                                        borderRadius: '8px',
                                        width: '180px',
                                        maxHeight: '240px',
                                        overflowY: 'auto',
                                        animation: 'popIn 0.2s ease-out'
                                    }}>
                                        {assets.filter(a => a.type === 'icon').length === 0 ? (
                                            <div style={{ gridColumn: 'span 4', padding: '20px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: '0.8rem' }}>
                                                No icons found
                                            </div>
                                        ) : (
                                            assets.filter(a => a.type === 'icon').map(asset => {
                                                const isGlyph = (asset.value.length === 1 || asset.value.length === 2) && !asset.value.startsWith('mdi:');
                                                return (
                                                    <button
                                                        key={asset.id}
                                                        onClick={() => {
                                                            handlePropChange('text', isGlyph ? asset.value : `mdi:${asset.value.replace('mdi:', '')}`);
                                                            setShowIconPopover(false);
                                                        }}
                                                        style={{
                                                            padding: '8px',
                                                            background: 'transparent',
                                                            border: '1px solid transparent',
                                                            borderRadius: '4px',
                                                            color: 'hsl(var(--text-main))',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: isGlyph ? '1.1rem' : '1.4rem',
                                                            transition: 'all 0.15s',
                                                            minWidth: '36px',
                                                            minHeight: '36px'
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--bg-surface-soft))'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                        title={`${asset.name} (${asset.value})`}
                                                    >
                                                        {isGlyph ? (
                                                            <span style={{
                                                                fontFamily: [
                                                                    '"Material Design Icons"',
                                                                    ...assets.filter(a => a.type === 'font' && a.family).map(a => `"${a.family}"`),
                                                                    'sans-serif'
                                                                ].join(', '),
                                                                lineHeight: 1
                                                            }}>
                                                                {asset.value}
                                                            </span>
                                                        ) : (
                                                            <span className={`mdi mdi-${asset.value.replace('mdi:', '')}`} />
                                                        )}
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="prop-row">
                        <label>Text</label>
                        {selectedNode.type === 'textarea' ? (
                            <textarea
                                value={selectedNode.text || ''}
                                onChange={(e) => handlePropChange('text', e.target.value)}
                                placeholder="Text content..."
                                rows={3}
                                style={{
                                    width: '100%',
                                    background: 'hsl(var(--bg-surface))',
                                    color: 'hsl(var(--text-main))',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    fontFamily: 'inherit',
                                    fontSize: '0.8rem',
                                    resize: 'vertical'
                                }}
                            />
                        ) : (
                            <input
                                type="text"
                                value={selectedNode.text || ''}
                                onChange={(e) => handlePropChange('text', e.target.value)}
                                placeholder="mdi:home or text"
                            />
                        )}
                    </div>
                    {selectedNode.type === 'label' && (
                        <div className="prop-row">
                            <label>Mode</label>
                            <select
                                value={selectedNode.long_mode || 'WRAP'}
                                onChange={(e) => handlePropChange('long_mode', e.target.value)}
                            >
                                <option value="WRAP">Wrap</option>
                                <option value="DOT">Dot</option>
                                <option value="SCROLL">Scroll</option>
                                <option value="SCROLL_CIRC">Scroll Circ</option>
                                <option value="CLIP">Clip</option>
                            </select>
                        </div>
                    )}
                </div>
            )}

            {selectedNode.type === 'image' && (
                <div className="property-group">
                    <h3>Image</h3>
                    <div className="prop-row">
                        <label>Source</label>
                        <select
                            value={selectedNode.src || ''}
                            onChange={(e) => handlePropChange('src', e.target.value)}
                        >
                            <option value="">Select Image...</option>
                            {assets
                                .filter(a => a.type === 'image')
                                .map(img => (
                                    <option key={img.id} value={img.value}>
                                        {img.name} {img.source && !img.source.startsWith('data:') ? `(${img.source})` : ''}
                                    </option>
                                ))
                            }
                        </select>
                    </div>
                    {selectedNode.src && assets.find(a => a.type === 'image' && a.value === selectedNode.src)?.source?.startsWith('data:') && (
                        <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', textAlign: 'center' }}>
                            <img
                                src={assets.find(a => a.type === 'image' && a.value === selectedNode.src)?.source}
                                style={{ maxWidth: '100%', maxHeight: '100px', objectFit: 'contain' }}
                                alt="Preview"
                            />
                        </div>
                    )}
                </div>
            )}

            {(selectedNode.type === 'dropdown' || selectedNode.type === 'roller') && (
                <div className="property-group">
                    <h3>Options</h3>
                    <div className="prop-row">
                        <label>Items</label>
                        <textarea
                            value={selectedNode.options || ''}
                            onChange={(e) => handlePropChange('options', e.target.value)}
                            placeholder="Option 1\nOption 2"
                            rows={4}
                            style={{
                                width: '100%',
                                background: 'hsl(var(--bg-surface))',
                                color: 'hsl(var(--text-main))',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontFamily: 'inherit',
                                fontSize: '0.8rem',
                                resize: 'vertical'
                            }}
                        />
                    </div>
                </div>
            )}

            {(selectedNode.type === 'bar' || selectedNode.type === 'slider' || selectedNode.type === 'arc' || selectedNode.type === 'spinbox') && (
                <div className="property-group">
                    <h3>Value Range</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="prop-row" style={{ gridTemplateColumns: '35px 1fr', gap: '4px' }}>
                            <label>Min</label>
                            <input
                                type="number"
                                value={selectedNode.range_min ?? ''}
                                onChange={(e) => handleNumberProp('range_min', e.target.value)}
                            />
                        </div>
                        <div className="prop-row" style={{ gridTemplateColumns: '35px 1fr', gap: '4px' }}>
                            <label>Max</label>
                            <input
                                type="number"
                                value={selectedNode.range_max ?? ''}
                                onChange={(e) => handleNumberProp('range_max', e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="prop-row">
                        <label>Value</label>
                        <input
                            type="number"
                            value={selectedNode.value ?? ''}
                            onChange={(e) => handleNumberProp('value', e.target.value)}
                        />
                    </div>
                    {selectedNode.type === 'arc' && (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="prop-row" style={{ gridTemplateColumns: '40px 1fr', gap: '4px' }}>
                                    <label>Start</label>
                                    <input
                                        type="number"
                                        value={selectedNode.start_angle ?? ''}
                                        onChange={(e) => handleNumberProp('start_angle', e.target.value)}
                                    />
                                </div>
                                <div className="prop-row" style={{ gridTemplateColumns: '40px 1fr', gap: '4px' }}>
                                    <label>End</label>
                                    <input
                                        type="number"
                                        value={selectedNode.end_angle ?? ''}
                                        onChange={(e) => handleNumberProp('end_angle', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="prop-row">
                                <label>Rot</label>
                                <input
                                    type="number"
                                    value={selectedNode.rotation ?? ''}
                                    onChange={(e) => handleNumberProp('rotation', e.target.value)}
                                />
                            </div>
                        </>
                    )}
                </div>
            )}

            <div className="property-group">
                <h3>Style</h3>
                <div className="state-selector" style={{ display: 'flex', gap: '4px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {['DEFAULT', 'PRESSED', 'CHECKED', 'FOCUSED', 'DISABLED'].map(state => {
                        const hasStateStyles = state !== 'DEFAULT' && selectedNode.style_references?.some(r => r.state === state && r.styles && Object.keys(r.styles).length > 0);
                        return (
                            <button
                                key={state}
                                onClick={() => setActiveState(state)}
                                style={{
                                    padding: '4px 8px',
                                    fontSize: '0.7rem',
                                    background: activeState === state ? 'var(--primary)' : 'hsl(var(--bg-surface-soft))',
                                    color: activeState === state ? 'white' : 'hsl(var(--text-main))',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    position: 'relative'
                                }}
                            >
                                {state.charAt(0) + state.slice(1).toLowerCase()}
                                {hasStateStyles && (
                                    <span style={{
                                        position: 'absolute',
                                        top: '-2px',
                                        right: '-2px',
                                        width: '6px',
                                        height: '6px',
                                        background: activeState === state ? 'white' : 'var(--primary)',
                                        borderRadius: '50%'
                                    }} />
                                )}
                            </button>
                        );
                    })}
                </div>
                <div className="prop-row" style={{ display: 'block' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label>Styles</label>
                        <button
                            className="add-style-btn"
                            onClick={() => {
                                const newRefs = [...(selectedNode.style_references || []), { style_id: '' }];
                                handlePropChange('style_references', newRefs);
                            }}
                            style={{
                                padding: '2px 8px',
                                fontSize: '0.7rem',
                                background: 'var(--primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            + Add
                        </button>
                    </div>

                    <div className="style-refs-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {selectedNode.style_references?.map((ref, index) => (
                            <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 24px 1fr 30px', gap: '4px', alignItems: 'center' }}>
                                <select
                                    value={ref.style_id}
                                    onChange={(e) => {
                                        const newRefs = [...(selectedNode.style_references || [])];
                                        newRefs[index] = { ...ref, style_id: e.target.value };
                                        handlePropChange('style_references', newRefs);

                                        // Also update legacy class_names for compatibility
                                        handlePropChange('class_names', newRefs.map(r => r.style_id).filter(Boolean));
                                    }}
                                    style={{ padding: '4px', fontSize: '0.75rem', background: 'hsl(var(--bg-surface))', color: 'hsl(var(--text-main))', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}
                                >
                                    <option value="">Style ID</option>
                                    {Object.keys(global_styles).map(sId => (
                                        <option key={sId} value={sId}>{sId}</option>
                                    ))}
                                </select>
                                <button
                                    className="edit-style-btn"
                                    onClick={() => useStore.getState().openStyleEditor(ref.style_id)}
                                    title="Edit Style"
                                    disabled={!ref.style_id}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: ref.style_id ? 'var(--primary)' : 'hsl(var(--text-dim))',
                                        cursor: ref.style_id ? 'pointer' : 'default',
                                        padding: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <i className="mdi mdi-pencil" style={{ fontSize: '0.9rem' }}></i>
                                </button>
                                <select
                                    value={ref.state || 'DEFAULT'}
                                    onChange={(e) => {
                                        const newRefs = [...(selectedNode.style_references || [])];
                                        newRefs[index] = {
                                            ...ref,
                                            state: e.target.value === 'DEFAULT' ? undefined : e.target.value as any
                                        };
                                        handlePropChange('style_references', newRefs);
                                    }}
                                    style={{ padding: '4px', fontSize: '0.75rem', background: 'hsl(var(--bg-surface))', color: 'hsl(var(--text-main))', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}
                                >
                                    <option value="DEFAULT">Default</option>
                                    <option value="PRESSED">Pressed</option>
                                    <option value="CHECKED">Checked</option>
                                    <option value="FOCUSED">Focused</option>
                                    <option value="DISABLED">Disabled</option>
                                </select>
                                <button
                                    onClick={() => {
                                        const newRefs = selectedNode.style_references?.filter((_, i) => i !== index);
                                        handlePropChange('style_references', newRefs);
                                        handlePropChange('class_names', newRefs?.map(r => r.style_id).filter(Boolean));
                                    }}
                                    style={{
                                        padding: '4px',
                                        background: 'transparent',
                                        color: 'hsl(var(--text-muted))',
                                        border: 'none',
                                        fontSize: '1rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="prop-row">
                    <label>Font</label>
                    <select
                        value={getStyleValue('text_font') || ''}
                        onChange={(e) => handleStyleChange('text_font', e.target.value)}
                    >
                        <option value="">Default</option>
                        {assets
                            .filter(a => a.type === 'font')
                            .map(font => (
                                <option key={font.id} value={font.value}>
                                    {font.name} ({font.family} {font.size}px)
                                </option>
                            ))
                        }
                    </select>
                </div>
                <div className="prop-row">
                    <label>T-Align</label>
                    <select
                        value={getStyleValue('text_align') || 'LEFT'}
                        onChange={(e) => handleStyleChange('text_align', e.target.value)}
                    >
                        <option value="LEFT">Left</option>
                        <option value="CENTER">Center</option>
                        <option value="RIGHT">Right</option>
                    </select>
                </div>
                <div className="prop-row">
                    <label>Bg Color</label>
                    <div className="color-input-group">
                        <input
                            type="color"
                            value={getStyleValue('bg_color') || '#000000'}
                            onChange={(e) => handleStyleChange('bg_color', e.target.value)}
                        />
                        <input
                            type="text"
                            value={getStyleValue('bg_color') || ''}
                            onChange={(e) => handleStyleChange('bg_color', e.target.value)}
                            placeholder={activeState === 'DEFAULT' ? "hex" : (selectedNode.styles?.bg_color || "hex")}
                            className="text-input-compact"
                        />
                    </div>
                </div>
                <div className="prop-row">
                    <label>Text Color</label>
                    <div className="color-input-group">
                        <input
                            type="color"
                            value={getStyleValue('text_color') || '#ffffff'}
                            onChange={(e) => handleStyleChange('text_color', e.target.value)}
                        />
                        <input
                            type="text"
                            value={getStyleValue('text_color') || ''}
                            onChange={(e) => handleStyleChange('text_color', e.target.value)}
                            placeholder={activeState === 'DEFAULT' ? "hex" : (selectedNode.styles?.text_color || "hex")}
                            className="text-input-compact"
                        />
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="prop-row" style={{ gridTemplateColumns: '45px 1fr', gap: '4px' }}>
                        <label>Radius</label>
                        <input
                            type="number"
                            value={getStyleValue('radius') ?? ''}
                            placeholder={activeState !== 'DEFAULT' && selectedNode.styles?.radius !== undefined ? String(selectedNode.styles.radius) : ""}
                            onChange={(e) => handleNumberStyle('radius', e.target.value)}
                        />
                    </div>
                    <div className="prop-row" style={{ gridTemplateColumns: '45px 1fr', gap: '4px' }}>
                        <label>Border</label>
                        <input
                            type="number"
                            value={getStyleValue('border_width') ?? ''}
                            placeholder={activeState !== 'DEFAULT' && selectedNode.styles?.border_width !== undefined ? String(selectedNode.styles.border_width) : ""}
                            onChange={(e) => handleNumberStyle('border_width', e.target.value)}
                        />
                    </div>
                </div>
                {selectedNode.type === 'arc' && (
                    <div className="prop-row">
                        <label>Arc Width</label>
                        <input
                            type="number"
                            value={getStyleValue('arc_width') ?? ''}
                            placeholder={activeState !== 'DEFAULT' && selectedNode.styles?.arc_width !== undefined ? String(selectedNode.styles.arc_width) : ""}
                            onChange={(e) => handleNumberStyle('arc_width', e.target.value)}
                        />
                    </div>
                )}
            </div>
            <div className="property-group">
                <h3>Actions ({Object.keys(selectedNode.actions || {}).length})</h3>
                {selectedNode.actions && Object.entries(selectedNode.actions).map(([trigger, actionSeq]) => (
                    <div key={trigger} className="action-trigger-group" style={{
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '10px',
                        marginBottom: '10px',
                        background: 'hsla(var(--bg-surface-elevated), 0.3)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'hsl(var(--text-main))' }}>{trigger}</label>
                            <button
                                onClick={() => {
                                    const newActions = { ...selectedNode.actions };
                                    delete newActions[trigger];
                                    handlePropChange('actions', Object.keys(newActions).length > 0 ? newActions : undefined);
                                }}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'hsl(var(--error))',
                                    cursor: 'pointer',
                                    fontSize: '0.7rem',
                                    padding: '2px 4px'
                                }}
                            >
                                Remove Trigger
                            </button>
                        </div>

                        {/* Action Steps */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {(Array.isArray(actionSeq) ? actionSeq : [actionSeq]).map((step, stepIdx) => (
                                <div key={stepIdx} style={{
                                    padding: '8px',
                                    background: 'hsl(var(--bg-surface))',
                                    borderRadius: '4px',
                                    borderLeft: '3px solid var(--primary)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-dim))' }}>Step {stepIdx + 1}</span>
                                        <button
                                            onClick={() => {
                                                const newSeq = Array.isArray(actionSeq) ? [...actionSeq] : [actionSeq];
                                                newSeq.splice(stepIdx, 1);
                                                handlePropChange('actions', { ...selectedNode.actions, [trigger]: newSeq });
                                            }}
                                            style={{ background: 'transparent', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer', fontSize: '0.75rem' }}
                                        >×</button>
                                    </div>
                                    <ActionStepEditor
                                        step={step}
                                        onChange={(newValue) => {
                                            const newSeq = Array.isArray(actionSeq) ? [...actionSeq] : [actionSeq];
                                            newSeq[stepIdx] = newValue;
                                            handlePropChange('actions', { ...selectedNode.actions, [trigger]: newSeq });
                                        }}
                                    />
                                </div>
                            ))}
                            <button
                                onClick={() => {
                                    const newSeq = Array.isArray(actionSeq) ? [...actionSeq, {}] : [actionSeq, {}];
                                    handlePropChange('actions', { ...selectedNode.actions, [trigger]: newSeq });
                                }}
                                style={{
                                    padding: '4px',
                                    fontSize: '0.7rem',
                                    background: 'transparent',
                                    border: '1px dashed var(--border-subtle)',
                                    color: 'hsl(var(--text-muted))',
                                    cursor: 'pointer',
                                    borderRadius: '4px'
                                }}
                            >
                                + Add Step
                            </button>
                        </div>
                    </div>
                ))}

                <div style={{ marginTop: '12px', display: 'flex', gap: '4px' }}>
                    <input
                        type="text"
                        placeholder="New Trigger (e.g. on_click)"
                        className="text-input-compact"
                        value={newActionInput}
                        onChange={(e) => setNewActionInput(e.target.value)}
                        style={{
                            flex: 1,
                            padding: '6px 8px',
                            background: 'hsl(var(--bg-surface))',
                            border: '1px solid var(--border-subtle)',
                            color: 'hsl(var(--text-main))',
                            borderRadius: '4px'
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && newActionInput) {
                                handlePropChange('actions', { ...(selectedNode.actions || {}), [newActionInput]: [] });
                                setNewActionInput('');
                            }
                        }}
                    />
                    <button
                        onClick={() => {
                            if (newActionInput) {
                                handlePropChange('actions', { ...(selectedNode.actions || {}), [newActionInput]: [] });
                                setNewActionInput('');
                            }
                        }}
                        style={{
                            padding: '6px 12px',
                            fontSize: '0.75rem',
                            background: 'hsl(var(--primary))',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        Add
                    </button>
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
                .prop-row-checkbox {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.8rem;
                    color: hsl(var(--text-muted));
                }
                .prop-row-checkbox input {
                    width: 14px;
                    height: 14px;
                }
                .nested-group {
                    padding-left: 12px;
                    border-left: 2px solid var(--border-subtle);
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-top: 8px;
                }
                @keyframes popIn {
                    from { opacity: 0; transform: scale(0.95) translateY(-10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>
        </div>
    );
};
