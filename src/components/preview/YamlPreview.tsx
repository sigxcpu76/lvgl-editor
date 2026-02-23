import React, { useState } from 'react';

interface YamlPreviewProps {
    yaml: string;
    onClose: () => void;
    onDownload: () => void;
}

const isGlyph = (char: string) => {
    const cp = char.codePointAt(0);
    if (!cp) return false;
    // PUA ranges: E000-F8FF, F0000-FFFFD, 100000-10FFFD
    return (cp >= 0xE000 && cp <= 0xF8FF) || (cp >= 0xF0000 && cp <= 0xFFFFD) || (cp >= 0x100000 && cp <= 0x10FFFD);
};

const HighlightText: React.FC<{ text: string }> = ({ text }) => {
    // Split into segments of glyphs and non-glyphs
    // Use Array.from to correctly iterate over surrogate pairs
    const chars = Array.from(text);
    return (
        <>
            {chars.map((char, i) => {
                const cp = char.codePointAt(0);
                if (isGlyph(char)) {
                    return (
                        <span
                            key={i}
                            className="mdi-glyph mdi"
                            title={`Glyph: \\U${cp?.toString(16).padStart(8, '0').toUpperCase()}`}
                        >
                            {char}
                        </span>
                    );
                }
                return char;
            })}
        </>
    );
};

const Highlight: React.FC<{ code: string }> = ({ code }) => {
    // Basic YAML highlighting rules
    const tokens = code.split(/(\n)/);

    return (
        <>
            {tokens.map((token, i) => {
                if (token === '\n') return <br key={i} />;

                // Key: value
                const keyMatch = token.match(/^(\s*)([\w-]+:)(.*)/);
                if (keyMatch) {
                    const [, indent, key, rest] = keyMatch;
                    return (
                        <span key={i}>
                            {indent}
                            <span className="hl-key">{key}</span>
                            {rest.split(/(\d+(?:\.\d+)?|true|false|null|['"].*?['"])/).map((part, j) => {
                                if (part.match(/^['"].*?['"]$/)) return <span key={j} className="hl-string"><HighlightText text={part} /></span>;
                                if (part.match(/^(?:true|false|null)$/)) return <span key={j} className="hl-bool">{part}</span>;
                                if (part.match(/^\d+(?:\.\d+)?$/)) return <span key={j} className="hl-number">{part}</span>;
                                return <HighlightText key={j} text={part} />;
                            })}
                        </span>
                    );
                }

                // List item
                const listMatch = token.match(/^(\s*)(-\s*)(.*)/);
                if (listMatch) {
                    const [, indent, dash, rest] = listMatch;
                    return (
                        <span key={i}>
                            {indent}
                            <span className="hl-dash">{dash}</span>
                            <HighlightText text={rest} />
                        </span>
                    );
                }

                // Comment
                if (token.trim().startsWith('#')) {
                    return <span key={i} className="hl-comment">{token}</span>;
                }

                return <HighlightText key={i} text={token} />;
            })}
        </>
    );
};

export const YamlPreview: React.FC<YamlPreviewProps> = ({ yaml, onClose, onDownload }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(yaml);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content yaml-preview-modal">
                <div className="modal-header">
                    <h2>YAML Preview</h2>
                    <button className="btn-close" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">
                    <pre className="yaml-code">
                        <code><Highlight code={yaml} /></code>
                    </pre>
                </div>
                <div className="modal-footer">
                    <button className={`btn ${copied ? 'primary' : 'secondary'}`} onClick={handleCopy}>
                        {copied ? 'Copied!' : 'Copy to Clipboard'}
                    </button>
                    <button className="btn primary" onClick={onDownload}>
                        Download .yaml
                    </button>
                    <button className="btn secondary" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
