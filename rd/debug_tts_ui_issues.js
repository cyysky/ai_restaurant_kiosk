/**
 * Debug script to diagnose TTS 422 errors and UI update issues
 * Run this with: npm run electron debug_tts_ui_issues.js
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Import system components
const SystemOrchestrator = require('./app/orchestrator/system_orchestrator');

class DebugApplication {
    constructor() {
        this.mainWindow = null;
        this.orchestrator = null;
        this.debugLog = [];
    }

    log(message, data = null) {
        const entry = {
            timestamp: new Date().toISOString(),
            message,
            data
        };
        this.debugLog.push(entry);
        console.log(`[DEBUG] ${entry.timestamp}: ${message}`, data || '');
    }

    async initialize() {
        this.log('Initializing debug application...');
        
        try {
            // Initialize system orchestrator
            this.orchestrator = new SystemOrchestrator();
            
            // Set up debug event listeners BEFORE initialization
            this.setupDebugEventListeners();
            
            await this.orchestrator.initialize();
            this.log('System orchestrator initialized successfully');
            
            // Set up IPC handlers
            this.setupIpcHandlers();
            this.log('IPC handlers set up');
            
        } catch (error) {
            this.log('Failed to initialize debug application', { error: error.message, stack: error.stack });
            throw error;
        }
    }

    setupDebugEventListeners() {
        this.log('Setting up debug event listeners...');
        
        // Listen for UI update events
        this.orchestrator.on('ui-update', (update) => {
            this.log('UI UPDATE EVENT CAPTURED', {
                type: update.type,
                typeOf: typeof update.type,
                data: update.data,
                fullUpdate: update
            });
        });

        // Listen for speech output events
        this.orchestrator.on('speech-output-start', (data) => {
            this.log('SPEECH OUTPUT START', data);
        });

        this.orchestrator.on('speech-output-complete', (data) => {
            this.log('SPEECH OUTPUT COMPLETE', data);
        });

        // Listen for speech errors
        this.orchestrator.components?.speechOutput?.on('speech-error', (error) => {
            this.log('SPEECH OUTPUT ERROR CAPTURED', {
                error: error.error || error,
                id: error.id,
                source: error.source
            });
        });

        // Listen for Python service status
        this.orchestrator.on('python-service-status', (status) => {
            this.log('PYTHON SERVICE STATUS UPDATE', status);
        });
    }

    createWindow() {
        this.log('Creating debug window...');
        
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
                this.log('Main window reference set for speech components');
            }
        });

        // Enhanced logging for frontend errors
        this.mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
            this.log('FRONTEND CONSOLE', {
                level,
                levelType: typeof level,
                message,
                line,
                sourceId
            });
        });

        // Handle window closed
        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });
    }

    setupIpcHandlers() {
        // Handle speech input with enhanced debugging
        ipcMain.handle('speech-input', async (event, speechData) => {
            this.log('SPEECH INPUT RECEIVED', speechData);
            
            try {
                const audioData = {
                    text: speechData.text,
                    confidence: speechData.confidence || 0.8,
                    timestamp: Date.now(),
                    source: 'frontend'
                };
                
                this.log('PROCESSING SPEECH INPUT', audioData);
                const result = await this.orchestrator.handleSpeechInput(audioData);
                this.log('SPEECH INPUT RESULT', result);
                
                return {
                    success: true,
                    intent: result?.intent,
                    entities: result?.entities,
                    response_text: result?.response_text,
                    confidence: result?.confidence
                };
            } catch (error) {
                this.log('SPEECH INPUT ERROR', { error: error.message, stack: error.stack });
                throw error;
            }
        });

        // Handle menu requests
        ipcMain.handle('menu-request', async (event, request) => {
            this.log('MENU REQUEST RECEIVED', request);
            try {
                const result = await this.orchestrator.handleMenuRequest(request);
                this.log('MENU REQUEST RESULT', result);
                return result;
            } catch (error) {
                this.log('MENU REQUEST ERROR', { error: error.message, stack: error.stack });
                throw error;
            }
        });

        // Set up orchestrator event forwarding to renderer with debugging
        this.setupEventForwarding();
    }

    setupEventForwarding() {
        if (!this.orchestrator) return;

        // Forward UI update events with debugging
        this.orchestrator.on('ui-update', (update) => {
            this.log('FORWARDING UI UPDATE TO RENDERER', update);
            if (this.mainWindow) {
                this.mainWindow.webContents.send('ui-update', update);
            }
        });

        // Forward other events
        this.orchestrator.on('python-service-status', (status) => {
            if (this.mainWindow) {
                this.mainWindow.webContents.send('python-service-status', status);
            }
        });

        this.orchestrator.on('raw-transcript', (data) => {
            if (this.mainWindow) {
                this.mainWindow.webContents.send('raw-transcript', data);
            }
        });

        this.orchestrator.on('processed-interaction', (data) => {
            if (this.mainWindow) {
                this.mainWindow.webContents.send('processed-interaction', data);
            }
        });
    }

    async testTTSDirectly() {
        this.log('Testing TTS directly...');
        
        try {
            if (this.orchestrator.components.speechOutput) {
                const testText = "This is a test of the text-to-speech system.";
                this.log('Attempting to speak test text', { text: testText });
                
                await this.orchestrator.components.speechOutput.speak(testText);
                this.log('TTS test completed successfully');
            } else {
                this.log('Speech output component not available');
            }
        } catch (error) {
            this.log('TTS test failed', { error: error.message, stack: error.stack });
        }
    }

    async testUIUpdate() {
        this.log('Testing UI update...');
        
        try {
            // Simulate a show_menu action
            const testAction = {
                type: 'show_menu',
                data: { view: 'categories' }
            };
            
            this.log('Executing test action', testAction);
            await this.orchestrator.executeActions([testAction]);
            this.log('UI update test completed');
        } catch (error) {
            this.log('UI update test failed', { error: error.message, stack: error.stack });
        }
    }

    printDebugSummary() {
        console.log('\n=== DEBUG SUMMARY ===');
        console.log(`Total log entries: ${this.debugLog.length}`);
        
        const errorEntries = this.debugLog.filter(entry => 
            entry.message.includes('ERROR') || entry.message.includes('FAILED')
        );
        
        if (errorEntries.length > 0) {
            console.log('\n=== ERRORS FOUND ===');
            errorEntries.forEach(entry => {
                console.log(`${entry.timestamp}: ${entry.message}`);
                if (entry.data) {
                    console.log('  Data:', JSON.stringify(entry.data, null, 2));
                }
            });
        }

        const uiUpdateEntries = this.debugLog.filter(entry => 
            entry.message.includes('UI UPDATE')
        );
        
        if (uiUpdateEntries.length > 0) {
            console.log('\n=== UI UPDATE EVENTS ===');
            uiUpdateEntries.forEach(entry => {
                console.log(`${entry.timestamp}: ${entry.message}`);
                if (entry.data) {
                    console.log('  Data:', JSON.stringify(entry.data, null, 2));
                }
            });
        }

        const ttsEntries = this.debugLog.filter(entry => 
            entry.message.includes('SPEECH') || entry.message.includes('TTS')
        );
        
        if (ttsEntries.length > 0) {
            console.log('\n=== TTS/SPEECH EVENTS ===');
            ttsEntries.forEach(entry => {
                console.log(`${entry.timestamp}: ${entry.message}`);
                if (entry.data) {
                    console.log('  Data:', JSON.stringify(entry.data, null, 2));
                }
            });
        }
    }
}

// Application lifecycle
const debugApp = new DebugApplication();

app.whenReady().then(async () => {
    console.log('🔍 Starting debug application...');
    
    await debugApp.initialize();
    debugApp.createWindow();

    // Run tests after a short delay
    setTimeout(async () => {
        await debugApp.testTTSDirectly();
        await debugApp.testUIUpdate();
        
        // Print summary after tests
        setTimeout(() => {
            debugApp.printDebugSummary();
        }, 2000);
    }, 3000);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            debugApp.createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', async () => {
    if (debugApp.orchestrator) {
        await debugApp.orchestrator.shutdown();
    }
});