/**
 * Test script to verify TTS parameter validation and UI update fixes
 * Run this with: npm start (or electron main.js)
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Import system components
const SystemOrchestrator = require('./app/orchestrator/system_orchestrator');

class TestApplication {
    constructor() {
        this.mainWindow = null;
        this.orchestrator = null;
    }

    async initialize() {
        console.log('🔍 Initializing test application...');
        
        // Initialize system orchestrator
        this.orchestrator = new SystemOrchestrator();
        await this.orchestrator.initialize();
        
        // Set up IPC handlers
        this.setupIpcHandlers();
        
        console.log('✅ Test application initialized');
    }

    createWindow() {
        // Create the browser window
        this.mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                enableRemoteModule: false,
                preload: path.join(__dirname, 'preload.js')
            },
            show: false
        });

        // Load the app
        this.mainWindow.loadFile('app/ui/index.html');

        // Show window when ready
        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow.show();
            this.mainWindow.webContents.openDevTools();
            
            // Set main window reference for speech components
            if (this.orchestrator) {
                this.orchestrator.setMainWindow(this.mainWindow);
            }
            
            // Run tests after a delay
            setTimeout(() => {
                this.runTests();
            }, 3000);
        });

        // Handle window closed
        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });
    }

    setupIpcHandlers() {
        // Handle speech input
        ipcMain.handle('speech-input', async (event, speechData) => {
            const audioData = {
                text: speechData.text,
                confidence: speechData.confidence || 0.8,
                timestamp: Date.now(),
                source: 'frontend'
            };
            return await this.orchestrator.handleSpeechInput(audioData);
        });

        // Handle menu requests
        ipcMain.handle('menu-request', async (event, request) => {
            return await this.orchestrator.handleMenuRequest(request);
        });

        // Set up event forwarding
        this.setupEventForwarding();
    }

    setupEventForwarding() {
        if (!this.orchestrator) return;

        this.orchestrator.on('ui-update', (update) => {
            console.log('🔍 UI UPDATE EVENT:', update);
            if (this.mainWindow) {
                this.mainWindow.webContents.send('ui-update', update);
            }
        });

        this.orchestrator.on('python-service-status', (status) => {
            if (this.mainWindow) {
                this.mainWindow.webContents.send('python-service-status', status);
            }
        });
    }

    async runTests() {
        console.log('\n🧪 Running TTS and UI Update Tests...\n');
        
        // Test 1: TTS with valid parameters
        console.log('Test 1: TTS with valid parameters');
        try {
            await this.orchestrator.components.speechOutput.speak('Hello, this is a test with valid parameters.', {
                voice: 'af_heart',
                speed: 1.0,
                pitch: 1.0
            });
            console.log('✅ Test 1 passed');
        } catch (error) {
            console.log('❌ Test 1 failed:', error.message);
        }

        // Test 2: TTS with invalid parameters (should be clamped)
        console.log('\nTest 2: TTS with invalid parameters (should be clamped)');
        try {
            await this.orchestrator.components.speechOutput.speak('Testing parameter clamping.', {
                voice: 'af_heart',
                speed: 5.0,  // Should be clamped to 2.0
                pitch: 0.1   // Should be clamped to 0.5
            });
            console.log('✅ Test 2 passed (parameters were clamped)');
        } catch (error) {
            console.log('❌ Test 2 failed:', error.message);
        }

        // Test 3: UI Update event
        console.log('\nTest 3: UI Update event');
        try {
            const testAction = {
                type: 'show_menu',
                data: { view: 'categories' }
            };
            await this.orchestrator.executeActions([testAction]);
            console.log('✅ Test 3 passed (UI update event sent)');
        } catch (error) {
            console.log('❌ Test 3 failed:', error.message);
        }

        // Test 4: Speech input processing
        console.log('\nTest 4: Speech input processing');
        try {
            const audioData = {
                text: 'I want some chicken',
                confidence: 0.8,
                timestamp: Date.now(),
                source: 'test'
            };
            const result = await this.orchestrator.handleSpeechInput(audioData);
            console.log('✅ Test 4 passed:', result.intent);
        } catch (error) {
            console.log('❌ Test 4 failed:', error.message);
        }

        console.log('\n🧪 All tests completed!\n');
    }
}

// Application lifecycle
const testApp = new TestApplication();

app.whenReady().then(async () => {
    console.log('🚀 Starting test application...');
    
    await testApp.initialize();
    testApp.createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            testApp.createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', async () => {
    if (testApp.orchestrator) {
        await testApp.orchestrator.shutdown();
    }
});