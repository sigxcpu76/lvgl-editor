import React from 'react';
import { Canvas } from './components/canvas/Canvas';
import { PropertiesPanel } from './components/properties/PropertiesPanel';
import { WidgetPalette } from './components/palette/WidgetPalette';
import { useStore } from './store';
import { yamlEngine } from './utils/yaml';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { AssetManager } from './components/assets/AssetManager';
import { CanvasSettings } from './components/toolbar/CanvasSettings';
import { WidgetTree } from './components/sidebar/WidgetTree';
import { YamlPreview } from './components/preview/YamlPreview';
import { StyleEditorModal } from './components/toolbar/StyleEditorModal';
import { ThemeToggle } from './components/toolbar/ThemeToggle';
import { EmulatorModal } from './components/emulator/EmulatorModal';
import './App.css';

function App() {
    const { loadState, widgets, assets, substitutions, copySelectedWidget, pasteWidget, undo, redo, canUndo, canRedo, resetState, selectedIds, removeWidget, moveSelectedWidgets, gridConfig, theme, setTheme, setRawYaml, setEmulatorOpen, assetManagerOpen, setAssetManagerOpen } = useStore();
    const [treeHeight, setTreeHeight] = React.useState(300);
    const [isResizingTree, setIsResizingTree] = React.useState(false);
    const [showPreview, setShowPreview] = React.useState(false);
    const [generatedYaml, setGeneratedYaml] = React.useState('');

    // Keyboard shortcuts
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) {
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                copySelectedWidget();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                pasteWidget();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                undo();
            } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
                redo();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedIds.length > 0) {
                    removeWidget(selectedIds);
                }
            } else if (e.key.startsWith('Arrow')) {
                const step = e.shiftKey ? 10 : (gridConfig.enabled ? gridConfig.size : 1);
                if (e.key === 'ArrowUp') moveSelectedWidgets(0, -step);
                else if (e.key === 'ArrowDown') moveSelectedWidgets(0, step);
                else if (e.key === 'ArrowLeft') moveSelectedWidgets(-step, 0);
                else if (e.key === 'ArrowRight') moveSelectedWidgets(step, 0);
                e.preventDefault();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [copySelectedWidget, pasteWidget, undo, redo]);

    // Load initial state
    React.useEffect(() => {
        const stored = import('./store').then(m => m.loadStateFromStorage());
        stored.then(data => {
            if (data) {
                if (data.widgets) useStore.getState().loadState(data.widgets);
                if (data.assets) useStore.getState().loadAssets(data.assets);
                if (data.substitutions) useStore.getState().setSubstitutions(data.substitutions);
                // Also optionally config
                if (data.canvasConfig) useStore.getState().setCanvasSize(data.canvasConfig.width, data.canvasConfig.height);
                if (data.theme) setTheme(data.theme);
                if (data.rawYaml) {
                    useStore.getState().setRawYaml(data.rawYaml);
                    yamlEngine.parse(data.rawYaml);
                }
            }
        });
    }, []);


    const startResizing = React.useCallback((e: React.MouseEvent) => {
        setIsResizingTree(true);
        e.preventDefault();
    }, []);

    const stopResizing = React.useCallback(() => {
        setIsResizingTree(false);
    }, []);

    const resize = React.useCallback((e: MouseEvent) => {
        if (isResizingTree) {
            const newHeight = window.innerHeight - e.clientY;
            setTreeHeight(Math.max(100, Math.min(newHeight, window.innerHeight - 200)));
        }
    }, [isResizingTree]);

    React.useEffect(() => {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [resize, stopResizing]);

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            if (content) {
                try {
                    const { widgets: loadedWidgets, assets: loadedAssets, substitutions: loadedSubs } = yamlEngine.parse(content);
                    if (loadedWidgets && loadedWidgets.length > 0) {
                        loadState(loadedWidgets);
                        if (loadedAssets && loadedAssets.length > 0) {
                            useStore.getState().loadAssets(loadedAssets);
                        }
                        if (loadedSubs) {
                            useStore.getState().setSubstitutions(loadedSubs);
                        }
                        setRawYaml(content);
                    } else {
                        alert("No LVGL widgets or pages found in the YAML. Please ensure your file contains an 'lvgl:' section.");
                    }
                } catch (e) {
                    console.error("Import error:", e);
                    alert("Failed to parse YAML file. See console for details.");
                }
            }
        };
        reader.readAsText(file);
    };

    const handleExport = () => {
        const { widgets, assets, global_styles } = useStore.getState();
        const generatedYaml = yamlEngine.generate(widgets, assets, global_styles);
        setGeneratedYaml(generatedYaml);
        setShowPreview(true);
    };

    const handleDownload = async () => {
        if ((window as any).ipcRenderer) {
            try {
                await (window as any).ipcRenderer.invoke('save-file', {
                    content: generatedYaml,
                    defaultPath: 'esphome_lvgl.yaml'
                });
            } catch (e) {
                console.error('Failed to save file via IPC:', e);
            }
        } else {
            const blob = new Blob([generatedYaml], { type: 'text/yaml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'esphome_lvgl.yaml';
            a.click();
            URL.revokeObjectURL(url);
        }
    };

    return (
        <DndProvider backend={HTML5Backend}>
            <div className={`editor-layout theme-${theme}`} style={{ cursor: isResizingTree ? 'ns-resize' : 'default' }}>
                <header className="toolbar">
                    <div className="toolbar-left">
                        <h1>ESPHome LVGL Editor</h1>
                    </div>

                    <div className="toolbar-actions" style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '16px', marginLeft: '20px' }}>
                        <CanvasSettings />
                        <StyleEditorModal />
                        <ThemeToggle />
                        <button
                            className="btn-icon"
                            style={{ border: '1px solid var(--border-muted)', padding: '6px', borderRadius: '4px' }}
                            onClick={() => setAssetManagerOpen(true)}
                            title="Assets"
                        >
                            <span className="mdi mdi-folder-multiple-image" />
                        </button>

                        <div className="setting-divider" style={{ width: '1px', height: '24px', background: 'var(--border-subtle)' }} />

                        <div className="button-group" style={{ display: 'flex', gap: '8px' }}>
                            <button
                                className="btn-icon"
                                style={{ border: '1px solid var(--border-muted)', padding: '6px', borderRadius: '4px' }}
                                onClick={() => {
                                    if (window.confirm('Start from scratch? All current changes will be lost.')) {
                                        resetState();
                                    }
                                }}
                                title="New Project"
                            >
                                <span className="mdi mdi-file-outline" />
                            </button>

                            <label className="btn-icon" style={{ border: '1px solid var(--border-muted)', padding: '6px', borderRadius: '4px', cursor: 'pointer', margin: 0 }} title="Load YAML">
                                <span className="mdi mdi-upload" />
                                <input
                                    type="file"
                                    accept=".yaml,.yml"
                                    style={{ display: 'none' }}
                                    onChange={handleImport}
                                />
                            </label>

                            <button className="btn-icon" style={{ border: '1px solid var(--border-muted)', padding: '6px', borderRadius: '4px' }} onClick={handleExport} title="Export YAML">
                                <span className="mdi mdi-download" />
                            </button>

                            <button
                                className="btn-icon"
                                style={{
                                    border: '1px solid var(--primary)',
                                    padding: '6px',
                                    borderRadius: '4px',
                                    background: 'var(--primary)',
                                    color: 'white'
                                }}
                                onClick={() => setEmulatorOpen(true)}
                                title="Run Emulator"
                            >
                                <span className="mdi mdi-play" />
                            </button>
                        </div>

                        <div className="setting-divider" style={{ width: '1px', height: '24px', background: 'var(--border-subtle)' }} />

                        <div className="button-group" style={{ display: 'flex', gap: '8px' }}>
                            <button
                                className="btn-icon"
                                style={{ border: '1px solid var(--border-muted)', padding: '6px', borderRadius: '4px' }}
                                onClick={undo}
                                disabled={!canUndo}
                                title="Undo (Ctrl+Z)"
                            >
                                <span className="mdi mdi-undo" />
                            </button>
                            <button
                                className="btn-icon"
                                style={{ border: '1px solid var(--border-muted)', padding: '6px', borderRadius: '4px' }}
                                onClick={redo}
                                disabled={!canRedo}
                                title="Redo (Ctrl+Y)"
                            >
                                <span className="mdi mdi-redo" />
                            </button>
                        </div>
                    </div>
                </header>

                <main className="editor-main">
                    <aside className="sidebar left-sidebar">
                        <div className="sidebar-section hierarchy-section" style={{ height: '100%' }}>
                            <div className="sidebar-header">Hierarchy</div>
                            <div className="scrollable" style={{ flex: 1 }}>
                                <WidgetTree />
                            </div>
                        </div>
                    </aside>

                    <section className="canvas-area-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: 'hsl(var(--bg-base))' }}>
                        <div className="widget-palette-bar" style={{ flexShrink: 0, borderBottom: '1px solid var(--border-subtle)', background: 'hsl(var(--bg-surface))', zIndex: 10 }}>
                            <WidgetPalette />
                        </div>
                        <div className="canvas-area" style={{ flex: 1 }}>
                            <div className="canvas-container">
                                <Canvas />
                            </div>
                        </div>
                    </section>

                    <aside className="sidebar right-sidebar">
                        <div className="sidebar-section properties-section" style={{ flex: 1 }}>
                            <div className="sidebar-header">Properties</div>
                            <div className="scrollable" style={{ flex: 1 }}>
                                <PropertiesPanel />
                            </div>
                        </div>
                    </aside>
                </main>

                {showPreview && (
                    <YamlPreview
                        yaml={generatedYaml}
                        onClose={() => setShowPreview(false)}
                        onDownload={handleDownload}
                    />
                )}

                <EmulatorModal />
                <AssetManager />
            </div>
        </DndProvider>
    );
}

export default App;
