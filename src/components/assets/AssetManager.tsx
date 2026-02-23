import React, { useState } from 'react';
import { useStore } from '../../store';
import { v4 as uuidv4 } from 'uuid';
import { Asset } from '../../types';
import { useDrag } from 'react-dnd';

const cleanName = (text: string) => {
    return Array.from(text).filter(char => {
        const cp = char.codePointAt(0);
        if (!cp) return true;
        return !((cp >= 0xE000 && cp <= 0xF8FF) || (cp >= 0xF0000 && cp <= 0xFFFFD) || (cp >= 0x100000 && cp <= 0x10FFFD));
    }).join('').trim();
};

const DraggableAsset: React.FC<{ asset: Asset; onRemove: (id: string) => void }> = ({ asset, onRemove }) => {
    const [{ isDragging }, dragRef] = useDrag({
        type: 'asset',
        item: { asset },
        collect: (monitor) => ({
            isDragging: !!monitor.isDragging(),
        }),
    });

    const drag = dragRef as unknown as React.LegacyRef<HTMLDivElement>;

    return (
        <div
            ref={drag}
            className="asset-mini-card"
            style={{ opacity: isDragging ? 0.4 : 1, cursor: 'grab' }}
        >
            <div className="asset-label">
                {asset.type === 'icon' ? (
                    (asset.value.length === 1 || asset.value.length === 2) && !asset.value.startsWith('mdi:') ? (
                        <span
                            className="mdi-glyph mdi"
                            style={{ fontSize: '1.2rem', color: 'hsl(var(--primary))' }}
                            title={`Glyph: \\U${asset.value.codePointAt(0)?.toString(16).padStart(8, '0').toUpperCase()}`}
                        >
                            {asset.value}
                        </span>
                    ) : (
                        <span className={`mdi mdi-${asset.value.replace('mdi:', '')}`} />
                    )
                ) : (
                    <span className="mdi mdi-format-font" />
                )}
                <div className="asset-details">
                    <span className="asset-name">{cleanName(asset.name)}</span>
                </div>
            </div>
            <button className="btn-remove" onClick={() => onRemove(asset.id)}>×</button>
        </div>
    );
};

export const AssetManager: React.FC = () => {
    const { assets, addAsset, removeAsset } = useStore();
    const [name, setName] = useState('');
    const [type, setType] = useState<'icon' | 'font'>('icon');
    const [value, setValue] = useState('');

    const handleAdd = () => {
        if (!name || !value) return;
        const newAsset: Asset = {
            id: uuidv4(),
            name,
            type,
            value
        };
        addAsset(newAsset);
        setName('');
        setValue('');
    };

    return (
        <div className="asset-manager-container">
            <div className="property-group no-border">
                <div className="prop-row">
                    <label>Name</label>
                    <input
                        type="text"
                        placeholder="e.g. HomeIcon"
                        value={name}
                        onChange={e => setName(e.target.value)}
                    />
                </div>
                <div className="prop-row">
                    <label>Type</label>
                    <select value={type} onChange={e => setType(e.target.value as any)}>
                        <option value="icon">Icon (MDI)</option>
                        <option value="font">Font (Custom)</option>
                    </select>
                </div>
                <div className="prop-row">
                    <label>{type === 'icon' ? 'MDI Name' : 'Family'}</label>
                    <input
                        type="text"
                        placeholder={type === 'icon' ? "home" : "Roboto"}
                        value={value}
                        onChange={e => setValue(e.target.value)}
                    />
                </div>
                <button className="btn primary w-full" style={{ marginTop: '8px' }} onClick={handleAdd}>
                    Add Asset
                </button>
            </div>

            <div className="sidebar-header" style={{ background: 'rgba(255,255,255,0.03)', fontSize: '0.65rem', borderTop: '1px solid var(--border-subtle)' }}>
                Active Assets
            </div>

            <div className="asset-list">
                {assets.length === 0 ? (
                    <div className="empty-state" style={{ padding: '20px' }}>No assets added</div>
                ) : (
                    assets.map(asset => (
                        <DraggableAsset key={asset.id} asset={asset} onRemove={removeAsset} />
                    ))
                )}
            </div>

            <style>{`
                .asset-manager-container {
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                    overflow: hidden;
                }
                .asset-list {
                    flex: 1;
                    overflow-y: auto;
                    padding: 12px;
                }
                .asset-mini-card {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: hsl(var(--bg-base));
                    border: 1px solid var(--border-subtle);
                    padding: 10px 12px;
                    border-radius: var(--radius-md);
                    margin-bottom: 8px;
                    transition: var(--transition-fast);
                }
                .asset-mini-card:hover {
                    border-color: hsl(var(--primary));
                    background: hsl(var(--bg-surface));
                }
                .asset-label {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .asset-label .mdi {
                    font-size: 1.2rem;
                    color: hsl(var(--primary));
                }
                .asset-details {
                    display: flex;
                    flex-direction: column;
                }
                .asset-name {
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: hsl(var(--text-main));
                }
                .asset-val {
                    font-size: 0.7rem;
                    color: hsl(var(--text-muted));
                }
                .btn-remove {
                    background: none;
                    border: none;
                    color: hsl(var(--text-dim));
                    cursor: pointer;
                    font-size: 1.1rem;
                    padding: 4px;
                    line-height: 1;
                    transition: color 0.2s;
                }
                .btn-remove:hover {
                    color: #ff4d4d;
                }
                .w-full { width: 100%; }
                .no-border { border: none !important; }
            `}</style>
        </div>
    );
};
