import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../../store';
import { StyleProperties } from '../../types';

export const StyleEditorModal: React.FC = () => {
    const {
        global_styles, updateGlobalStyle, removeGlobalStyle, assets,
        styleEditorOpen, editingStyleId, closeStyleEditor, theme
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

    if (!styleEditorOpen) return null;

    return createPortal(
        <div className={`modal-overlay theme-${theme}`} onClick={closeStyleEditor}>
            <div className="yaml-preview-modal" onClick={e => e.stopPropagation()} style={{ width: '600px', height: '80vh', display: 'flex', flexDirection: 'column', background: 'hsl(var(--bg-surface-elevated))' }}>
                <div className="modal-header">
                    <h2>Global Styles Editor</h2>
                    <button className="btn-close" onClick={closeStyleEditor}>×</button>
                </div>
                <div className="modal-body" style={{ display: 'flex', flex: 1, padding: 0, overflow: 'hidden' }}>
                    {/* Left Side: Class List */}
                    <div style={{ width: '220px', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', background: 'hsl(var(--bg-surface))' }}>
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)', background: 'hsl(var(--bg-base))' }}>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    placeholder="New Class..."
                                    value={newClassName}
                                    onChange={(e) => setNewClassName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateClass()}
                                    style={{
                                        width: '100%',
                                        padding: '8px 32px 8px 12px',
                                        background: 'hsl(var(--bg-surface-elevated))',
                                        color: 'hsl(var(--text-main))',
                                        border: '1px solid var(--border-muted)',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: '0.85rem',
                                        outline: 'none'
                                    }}
                                />
                                <button
                                    onClick={handleCreateClass}
                                    disabled={!newClassName.trim()}
                                    style={{
                                        position: 'absolute',
                                        right: '4px',
                                        background: newClassName.trim() ? 'hsl(var(--primary))' : 'transparent',
                                        color: newClassName.trim() ? 'white' : 'hsl(var(--text-dim))',
                                        border: 'none',
                                        borderRadius: 'var(--radius-sm)',
                                        width: '24px',
                                        height: '24px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: newClassName.trim() ? 'pointer' : 'default',
                                        transition: 'var(--transition-fast)'
                                    }}
                                >
                                    <i className="mdi mdi-plus" style={{ fontSize: '1.1rem' }}></i>
                                </button>
                            </div>
                        </div>
                        <div className="scrollable" style={{ flex: 1, padding: '8px 0' }}>
                            {classNames.length === 0 ? (
                                <div style={{ padding: '24px 12px', color: 'hsl(var(--text-dim))', fontSize: '0.8rem', textAlign: 'center' }}>
                                    <i className="mdi mdi-palette-swatch-outline" style={{ fontSize: '2rem', display: 'block', marginBottom: '8px', opacity: 0.3 }}></i>
                                    No global styles
                                </div>
                            ) : (
                                classNames.sort().map(name => (
                                    <div
                                        key={name}
                                        className={`style-list-item ${selectedClass === name ? 'active' : ''}`}
                                        style={{
                                            padding: '10px 16px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            background: selectedClass === name ? 'var(--primary-glow)' : 'transparent',
                                            color: selectedClass === name ? 'hsl(var(--primary))' : 'hsl(var(--text-main))',
                                            borderLeft: `3px solid ${selectedClass === name ? 'hsl(var(--primary))' : 'transparent'}`,
                                            transition: 'var(--transition-fast)',
                                            margin: '2px 0'
                                        }}
                                        onClick={() => setSelectedClass(name)}
                                        onMouseEnter={(e) => { if (selectedClass !== name) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                                        onMouseLeave={(e) => { if (selectedClass !== name) e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <i className="mdi mdi-pound" style={{ opacity: 0.5, fontSize: '0.8rem' }}></i>
                                            <span style={{ fontSize: '0.85rem', fontWeight: selectedClass === name ? '600' : '400' }}>{name}</span>
                                        </div>
                                        <button
                                            className="delete-btn-hover"
                                            onClick={(e) => { e.stopPropagation(); handleDeleteClass(name); }}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: 'hsl(var(--text-dim))',
                                                cursor: 'pointer',
                                                padding: '4px',
                                                borderRadius: '4px',
                                                opacity: selectedClass === name ? 1 : 0,
                                                transition: 'var(--transition-fast)'
                                            }}
                                        >
                                            <i className="mdi mdi-trash-can-outline"></i>
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
                                {/* Style Preview Section */}
                                <div style={{
                                    padding: '20px',
                                    borderBottom: '1px solid var(--border-subtle)',
                                    background: 'hsl(var(--bg-base))',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px'
                                }}>
                                    <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(var(--text-muted))', margin: 0 }}>Live Preview</h3>
                                    <div style={{
                                        height: '120px',
                                        borderRadius: 'var(--radius-md)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAAXNSR0IArs4c6QAAACBJREFUGFdjZEAD///f/8+AxGZkZMQpAeb/Z0BmAwEAnj8fAd0e0JgAAAAASUVORK5CYII=") repeat',
                                        border: '1px solid var(--border-muted)',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            backgroundColor: activeStyle.bg_color || '#000000',
                                            opacity: activeStyle.bg_opa ?? 1,
                                            borderRadius: `${activeStyle.radius ?? 0}px`,
                                            border: `${activeStyle.border_width ?? 0}px solid ${activeStyle.border_color || 'transparent'}`,
                                            color: activeStyle.text_color || '#ffffff',
                                            paddingTop: `${activeStyle.pad_top ?? activeStyle.pad_all ?? 0}px`,
                                            paddingBottom: `${activeStyle.pad_bottom ?? activeStyle.pad_all ?? 0}px`,
                                            paddingLeft: `${activeStyle.pad_left ?? activeStyle.pad_all ?? 0}px`,
                                            paddingRight: `${activeStyle.pad_right ?? activeStyle.pad_all ?? 0}px`,
                                            textAlign: (activeStyle.text_align?.toLowerCase() as any) || 'inherit',
                                            width: '80%',
                                            minHeight: '40px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s ease',
                                            fontFamily: assets.find(a => a.value === activeStyle.text_font)?.family || 'inherit'
                                        }}>
                                            Sample Text
                                        </div>
                                    </div>
                                </div>

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
        </div>,
        document.body
    );
};
