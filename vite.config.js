import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
// https://vitejs.dev/config/
export default defineConfig({
    base: './',
    plugins: [
        react(),
        electron([
            {
                // Main-process entry file of the Electron App.
                entry: 'electron/main.ts',
            },
            {
                entry: 'electron/preload.ts',
                onstart: function (options) {
                    // Notify the Renderer-process to reload the page when the Preload-script build is complete,
                    // instead of restarting the entire Electron App.
                    options.reload();
                },
            },
        ]),
        renderer(),
    ],
});
