import React, { useState } from 'react';
import { useStore } from '../../store';
import { Resolution } from '../../types';

export const CanvasSettings: React.FC = () => {
    const { canvasConfig, setCanvasSize, addCanvasPreset, setZoom, setViewMode, gridConfig, setGridConfig } = useStore();
    const [customWidth, setCustomWidth] = useState(canvasConfig.width);
    const [customHeight, setCustomHeight] = useState(canvasConfig.height);
    const [showAddPreset, setShowAddPreset] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');

    const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const preset = canvasConfig.presets.find(p => p.name === e.target.value);
        if (preset) {
            setCanvasSize(preset.width, preset.height);
            setCustomWidth(preset.width);
            setCustomHeight(preset.height);
        }
    };

    const handleWidthChange = (val: number) => {
        setCustomWidth(val);
        setCanvasSize(val, customHeight);
    };

    const handleHeightChange = (val: number) => {
        setCustomHeight(val);
        setCanvasSize(customWidth, val);
    };

    const handleAddPreset = () => {
        if (!newPresetName) return;
        const newPreset: Resolution = {
            name: newPresetName,
            width: customWidth,
            height: customHeight
        };
        addCanvasPreset(newPreset);
        setNewPresetName('');
        setShowAddPreset(false);
    };

    return (
        <div className="canvas-settings">
            <div className="setting-group">
                <label>Resolution</label>
                <select
                    value={canvasConfig.presets.find(p => p.width === canvasConfig.width && p.height === canvasConfig.height)?.name || 'Custom'}
                    onChange={handlePresetChange}
                    className="input-select"
                >
                    <option value="Custom">Custom</option>
                    {canvasConfig.presets.map(p => (
                        <option key={p.name} value={p.name}>{p.name} ({p.width}x{p.height})</option>
                    ))}
                </select>
            </div>

            <div className="setting-group-inline">
                <div className="setting-item">
                    <label>W</label>
                    <input
                        type="number"
                        value={customWidth}
                        onChange={(e) => handleWidthChange(parseInt(e.target.value))}
                        className="input-number"
                    />
                </div>
                <div className="setting-item">
                    <label>H</label>
                    <input
                        type="number"
                        value={customHeight}
                        onChange={(e) => handleHeightChange(parseInt(e.target.value))}
                        className="input-number"
                    />
                </div>
            </div>

            <div className="setting-divider" />

            <div className="setting-group">
                <div className="mode-toggle">
                    <button
                        className={`btn-mode ${canvasConfig.viewMode === '1:1' ? 'active' : ''}`}
                        onClick={() => setViewMode('1:1')}
                        title="1:1 Resolution"
                    >
                        1:1
                    </button>
                    <button
                        className={`btn-mode ${canvasConfig.viewMode === 'fit' ? 'active' : ''}`}
                        onClick={() => setViewMode('fit')}
                        title="Fit to Area"
                    >
                        Fit
                    </button>
                </div>
            </div>

            <div className="setting-group zoom-group">
                <label className="mdi mdi-magnify" />
                <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={canvasConfig.zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    className="input-range"
                    disabled={canvasConfig.viewMode === 'fit'}
                />
                <span className="zoom-value">{Math.round(canvasConfig.zoom * 100)}%</span>
            </div>

            <div className="setting-divider" />

            <div className="setting-group grid-controls">
                <button
                    className={`btn-icon ${gridConfig.visible ? 'active' : ''}`}
                    onClick={() => setGridConfig({ visible: !gridConfig.visible })}
                    title="Toggle Grid Visibility"
                >
                    <span className="mdi mdi-grid" />
                </button>
                <button
                    className={`btn-icon ${gridConfig.enabled ? 'active' : ''}`}
                    onClick={() => setGridConfig({ enabled: !gridConfig.enabled })}
                    title="Toggle Snap to Grid"
                >
                    <span className="mdi mdi-magnet" />
                </button>
                <div className="setting-item">
                    <label>Grid</label>
                    <input
                        type="number"
                        value={gridConfig.size}
                        min="2"
                        max="50"
                        onChange={(e) => setGridConfig({ size: parseInt(e.target.value) || 5 })}
                        className="input-number-tiny"
                    />
                </div>
            </div>

            <div className="setting-actions">
                {!showAddPreset ? (
                    <button className="btn-secondary btn-small" onClick={() => setShowAddPreset(true)}>
                        <span className="mdi mdi-plus" />
                    </button>
                ) : (
                    <div className="add-preset-popover">
                        <input
                            type="text"
                            placeholder="Preset Name"
                            value={newPresetName}
                            onChange={(e) => setNewPresetName(e.target.value)}
                            className="input-text"
                            autoFocus
                        />
                        <div className="btn-row">
                            <button className="btn-primary btn-small" onClick={handleAddPreset}>Save</button>
                            <button className="btn-secondary btn-small" onClick={() => setShowAddPreset(false)}>Cancel</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
