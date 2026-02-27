import React from 'react';
import { createPortal } from 'react-dom';
import Editor, { useMonaco } from '@monaco-editor/react';
import { useStore } from '../../store';
import { WidgetNode } from '../../types';

interface YamlEditorProps {
    yaml: string;
    onClose: () => void;
    onDownload: () => void;
    onApply: (newYaml: string) => void;
}

export const YamlEditor: React.FC<YamlEditorProps> = ({ yaml, onClose, onDownload, onApply }) => {
    const { theme, widgets, assets, global_styles } = useStore();
    const [currentValue, setCurrentValue] = React.useState(yaml);
    const monaco = useMonaco();

    React.useEffect(() => {
        if (!monaco) return;

        // Register a new language
        monaco.languages.register({ id: 'esphome-yaml' });

        // Define syntax highlighting
        monaco.languages.setMonarchTokensProvider('esphome-yaml', {
            tokenizer: {
                root: [
                    [/^(\s*)([a-z_0-9-]+:)/, ['white', 'keyword']], // Keys
                    [/^(\s*)(- )/, ['white', 'operator']], // List item
                    [/#.*$/, 'comment'], // Comments
                    [/['"].*?['"]/, 'string'], // Strings
                    [/\b(true|false|null)\b/, 'boolean'], // Booleans
                    [/\b\d+(\.\d+)?\b/, 'number'], // Numbers
                    [/\b0x[0-9A-Fa-f]+\b/, 'number.hex'], // Hex numbers
                    [/\$\{.*?\}/, 'variable'], // Substitutions
                ]
            }
        });

        // Define a completion provider
        const completionProvider = monaco.languages.registerCompletionItemProvider('esphome-yaml', {
            provideCompletionItems: (model, position) => {
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn,
                };

                // Helper to gather all IDs from the widget tree
                const getAllIds = (nodes: WidgetNode[]): string[] => {
                    let ids: string[] = [];
                    nodes.forEach(n => {
                        if (n.name) ids.push(n.name);
                        if (n.children) ids = [...ids, ...getAllIds(n.children)];
                    });
                    return ids;
                };

                const widgetIds = getAllIds(widgets);
                const styleIds = Object.keys(global_styles);
                const assetNames = assets.map(a => a.name);

                const suggestions = [
                    // Top level / Common keywords
                    ...['lvgl', 'pages', 'widgets', 'style_definitions', 'id', 'x', 'y', 'width', 'height', 'text', 'align', 'styles', 'layout', 'type'].map(k => ({
                        label: k,
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: k + ': ',
                        range,
                    })),
                    // Widget types
                    ...['page', 'label', 'button', 'obj', 'arc', 'bar', 'slider', 'switch', 'checkbox', 'spinbox', 'dropdown', 'roller', 'textarea', 'led'].map(t => ({
                        label: t,
                        kind: monaco.languages.CompletionItemKind.Class,
                        insertText: t,
                        range,
                    })),
                    // Dynamic Widget IDs
                    ...widgetIds.map(id => ({
                        label: id,
                        kind: monaco.languages.CompletionItemKind.Variable,
                        insertText: id,
                        range,
                        detail: 'Widget ID'
                    })),
                    // Dynamic Style IDs
                    ...styleIds.map(id => ({
                        label: id,
                        kind: monaco.languages.CompletionItemKind.Method,
                        insertText: id,
                        range,
                        detail: 'Global Style'
                    })),
                    // Asset Names
                    ...assetNames.map(name => ({
                        label: name,
                        kind: monaco.languages.CompletionItemKind.File,
                        insertText: name,
                        range,
                        detail: 'Asset'
                    }))
                ];

                return { suggestions };
            }
        });

        return () => {
            completionProvider.dispose();
        };
    }, [monaco, widgets, assets, global_styles]);

    return createPortal(
        <div className={`modal-overlay theme-${theme}`}>
            <div className="modal-content yaml-editor-modal" style={{ width: '80vw', height: '85vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header" style={{ background: 'hsl(var(--bg-surface-elevated))' }}>
                    <h2>Context-Aware YAML Editor</h2>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn primary" onClick={() => onApply(currentValue)}>
                            Apply Changes
                        </button>
                        <button className="btn-close" onClick={onClose}>×</button>
                    </div>
                </div>
                <div className="modal-body" style={{ flex: 1, padding: 0, overflow: 'hidden' }}>
                    <Editor
                        height="100%"
                        defaultLanguage="esphome-yaml"
                        theme={theme === 'dark' ? 'vs-dark' : 'light'}
                        value={currentValue}
                        onChange={(val) => setCurrentValue(val || '')}
                        options={{
                            minimap: { enabled: true },
                            fontSize: 14,
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            wordWrap: 'on',
                        }}
                    />
                </div>
                <div className="modal-footer" style={{ background: 'hsl(var(--bg-surface-elevated))', justifyContent: 'space-between' }}>
                    <div style={{ color: 'hsl(var(--text-muted))', fontSize: '0.8rem' }}>
                        Hint: Use Ctrl+Space for autocompletion (widgets, styles, properties)
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn secondary" onClick={onDownload}>
                            Download .yaml
                        </button>
                        <button className="btn secondary" onClick={onClose}>
                            Close
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                .yaml-editor-modal {
                    max-width: 1400px;
                    background: hsl(var(--bg-surface));
                    border: 1px solid var(--border-subtle);
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                }
            `}</style>
        </div>
        , document.body);
};
