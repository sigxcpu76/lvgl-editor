import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'

window.onerror = (message, source, lineno, colno, error) => {
    console.error(`Static error: ${message}\nAt: ${source}:${lineno}:${colno}`);
};

window.onunhandledrejection = (event) => {
    console.error(`Unhandled promise rejection: ${event.reason}`);
};

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
