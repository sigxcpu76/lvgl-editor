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
import './App.css';

function App() {
    const { loadState, widgets } = useStore();
    const [treeHeight, setTreeHeight] = React.useState(300);
    const [isResizingTree, setIsResizingTree] = React.useState(false);
    const [showPreview, setShowPreview] = React.useState(false);
    const [generatedYaml, setGeneratedYaml] = React.useState('');

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
        const yaml = yamlEngine.generate(widgets);
        setGeneratedYaml(yaml);
        setShowPreview(true);
    };

    const handleDownload = () => {
        const blob = new Blob([generatedYaml], { type: 'text/yaml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'esphome_lvgl.yaml';
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <DndProvider backend={HTML5Backend}>
            <div className="editor-layout" style={{ cursor: isResizingTree ? 'ns-resize' : 'default' }}>
                <header className="toolbar">
                    <div className="toolbar-left">
                        <h1>ESPHome LVGL Editor</h1>
                    </div>

                    <CanvasSettings />

                    <div className="toolbar-actions">
                        <label className="btn primary" style={{ cursor: 'pointer' }}>
                            Import YAML
                            <input
                                type="file"
                                accept=".yaml,.yml"
                                style={{ display: 'none' }}
                                onChange={handleImport}
                            />
                        </label>
                        <button className="btn secondary" onClick={handleExport}>Export YAML</button>
                    </div>
                </header>

                <main className="editor-main">
                    <aside className="sidebar left-sidebar">
                        <div className="sidebar-section top-section" style={{ height: '100%' }}>
                            <div className="sidebar-header">Widgets</div>
                            <div className="palette-container" style={{ flexShrink: 0 }}>
                                <WidgetPalette />
                            </div>
                            <div className="sidebar-header" style={{ borderTop: '1px solid var(--border-subtle)' }}>Asset Management</div>
                            <AssetManager />
                        </div>
                    </aside>

                    <section className="canvas-area">
                        <div className="canvas-container">
                            <Canvas />
                        </div>
                    </section>

                    <aside className="sidebar right-sidebar">
                        <div className="sidebar-section properties-section">
                            <div className="sidebar-header">Properties</div>
                            <div className="scrollable" style={{ flex: 1 }}>
                                <PropertiesPanel />
                            </div>
                        </div>

                        <div
                            className={`sidebar-resizer-h ${isResizingTree ? 'active' : ''}`}
                            onMouseDown={startResizing}
                        />

                        <div className="sidebar-section hierarchy-section" style={{ height: treeHeight, flex: '0 0 auto' }}>
                            <div className="sidebar-header" style={{ borderTop: '1px solid var(--border-subtle)' }}>Hierarchy</div>
                            <div className="scrollable" style={{ flex: 1 }}>
                                <WidgetTree />
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
            </div>
        </DndProvider>
    );
}

export default App;
