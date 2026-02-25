import React from 'react';
import { useStore } from '../../store';
import { EmulatorWidget } from './EmulatorWidget';

export const EmulatorModal: React.FC = () => {
    const { widgets, emulatorOpen, setEmulatorOpen, canvasConfig } = useStore();
    const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!emulatorOpen) return;
        const obs = new ResizeObserver(entries => {
            if (entries[0]) {
                setContainerSize({
                    width: entries[0].contentRect.width - 100,
                    height: entries[0].contentRect.height - 150
                });
            }
        });
        if (containerRef.current) obs.observe(containerRef.current);
        return () => obs.disconnect();
    }, [emulatorOpen]);

    if (!emulatorOpen) return null;

    const scale = Math.min(
        1,
        containerSize.width / canvasConfig.width,
        containerSize.height / canvasConfig.height
    );

    return (
        <div ref={containerRef} className="emulator-overlay" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.92)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            backdropFilter: 'blur(12px)'
        }}>
            <div className="emulator-header" style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                padding: '16px 32px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(25,25,25,0.8)',
                color: 'white',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(10px)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', background: 'var(--primary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="mdi mdi-play" style={{ color: 'white', fontSize: '1.4rem' }}></i>
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem', lineHeight: 1 }}>Live Emulator</div>
                        <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '2px' }}>{canvasConfig.width}x{canvasConfig.height} • LVGL Logic</div>
                    </div>
                </div>
                <button
                    onClick={() => setEmulatorOpen(false)}
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#aaa',
                        fontSize: '1.2rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#fff';
                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#aaa';
                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    }}
                >
                    <i className="mdi mdi-close"></i>
                </button>
            </div>

            <div className="emulator-viewport-wrapper" style={{
                transform: `scale(${scale})`,
                transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                boxShadow: '0 30px 60px rgba(0,0,0,0.8)',
                borderRadius: '24px',
                padding: '12px',
                background: '#1a1a1a',
                border: '1px solid rgba(255,255,255,0.1)'
            }}>
                <div className="emulator-viewport" style={{
                    width: canvasConfig.width,
                    height: canvasConfig.height,
                    background: '#000',
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: '4px',
                    boxSizing: 'content-box' // CRITICAL: Ensure bezel doesn't eat into screen size
                }}>
                    {widgets.map(node => (
                        <EmulatorWidget key={node.id} node={node} isRoot={true} />
                    ))}
                </div>
            </div>

            <div className="emulator-footer" style={{
                position: 'absolute',
                bottom: '30px',
                display: 'flex',
                gap: '24px',
                color: '#555',
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '1px'
            }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><i className="mdi mdi-mouse"></i> Click to Interact</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><i className="mdi mdi-keyboard"></i> ESC to Exit</span>
            </div>
        </div>
    );
};
