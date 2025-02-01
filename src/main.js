
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let updateWindow;

function createMainWindow() {
    mainWindow = new BrowserWindow({
        // ...existing code...
    });

    mainWindow.loadFile('index.html');
    // ...existing code...
}

function createUpdateWindow() {
    updateWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });

    updateWindow.loadFile('update.html');
    updateWindow.on('closed', () => {
        updateWindow = null;
    });
}

app.on('ready', () => {
    createMainWindow();
    // ...existing code...
});

ipcMain.on('open-update-window', () => {
    if (!updateWindow) {
        createUpdateWindow();
    }
});

// ...existing code...