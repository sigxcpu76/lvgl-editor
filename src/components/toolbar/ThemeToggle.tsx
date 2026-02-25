import React from 'react';
import { useStore } from '../../store';

export const ThemeToggle: React.FC = () => {
    const { theme, setTheme } = useStore();

    return (
        <div className="mode-toggle">
            <button
                className={`btn-mode ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
                title="Light Mode"
            >
                <span className="mdi mdi-brightness-7" />
            </button>
            <button
                className={`btn-mode ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')}
                title="Dark Mode"
            >
                <span className="mdi mdi-moon-waning-crescent" />
            </button>
        </div>
    );
};
