import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../../store';
import { StyleProperties } from '../../types';

export const StyleEditorModal: React.FC = () => {
    const {
        global_styles, updateGlobalStyle, removeGlobalStyle, assets,
        styleEditorOpen, editingStyleId, closeStyleEditor
    } = useStore();
    const [selectedClass, setSelectedClass] = useState<string | null>(null);
    const [newClassName, setNewClassName] = useState('');

    // Sync selectedClass with editingStyleId from store
    React.useEffect(() => {
        if (editingStyleId) {
            setSelectedClass(editingStyleId);
        }
    }, [editingStyleId]);

    const classNames = Object.keys(global_styles);

    const handleCreateClass = () => {
        const name = newClassName.trim();
        if (!name) return;
        if (global_styles[name]) {
            alert('Class already exists!');
            return;
        }
        updateGlobalStyle(name, { bg_color: '#000000', text_color: '#ffffff' });
        setNewClassName('');
        setSelectedClass(name);
    };

    const handleDeleteClass = (name: string) => {
        if (window.confirm(`Delete class "${name}"?`)) {
            removeGlobalStyle(name);
            if (selectedClass === name) {
                setSelectedClass(null);
            }
        }
    };

    const handleStyleChange = (key: keyof StyleProperties, value: any) => {
        if (!selectedClass) return;
        const currentStyles = global_styles[selectedClass] || {};
        updateGlobalStyle(selectedClass, {
            ...currentStyles,
            [key]: value
        });
    };

    const handleNumberStyle = (key: keyof StyleProperties, val: string) => {
        handleStyleChange(key, val === '' ? undefined : Number(val));
    };

    const activeStyle = selectedClass ? global_styles[selectedClass] : null;

    return (
        <>
            <button className="btn" onClick={() => useStore.getState().openStyleEditor()} title="Global Styles Editor">
                <i className="mdi mdi-palette-swatch" style={{ marginRight: '4px' }}></i>
                Styles
            </button>

            {styleEditorOpen && createPortal(
                <div className="modal-overlay" onClick={closeStyleEditor}>
                    <div className="yaml-preview-modal" onClick={e => e.stopPropagation()} style={{ width: '600px', height: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="modal-header">
                            <h2>Global Styles Editor</h2>
                            <button className="btn-close" onClick={closeStyleEditor}>×</button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flex: 1, padding: 0, overflow: 'hidden' }}>
                            {/* Left Side: Class List */}
                            <div style={{ width: '200px', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', background: 'hsl(var(--bg-base))' }}>
                                <div style={{ padding: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <input
                                            type="text"
                                            placeholder="New class name..."
                                            value={newClassName}
                                            onChange={(e) => setNewClassName(e.target.value)}
                                            style={{ flex: 1, padding: '4px', background: 'hsl(var(--bg-surface))', color: 'hsl(var(--text-main))', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}
                                        />
                                        <button className="btn-primary btn-small" onClick={handleCreateClass} disabled={!newClassName.trim()}>
                                            <i className="mdi mdi-plus"></i>
                                        </button>
                                    </div>
                                </div>
                                <div className="scrollable" style={{ flex: 1, padding: '8px 0' }}>
                                    {classNames.length === 0 ? (
                                        <div style={{ padding: '12px', color: 'hsl(var(--text-muted))', fontSize: '0.85rem', textAlign: 'center' }}>No global styles defined.</div>
                                    ) : (
                                        classNames.map(name => (
                                            <div
                                                key={name}
                                                style={{
                                                    padding: '8px 12px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    background: selectedClass === name ? 'hsla(var(--primary), 0.2)' : 'transparent',
                                                    borderLeft: selectedClass === name ? '3px solid hsl(var(--primary))' : '3px solid transparent'
                                                }}
                                                onClick={() => setSelectedClass(name)}
                                            >
                                                <span style={{ fontSize: '0.9rem' }}>.{name}</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteClass(name); }}
                                                    style={{ background: 'transparent', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer', padding: '4px' }}
                                                >
                                                    <i className="mdi mdi-delete"></i>
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Right Side: Properties */}
                            <div className="scrollable properties-panel" style={{ flex: 1, background: 'hsl(var(--bg-surface))' }}>
                                {activeStyle ? (
                                    <>
                                        <div className="property-group">
                                            <h3>Typography</h3>
                                            <div className="prop-row">
                                                <label>Font</label>
                                                <select
                                                    value={activeStyle.text_font || ''}
                                                    onChange={(e) => handleStyleChange('text_font', e.target.value)}
                                                >
                                                    <option value="">Default</option>
                                                    {assets.filter(a => a.type === 'font').map(font => (
                                                        <option key={font.id} value={font.value}>
                                                            {font.name} ({font.family} {font.size}px)
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="prop-row">
                                                <label>T-Align</label>
                                                <select
                                                    value={activeStyle.text_align || ''}
                                                    onChange={(e) => handleStyleChange('text_align', e.target.value)}
                                                >
                                                    <option value="">Inherit</option>
                                                    <option value="LEFT">Left</option>
                                                    <option value="CENTER">Center</option>
                                                    <option value="RIGHT">Right</option>
                                                </select>
                                            </div>
                                            <div className="prop-row">
                                                <label>Color</label>
                                                <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: '8px' }}>
                                                    <input
                                                        type="color"
                                                        value={activeStyle.text_color || '#ffffff'}
                                                        onChange={(e) => handleStyleChange('text_color', e.target.value)}
                                                        style={{ padding: 0, height: '28px', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                                                    />
                                                    <input
                                                        type="text"
                                                        value={activeStyle.text_color || ''}
                                                        onChange={(e) => handleStyleChange('text_color', e.target.value)}
                                                        placeholder="hex"
                                                        style={{ fontFamily: 'monospace', fontSize: '0.75rem', padding: '0 4px', background: 'hsl(var(--bg-base))', color: 'hsl(var(--text-main))', border: '1px solid var(--border-subtle)' }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="property-group">
                                            <h3>Background & Border</h3>
                                            <div className="prop-row">
                                                <label>Bg Color</label>
                                                <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: '8px' }}>
                                                    <input
                                                        type="color"
                                                        value={activeStyle.bg_color || '#000000'}
                                                        onChange={(e) => handleStyleChange('bg_color', e.target.value)}
                                                        style={{ padding: 0, height: '28px', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                                                    />
                                                    <input
                                                        type="text"
                                                        value={activeStyle.bg_color || ''}
                                                        onChange={(e) => handleStyleChange('bg_color', e.target.value)}
                                                        placeholder="hex"
                                                        style={{ fontFamily: 'monospace', fontSize: '0.75rem', padding: '0 4px', background: 'hsl(var(--bg-base))', color: 'hsl(var(--text-main))', border: '1px solid var(--border-subtle)' }}
                                                    />
                                                </div>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                <div className="prop-row" style={{ gridTemplateColumns: '45px 1fr', gap: '4px' }}>
                                                    <label>Opacity</label>
                                                    <input
                                                        type="number"
                                                        min={0} max={1} step={0.1}
                                                        value={activeStyle.bg_opa ?? ''}
                                                        onChange={(e) => handleNumberStyle('bg_opa', e.target.value)}
                                                        placeholder="0-1"
                                                    />
                                                </div>
                                                <div className="prop-row" style={{ gridTemplateColumns: '45px 1fr', gap: '4px' }}>
                                                    <label>Radius</label>
                                                    <input
                                                        type="number"
                                                        value={activeStyle.radius ?? ''}
                                                        onChange={(e) => handleNumberStyle('radius', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                <div className="prop-row" style={{ gridTemplateColumns: '45px 1fr', gap: '4px' }}>
                                                    <label>B-Width</label>
                                                    <input
                                                        type="number"
                                                        value={activeStyle.border_width ?? ''}
                                                        onChange={(e) => handleNumberStyle('border_width', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="prop-row">
                                                <label>B-Color</label>
                                                <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: '8px' }}>
                                                    <input
                                                        type="color"
                                                        value={activeStyle.border_color || '#cccccc'}
                                                        onChange={(e) => handleStyleChange('border_color', e.target.value)}
                                                        style={{ padding: 0, height: '28px', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                                                    />
                                                    <input
                                                        type="text"
                                                        value={activeStyle.border_color || ''}
                                                        onChange={(e) => handleStyleChange('border_color', e.target.value)}
                                                        placeholder="hex"
                                                        style={{ fontFamily: 'monospace', fontSize: '0.75rem', padding: '0 4px', background: 'hsl(var(--bg-base))', color: 'hsl(var(--text-main))', border: '1px solid var(--border-subtle)' }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="property-group">
                                            <h3>Padding & Spacing</h3>
                                            <div className="prop-row">
                                                <label>All</label>
                                                <input
                                                    type="number"
                                                    value={activeStyle.pad_all ?? ''}
                                                    onChange={(e) => handleNumberStyle('pad_all', e.target.value)}
                                                />
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                <div className="prop-row" style={{ gridTemplateColumns: '40px 1fr', gap: '4px' }}>
                                                    <label>Top</label>
                                                    <input type="number" value={activeStyle.pad_top ?? ''} onChange={(e) => handleNumberStyle('pad_top', e.target.value)} />
                                                </div>
                                                <div className="prop-row" style={{ gridTemplateColumns: '40px 1fr', gap: '4px' }}>
                                                    <label>Bottom</label>
                                                    <input type="number" value={activeStyle.pad_bottom ?? ''} onChange={(e) => handleNumberStyle('pad_bottom', e.target.value)} />
                                                </div>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                <div className="prop-row" style={{ gridTemplateColumns: '40px 1fr', gap: '4px' }}>
                                                    <label>Left</label>
                                                    <input type="number" value={activeStyle.pad_left ?? ''} onChange={(e) => handleNumberStyle('pad_left', e.target.value)} />
                                                </div>
                                                <div className="prop-row" style={{ gridTemplateColumns: '40px 1fr', gap: '4px' }}>
                                                    <label>Right</label>
                                                    <input type="number" value={activeStyle.pad_right ?? ''} onChange={(e) => handleNumberStyle('pad_right', e.target.value)} />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="property-group">
                                            <h3>Widget Specific</h3>
                                            <div className="prop-row">
                                                <label>Arc Color</label>
                                                <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: '8px' }}>
                                                    <input
                                                        type="color"
                                                        value={activeStyle.arc_color || '#007acc'}
                                                        onChange={(e) => handleStyleChange('arc_color', e.target.value)}
                                                        style={{ padding: 0, height: '28px', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                                                    />
                                                    <input
                                                        type="text"
                                                        value={activeStyle.arc_color || ''}
                                                        onChange={(e) => handleStyleChange('arc_color', e.target.value)}
                                                        placeholder="hex"
                                                        style={{ fontFamily: 'monospace', fontSize: '0.75rem', padding: '0 4px', background: 'hsl(var(--bg-base))', color: 'hsl(var(--text-main))', border: '1px solid var(--border-subtle)' }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="prop-row">
                                                <label>Arc Width</label>
                                                <input
                                                    type="number"
                                                    value={activeStyle.arc_width ?? ''}
                                                    onChange={(e) => handleNumberStyle('arc_width', e.target.value)}
                                                />
                                            </div>
                                            <div className="prop-row">
                                                <label>Line Color</label>
                                                <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: '8px' }}>
                                                    <input
                                                        type="color"
                                                        value={activeStyle.line_color || '#cccccc'}
                                                        onChange={(e) => handleStyleChange('line_color', e.target.value)}
                                                        style={{ padding: 0, height: '28px', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                                                    />
                                                    <input
                                                        type="text"
                                                        value={activeStyle.line_color || ''}
                                                        onChange={(e) => handleStyleChange('line_color', e.target.value)}
                                                        placeholder="hex"
                                                        style={{ fontFamily: 'monospace', fontSize: '0.75rem', padding: '0 4px', background: 'hsl(var(--bg-base))', color: 'hsl(var(--text-main))', border: '1px solid var(--border-subtle)' }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="prop-row">
                                                <label>Line Width</label>
                                                <input
                                                    type="number"
                                                    value={activeStyle.line_width ?? ''}
                                                    onChange={(e) => handleNumberStyle('line_width', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="empty-state">Select or create a class to edit styles.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                , document.body)}
        </>
    );
};
