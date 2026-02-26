import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron'
import * as fs from 'fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

console.log('Main process starting...', { __dirname })

process.env.APP_ROOT = path.join(__dirname, '..')

// The built directory structure
// |- dist
//   |- index.html
// |- dist-electron
//   |- main.js
//   |- preload.js
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

const VITE_PUBLIC = process.env.VITE_PUBLIC!

let win: BrowserWindow | null

// Setup Menu
const template: any[] = [
    {
        label: 'View',
        submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' }
        ]
    }
]
const menu = Menu.buildFromTemplate(template)
Menu.setApplicationMenu(menu)

function createWindow() {
    console.log('Creating window...', {
        VITE_DEV_SERVER_URL,
        RENDERER_DIST,
        preloadPath: path.join(__dirname, 'preload.js')
    });

    win = new BrowserWindow({
        width: 1280,
        height: 800,
        // icon: path.join(VITE_PUBLIC, 'electron-vite.svg'), // Removed missing icon
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    })

    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('Failed to load:', errorCode, errorDescription);
    });

    win.webContents.on('render-process-gone', (event, details) => {
        console.error('Renderer process gone:', details);
    });

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
        win.webContents.openDevTools()
    } else {
        const indexPath = path.join(RENDERER_DIST, 'index.html')
        console.log('Loading production file:', indexPath)
        win.loadURL(pathToFileURL(indexPath).toString())
    }
}


ipcMain.on('sync-state', (_, state) => {
    console.log('Main process: Received sync-state', state.widgets?.length)
})

ipcMain.handle('save-file', async (event, { content, defaultPath }) => {
    const window = BrowserWindow.getFocusedWindow();
    if (!window) return null;

    const { filePath } = await dialog.showSaveDialog(window, {
        defaultPath,
        filters: [{ name: 'YAML', extensions: ['yaml', 'yml'] }]
    });

    if (filePath) {
        fs.writeFileSync(filePath, content, 'utf-8');
        return filePath;
    }
    return null;
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
        win = null
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

app.whenReady().then(createWindow)
