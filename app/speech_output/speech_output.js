const EventEmitter = require('events');

/**
 * Speech Output Module - Backend TTS integration for Electron main process
 * Interfaces with the frontend speech_manager.js via IPC for actual text-to-speech
 */
class SpeechOutput extends EventEmitter {
    constructor() {
        super();
        this.isInitialized = false;
        this.isSpeaking = false;
        this.mainWindow = null;
        this.speechQueue = [];
        this.currentSpeech = null;
    }

    async initialize(mainWindow = null) {
        console.log('Initializing Speech Output module...');
        
        try {
            this.mainWindow = mainWindow;
            
            // Set up IPC communication with renderer process if mainWindow is available
            if (this.mainWindow) {
                this.setupIPCHandlers();
            }
            
            this.isInitialized = true;
            console.log('Speech Output module initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Speech Output module:', error);
            throw error;
        }
    }

    setupIPCHandlers() {
        const { ipcMain } = require('electron');
        
        // Handle speech synthesis completion from renderer
        ipcMain.on('speech-synthesis-complete', (event, data) => {
            this.handleSpeechComplete(data);
        });
        
        // Handle speech synthesis errors from renderer
        ipcMain.on('speech-synthesis-error', (event, error) => {
            this.handleSpeechError(error);
        });
        
        // Handle speech synthesis status updates
        ipcMain.on('speech-synthesis-status', (event, status) => {
            this.isSpeaking = status.speaking;
        });
    }

    async speak(text, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Speech Output module not initialized');
        }

        if (!text || typeof text !== 'string') {
            console.warn('Invalid text provided for speech synthesis');
            return;
        }

        const speechRequest = {
            text: text.trim(),
            options: {
                rate: options.rate || 1.0,
                pitch: options.pitch || 1.0,
                volume: options.volume || 1.0,
                voice: options.voice || null
            },
            id: Date.now() + Math.random(),
            timestamp: Date.now()
        };

        try {
            // Add to queue if currently speaking
            if (this.isSpeaking) {
                this.speechQueue.push(speechRequest);
                console.log('Added speech to queue:', text.substring(0, 50) + '...');
                return;
            }

            await this.processSpeechRequest(speechRequest);
            
        } catch (error) {
            console.error('Failed to speak text:', error);
            this.emit('speech-error', {
                error: error.message || error,
                text: text,
                timestamp: Date.now()
            });
        }
    }

    async processSpeechRequest(speechRequest) {
        this.currentSpeech = speechRequest;
        this.isSpeaking = true;

        console.log('Speaking:', speechRequest.text.substring(0, 100) + '...');

        try {
            // Send command to renderer process for text-to-speech
            if (this.mainWindow) {
                this.mainWindow.webContents.send('speak-text', speechRequest);
            } else {
                // Fallback: simulate speech completion for testing
                console.warn('No main window available, using fallback mode');
                setTimeout(() => {
                    this.handleSpeechComplete({
                        id: speechRequest.id,
                        success: true
                    });
                }, 2000);
            }
            
        } catch (error) {
            this.handleSpeechError({
                error: error.message || error,
                id: speechRequest.id
            });
        }
    }

    stopSpeaking() {
        try {
            // Send command to renderer process to stop speech
            if (this.mainWindow) {
                this.mainWindow.webContents.send('stop-speech');
            }
            
            // Clear queue and reset state
            this.speechQueue = [];
            this.isSpeaking = false;
            this.currentSpeech = null;
            
            console.log('Speech synthesis stopped');
            
        } catch (error) {
            console.error('Failed to stop speech synthesis:', error);
        }
    }

    handleSpeechComplete(data) {
        console.log('Speech synthesis completed for ID:', data.id);
        
        this.isSpeaking = false;
        this.currentSpeech = null;
        
        // Emit completion event
        this.emit('speech-complete', {
            id: data.id,
            timestamp: Date.now()
        });
        
        // Process next item in queue
        this.processNextInQueue();
    }

    handleSpeechError(error) {
        console.error('Speech synthesis error:', error);
        
        this.isSpeaking = false;
        this.currentSpeech = null;
        
        // Emit error event
        this.emit('speech-error', {
            error: error.error || error.message || error,
            id: error.id,
            timestamp: Date.now()
        });
        
        // Process next item in queue
        this.processNextInQueue();
    }

    async processNextInQueue() {
        if (this.speechQueue.length > 0) {
            const nextSpeech = this.speechQueue.shift();
            console.log('Processing next speech from queue');
            await this.processSpeechRequest(nextSpeech);
        }
    }

    clearQueue() {
        this.speechQueue = [];
        console.log('Speech queue cleared');
    }

    getQueueLength() {
        return this.speechQueue.length;
    }

    getCurrentSpeech() {
        return this.currentSpeech;
    }

    getStatus() {
        return {
            initialized: this.isInitialized,
            speaking: this.isSpeaking,
            queueLength: this.speechQueue.length,
            hasMainWindow: !!this.mainWindow,
            currentSpeech: this.currentSpeech ? {
                text: this.currentSpeech.text.substring(0, 50) + '...',
                id: this.currentSpeech.id
            } : null
        };
    }

    async shutdown() {
        console.log('Shutting down Speech Output module...');
        
        try {
            this.stopSpeaking();
            this.clearQueue();
            
            // Clean up IPC handlers
            if (this.mainWindow) {
                const { ipcMain } = require('electron');
                ipcMain.removeAllListeners('speech-synthesis-complete');
                ipcMain.removeAllListeners('speech-synthesis-error');
                ipcMain.removeAllListeners('speech-synthesis-status');
            }
            
            this.isInitialized = false;
            this.mainWindow = null;
            
            console.log('Speech Output module shut down successfully');
            
        } catch (error) {
            console.error('Error during Speech Output shutdown:', error);
        }
    }
}

module.exports = SpeechOutput;