const EventEmitter = require('events');

/**
 * Speech Input Module - Backend STT integration for Electron main process
 * Interfaces with the frontend speech_manager.js via IPC for actual speech recognition
 */
class SpeechInput extends EventEmitter {
    constructor() {
        super();
        this.isInitialized = false;
        this.isListening = false;
        this.mainWindow = null;
    }

    async initialize(mainWindow = null) {
        console.log('Initializing Speech Input module...');
        
        try {
            this.mainWindow = mainWindow;
            
            // Set up IPC communication with renderer process if mainWindow is available
            if (this.mainWindow) {
                this.setupIPCHandlers();
            }
            
            this.isInitialized = true;
            console.log('Speech Input module initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Speech Input module:', error);
            throw error;
        }
    }

    setupIPCHandlers() {
        const { ipcMain } = require('electron');
        
        // Handle speech recognition results from renderer
        ipcMain.on('speech-recognition-result', (event, data) => {
            this.handleSpeechResult(data);
        });
        
        // Handle speech recognition errors from renderer
        ipcMain.on('speech-recognition-error', (event, error) => {
            this.handleSpeechError(error);
        });
        
        // Handle speech recognition status updates
        ipcMain.on('speech-recognition-status', (event, status) => {
            this.isListening = status.listening;
        });
    }

    async startListening() {
        if (!this.isInitialized) {
            throw new Error('Speech Input module not initialized');
        }

        if (this.isListening) {
            console.log('Already listening for speech input');
            return;
        }

        try {
            // Send command to renderer process to start speech recognition
            if (this.mainWindow) {
                this.mainWindow.webContents.send('start-speech-recognition');
            } else {
                // Fallback: simulate speech input for testing
                console.warn('No main window available, using fallback mode');
                setTimeout(() => {
                    this.handleSpeechResult({
                        transcript: 'test speech input',
                        confidence: 0.9
                    });
                }, 1000);
            }
            
            this.isListening = true;
            console.log('Speech recognition started');
            
        } catch (error) {
            console.error('Failed to start speech recognition:', error);
            throw error;
        }
    }

    stopListening() {
        if (!this.isListening) {
            return;
        }

        try {
            // Send command to renderer process to stop speech recognition
            if (this.mainWindow) {
                this.mainWindow.webContents.send('stop-speech-recognition');
            }
            
            this.isListening = false;
            console.log('Speech recognition stopped');
            
        } catch (error) {
            console.error('Failed to stop speech recognition:', error);
        }
    }

    handleSpeechResult(data) {
        console.log('Speech recognition result:', data.transcript);
        
        // Emit event for system orchestrator
        this.emit('speech-recognized', {
            text: data.transcript,
            confidence: data.confidence || 0.8,
            timestamp: Date.now()
        });
    }

    handleSpeechError(error) {
        console.error('Speech recognition error:', error);
        this.isListening = false;
        
        // Emit error event
        this.emit('speech-error', {
            error: error.message || error,
            timestamp: Date.now()
        });
    }

    getStatus() {
        return {
            initialized: this.isInitialized,
            listening: this.isListening,
            hasMainWindow: !!this.mainWindow
        };
    }

    async shutdown() {
        console.log('Shutting down Speech Input module...');
        
        try {
            this.stopListening();
            
            // Clean up IPC handlers
            if (this.mainWindow) {
                const { ipcMain } = require('electron');
                ipcMain.removeAllListeners('speech-recognition-result');
                ipcMain.removeAllListeners('speech-recognition-error');
                ipcMain.removeAllListeners('speech-recognition-status');
            }
            
            this.isInitialized = false;
            this.mainWindow = null;
            
            console.log('Speech Input module shut down successfully');
            
        } catch (error) {
            console.error('Error during Speech Input shutdown:', error);
        }
    }
}

module.exports = SpeechInput;