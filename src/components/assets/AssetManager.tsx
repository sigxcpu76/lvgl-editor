import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

export const loadGoogleFont = (family: string) => {
    if (!family) return;
    const linkId = `gfont-${family.replace(/\s+/g, '-').toLowerCase()}`;
    if (document.getElementById(linkId)) return;

    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/\s+/g, '+')}&display=swap`;
    document.head.appendChild(link);
};

const DraggableAsset: React.FC<{ asset: Asset; onRemove: (id: string) => void; onPreview?: (asset: Asset) => void }> = ({ asset, onRemove, onPreview }) => {
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
                            style={{
                                fontSize: '1.2rem',
                                color: 'hsl(var(--primary))',
                                display: 'inline-block',
                                lineHeight: 1,
                                fontFamily: [
                                    '"Material Design Icons"',
                                    ...useStore.getState().assets.filter(a => a.type === 'font' && a.family).map(a => `"${a.family}"`),
                                    'sans-serif'
                                ].join(', ')
                            }}
                            title={`Glyph: \\U${asset.value.codePointAt(0)?.toString(16).padStart(8, '0').toUpperCase()}`}
                        >
                            {asset.value}
                        </span>
                    ) : (
                        <span className={`mdi mdi-${asset.value.replace('mdi:', '')}`} />
                    )
                ) : asset.type === 'image' ? (
                    asset.source && (asset.source.startsWith('http') || asset.source.startsWith('data:')) ? (
                        <img
                            src={asset.source}
                            style={{ width: '24px', height: '24px', objectFit: 'contain', borderRadius: '2px', cursor: 'zoom-in' }}
                            alt=""
                            onClick={(e) => {
                                e.stopPropagation();
                                onPreview?.(asset);
                            }}
                        />
                    ) : (
                        <span className="mdi mdi-image-outline" />
                    )
                ) : (
                    <span className="mdi mdi-format-font" />
                )}
                <div className="asset-details">
                    <span className="asset-name">{cleanName(asset.name)}</span>
                    {asset.type === 'font' && asset.size && (
                        <span className="asset-val">{asset.family} {asset.size}px</span>
                    )}
                </div>
            </div>
            <button className="btn-remove" onClick={() => onRemove(asset.id)}>×</button>
        </div>
    );
};

export const AssetManager: React.FC = () => {
    const { assets, addAsset, removeAsset, assetManagerOpen, setAssetManagerOpen, theme } = useStore();
    const [name, setName] = useState('');
    const [type, setType] = useState<'icon' | 'font' | 'image'>('icon');
    const [value, setValue] = useState('');
    const [family, setFamily] = useState('');
    const [size, setSize] = useState('16');
    const [source, setSource] = useState('');
    const [width, setWidth] = useState('100');
    const [height, setHeight] = useState('100');
    const [originalImage, setOriginalImage] = useState<string | null>(null);
    const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (type === 'image' && originalImage && width && height) {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = Number(width) || img.width;
                canvas.height = Number(height) || img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    setSource(canvas.toDataURL('image/png'));
                }
            };
            img.src = originalImage;
        }
    }, [originalImage, width, height, type]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result as string;
            setOriginalImage(result);
            // Auto-fill name if empty
            if (!name) {
                setName(file.name.split('.')[0].replace(/[^a-z0-9_]/gi, '_').toLowerCase());
            }

            // Get original dimensions to initialize width/height if they are default
            const img = new Image();
            img.onload = () => {
                if (width === '100' && height === '100') {
                    setWidth(String(img.width));
                    setHeight(String(img.height));
                }
            };
            img.src = result;
        };
        reader.readAsDataURL(file);
    };


    const handleAdd = () => {
        if (!name || (type === 'icon' && !value) || (type === 'font' && !family) || (type === 'image' && !source)) return;

        let finalSource = source;
        if (type === 'font' && !finalSource && family) {
            finalSource = `gfonts://${family}`;
        }

        const newAsset: Asset = {
            id: uuidv4(),
            name,
            type,
            value: type === 'icon' ? value : (type === 'image' ? name : name), // Use name as ID for fonts and images
            family: type === 'font' ? family : undefined,
            size: type === 'font' ? Number(size) : undefined,
            source: (type === 'font' || type === 'image') ? finalSource : undefined,
            width: type === 'image' ? Number(width) : undefined,
            height: type === 'image' ? Number(height) : undefined
        };

        if (type === 'font' && finalSource?.startsWith('gfonts://')) {
            loadGoogleFont(family);
        }

        addAsset(newAsset);
        setName('');
        setValue('');
        setFamily('');
        setSource('');
        setOriginalImage(null);
        setWidth('100');
        setHeight('100');
    };

    if (!assetManagerOpen) return null;

    return createPortal(
        <div className={`modal-overlay theme-${theme}`} onClick={() => setAssetManagerOpen(false)}>
            <div className="modal-content asset-manager-modal" onClick={e => e.stopPropagation()} style={{ width: '500px', height: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <h2>Asset Management</h2>
                    <button className="btn-close" onClick={() => setAssetManagerOpen(false)}>×</button>
                </div>
                <div className="modal-body" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div className="asset-manager-container">
                        <div className="property-group no-border" style={{ padding: '0 12px 12px 12px' }}>
                            <div className="prop-row">
                                <label>Asset ID</label>
                                <input
                                    type="text"
                                    placeholder="e.g. my_image"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                />
                            </div>
                            <div className="prop-row">
                                <label>Type</label>
                                <select value={type} onChange={e => setType(e.target.value as any)}>
                                    <option value="icon">Icon (MDI)</option>
                                    <option value="font">Font (Custom)</option>
                                    <option value="image">Image</option>
                                </select>
                            </div>
                            {type === 'icon' ? (
                                <div className="prop-row">
                                    <label>MDI Name</label>
                                    <input
                                        type="text"
                                        placeholder="home"
                                        value={value}
                                        onChange={e => setValue(e.target.value)}
                                    />
                                </div>
                            ) : type === 'font' ? (
                                <>
                                    <div className="prop-row">
                                        <label>Family</label>
                                        <input
                                            type="text"
                                            placeholder="Roboto"
                                            value={family}
                                            onChange={e => setFamily(e.target.value)}
                                        />
                                    </div>
                                    <div className="prop-row">
                                        <label>Size</label>
                                        <input
                                            type="number"
                                            value={size}
                                            onChange={e => setSize(e.target.value)}
                                        />
                                    </div>
                                    <div className="prop-row">
                                        <label>Source</label>
                                        <input
                                            type="text"
                                            placeholder="gfonts://Roboto"
                                            value={source}
                                            onChange={e => setSource(e.target.value)}
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="prop-row">
                                        <label>Source</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                type="text"
                                                placeholder="images/logo.png"
                                                value={source.startsWith('data:') ? 'Base64 Image Data' : source}
                                                onChange={e => {
                                                    setSource(e.target.value);
                                                    if (!e.target.value.startsWith('data:')) setOriginalImage(null);
                                                }}
                                                style={{ flex: 1 }}
                                            />
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                style={{ display: 'none' }}
                                                accept="image/*"
                                                onChange={handleFileChange}
                                            />
                                            <button
                                                className="btn secondary"
                                                style={{ padding: '0 8px', minWidth: 'auto' }}
                                                onClick={() => fileInputRef.current?.click()}
                                                title="Upload from disk"
                                            >
                                                <span className="mdi mdi-upload" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="prop-row" style={{ gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <label style={{ fontSize: '0.7rem' }}>Width</label>
                                            <input
                                                type="number"
                                                value={width}
                                                onChange={e => setWidth(e.target.value)}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <label style={{ fontSize: '0.7rem' }}>Height</label>
                                            <input
                                                type="number"
                                                value={height}
                                                onChange={e => setHeight(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                            <button className="btn primary w-full" style={{ marginTop: '8px' }} onClick={handleAdd}>
                                Add Asset
                            </button>
                        </div>

                        <div className="sidebar-header" style={{ background: 'rgba(255,255,255,0.03)', fontSize: '0.65rem', borderTop: '1px solid var(--border-subtle)', padding: '8px 12px' }}>
                            Active Assets
                        </div>

                        <div className="asset-list">
                            {assets.length === 0 ? (
                                <div className="empty-state" style={{ padding: '20px' }}>No assets added</div>
                            ) : (
                                assets.map(asset => (
                                    <DraggableAsset
                                        key={asset.id}
                                        asset={asset}
                                        onRemove={removeAsset}
                                        onPreview={setPreviewAsset}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn secondary" onClick={() => setAssetManagerOpen(false)}>Close</button>
                </div>
            </div>

            {previewAsset && createPortal(
                <div className="modal-overlay" style={{ zIndex: 3000, background: 'rgba(0,0,0,0.85)' }} onClick={() => setPreviewAsset(null)}>
                    <div className="modal-content" style={{ background: 'transparent', border: 'none', boxShadow: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '90vw', height: '90vh' }}>
                        <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%' }}>
                            <img
                                src={previewAsset.source}
                                style={{ maxWidth: '100%', maxHeight: '80vh', display: 'block', borderRadius: '8px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}
                                alt={previewAsset.name}
                            />
                            <div style={{ position: 'absolute', bottom: '-40px', left: '50%', transform: 'translateX(-50%)', color: 'white', background: 'rgba(0,0,0,0.5)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                                {previewAsset.name} ({previewAsset.width}x{previewAsset.height})
                            </div>
                            <button
                                onClick={() => setPreviewAsset(null)}
                                style={{ position: 'absolute', top: '-40px', right: '-40px', background: 'white', color: 'black', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                ×
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            <style>{`
                .asset-manager-modal {
                    background: hsl(var(--bg-surface-elevated));
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--border-subtle);
                    box-shadow: var(--shadow-xl);
                    overflow: hidden;
                }
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
                    min-height: 200px;
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
        </div>,
        document.body
    );
};
