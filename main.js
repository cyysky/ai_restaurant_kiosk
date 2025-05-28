const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Import system components
const SystemOrchestrator = require('./app/orchestrator/system_orchestrator');

class KioskApplication {
  constructor() {
    this.mainWindow = null;
    this.orchestrator = null;
    this.isDev = process.argv.includes('--dev');
  }

  async initialize() {
    // Initialize system orchestrator
    this.orchestrator = new SystemOrchestrator();
    await this.orchestrator.initialize();

    // Set up IPC handlers
    this.setupIpcHandlers();
  }

  createWindow() {
    // Create the browser window with kiosk configuration
    this.mainWindow = new BrowserWindow({
      width: this.isDev ? 1200 : 1920,
      height: this.isDev ? 800 : 1080,
      fullscreen: !this.isDev,
      kiosk: !this.isDev,
      frame: this.isDev,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true
      },
      show: false
    });

    // Load the app
    this.mainWindow.loadFile('app/ui/index.html');

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
      
      // Set main window reference for speech components
      if (this.orchestrator) {
        this.orchestrator.setMainWindow(this.mainWindow);
      }
      
      if (this.isDev) {
        this.mainWindow.webContents.openDevTools();
      }
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Prevent navigation away from the app
    this.mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
      const parsedUrl = new URL(navigationUrl);
      if (parsedUrl.origin !== 'file://') {
        event.preventDefault();
      }
    });

    // Disable right-click context menu in production
    if (!this.isDev) {
      this.mainWindow.webContents.on('context-menu', (event) => {
        event.preventDefault();
      });
    }
  }

  setupIpcHandlers() {
    // Handle speech input
    ipcMain.handle('speech-input', async (event, audioData) => {
      return await this.orchestrator.handleSpeechInput(audioData);
    });

    // Handle touch input
    ipcMain.handle('touch-input', async (event, action, data) => {
      return await this.orchestrator.handleTouchInput(action, data);
    });

    // Handle menu requests
    ipcMain.handle('menu-request', async (event, request) => {
      return await this.orchestrator.handleMenuRequest(request);
    });

    // Handle system status
    ipcMain.handle('system-status', async (event) => {
      return await this.orchestrator.getSystemStatus();
    });

    // Handle configuration updates
    ipcMain.handle('update-config', async (event, config) => {
      return await this.orchestrator.updateConfiguration(config);
    });
  }
}

// Application lifecycle
const kioskApp = new KioskApplication();

app.whenReady().then(async () => {
  await kioskApp.initialize();
  kioskApp.createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      kioskApp.createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle app termination
app.on('before-quit', async () => {
  if (kioskApp.orchestrator) {
    await kioskApp.orchestrator.shutdown();
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (kioskApp.mainWindow) {
      if (kioskApp.mainWindow.isMinimized()) {
        kioskApp.mainWindow.restore();
      }
      kioskApp.mainWindow.focus();
    }
  });
}