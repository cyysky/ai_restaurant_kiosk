const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;
const fetch = require('node-fetch');

/**
 * Speech Output Module - Backend TTS integration for Electron main process
 * Now integrates with Python speech service via HTTP API
 */
class SpeechOutput extends EventEmitter {
    constructor() {
        super();
        this.isInitialized = false;
        this.isSpeaking = false;
        this.mainWindow = null;
        this.speechQueue = [];
        this.currentSpeech = null;
        this.config = null;
        this.serviceAvailable = false;
        this.healthCheckInterval = null;
        this.lastHealthCheck = 0;
        this.serviceDownSince = null;
    }

    async initialize(mainWindow = null) {
        console.log('Initializing Speech Output module with Python service integration...');
        
        try {
            this.mainWindow = mainWindow;
            
            // Load configuration
            await this.loadConfiguration();
            
            // Check Python service health
            await this.checkServiceHealth();
            
            // Set up IPC communication with renderer process if mainWindow is available
            if (this.mainWindow) {
                this.setupIPCHandlers();
            }
            
            // Start health monitoring
            this.startHealthMonitoring();
            
            this.isInitialized = true;
            console.log('Speech Output module initialized successfully');
            console.log(`Python service available for TTS: ${this.serviceAvailable}`);
            
        } catch (error) {
            console.error('Failed to initialize Speech Output module:', error);
            throw error;
        }
    }

    async loadConfiguration() {
        try {
            const configPath = path.join(__dirname, '../../config/speech_service_config.json');
            const configData = await fs.readFile(configPath, 'utf8');
            this.config = JSON.parse(configData);
            console.log('Speech service configuration loaded for SpeechOutput');
        } catch (error) {
            console.warn('Failed to load speech service config for SpeechOutput, using defaults:', error);
            this.config = this.getDefaultConfig();
        }
    }

    getDefaultConfig() {
        return {
            service: {
                baseUrl: 'http://127.0.0.1:8000',
                timeout: 30000,
                retryAttempts: 3,
                retryDelay: 1000,
                endpoints: { // Added endpoints for clarity
                    health: '/api/v1/health',
                    tts: '/api/v1/speech/synthesize',
                    voices: '/api/v1/speech/voices'
                }
            },
            tts: {
                defaultVoice: 'af_heart',
                speed: 1.0,
                pitch: 1.0,
                volume: 1.0,
                availableVoices: ["af_heart"]
            },
            monitoring: {
                healthCheckInterval: 30000
            },
            fallback: {
                enableWebSpeechAPI: true,
                fallbackOnServiceError: true
            }
        };
    }

    async checkServiceHealth() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const healthEndpoint = this.config.service.endpoints.health || '/api/v1/health';
            const response = await fetch(`${this.config.service.baseUrl}${healthEndpoint}`, {
                signal: controller.signal,
                method: 'GET'
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const health = await response.json();
                this.serviceAvailable = health.status === 'healthy';
                this.lastHealthCheck = Date.now();
                
                if (this.serviceDownSince && this.serviceAvailable) {
                    console.log('Python speech service (TTS) is back online');
                    this.serviceDownSince = null;
                    this.emit('service-restored');
                }
            } else {
                this.serviceAvailable = false;
            }
        } catch (error) {
            console.warn('Python speech service (TTS) health check failed:', error.message);
            this.serviceAvailable = false;
            
            if (!this.serviceDownSince) {
                this.serviceDownSince = Date.now();
                console.warn('Python speech service (TTS) appears to be down');
                this.emit('service-down', { error: error.message, timestamp: Date.now() });
            }
        }
        
        return this.serviceAvailable;
    }

    startHealthMonitoring() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        
        this.healthCheckInterval = setInterval(async () => {
            await this.checkServiceHealth();
        }, this.config.monitoring.healthCheckInterval);
    }

    setupIPCHandlers() {
        const { ipcMain } = require('electron');
        
        // Handle speech synthesis requests from renderer
        ipcMain.handle('speech-speak-text', async (event, data) => {
            return await this.speak(data.text, data.options);
        });
        
        ipcMain.handle('speech-stop-speaking', () => {
            this.stopSpeaking();
            return { success: true };
        });

        ipcMain.handle('speech-get-voices', async () => {
            return await this.getAvailableVoices();
        });

        ipcMain.handle('speech-set-voice', (event, voiceId) => {
            this.setVoice(voiceId);
            return { success: true };
        });
        
        // Handle speech synthesis completion/error from renderer (for fallback mode)
        ipcMain.on('speech-synthesis-complete', (event, data) => {
            this.handleSpeechComplete(data);
        });
        
        ipcMain.on('speech-synthesis-error', (event, error) => {
            this.handleSpeechError(error);
        });
        
        // Handle speech synthesis status updates from renderer
        ipcMain.on('speech-synthesis-status', (event, status) => {
            this.isSpeaking = status.speaking;
            if (!status.speaking) { // If renderer reports speaking stopped, process queue
                this.processNextInQueue();
            }
        });
    }

    async speak(text, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Speech Output module not initialized');
        }

        if (!text || typeof text !== 'string') {
            console.warn('Invalid text provided for speech synthesis');
            return { success: false, message: 'Invalid text' };
        }

        const speechRequest = {
            text: text.trim(),
            options: {
                voice: options.voice || this.config.tts.defaultVoice,
                speed: options.speed || this.config.tts.speed,
                pitch: options.pitch || this.config.tts.pitch,
                volume: options.volume || this.config.tts.volume
            },
            id: Date.now() + Math.random().toString(36).substring(2), // More unique ID
            timestamp: Date.now()
        };

        try {
            if (this.isSpeaking) {
                this.speechQueue.push(speechRequest);
                console.log('Added speech to queue:', text.substring(0, 50) + '...');
                return { success: true, message: 'Queued', id: speechRequest.id };
            }

            await this.processSpeechRequest(speechRequest);
            return { success: true, message: 'Speaking', id: speechRequest.id };
            
        } catch (error) {
            console.error('Failed to speak text:', error);
            this.emit('speech-error', {
                error: error.message || error,
                text: text,
                id: speechRequest.id,
                timestamp: Date.now()
            });
            // Attempt to process next in queue even on error
            this.isSpeaking = false; 
            this.currentSpeech = null;
            this.processNextInQueue();
            throw error; // Re-throw for the caller
        }
    }

    async processSpeechRequest(speechRequest) {
        this.currentSpeech = speechRequest;
        this.isSpeaking = true;

        console.log('Speaking:', speechRequest.text.substring(0, 100) + '...');
        this.emit('speech-start', { text: speechRequest.text, id: speechRequest.id });

        try {
            // Ensure service health is current
            if (!this.serviceAvailable) {
                await this.checkServiceHealth();
            }

            const usePythonService = this.serviceAvailable;
            const useFallback = !this.serviceAvailable && this.config.fallback.enableWebSpeechAPI;

            if (usePythonService) {
                if (this.mainWindow) {
                    // Send to renderer to handle audio playback
                    this.mainWindow.webContents.send('speak-text-python-service', speechRequest);
                } else {
                    throw new Error('No main window available for Python service TTS');
                }
            } else if (useFallback) {
                console.log('Python service unavailable, using Web Speech API fallback for TTS');
                if (this.mainWindow) {
                    this.mainWindow.webContents.send('speak-text-fallback', speechRequest);
                } else {
                    throw new Error('No main window available for fallback TTS');
                }
            } else {
                throw new Error('No speech synthesis service available (Python service down, fallback disabled)');
            }
            
        } catch (error) {
            this.handleSpeechError({ // Centralized error handling for processSpeechRequest
                error: error.message || error,
                id: speechRequest.id,
                source: error.source || 'process-request'
            });
        }
    }

    stopSpeaking() {
        try {
            if (this.mainWindow) {
                this.mainWindow.webContents.send('stop-speech');
            }
            
            this.speechQueue = []; // Clear queue
            this.isSpeaking = false;
            this.currentSpeech = null;
            
            console.log('Speech synthesis stop command sent, queue cleared');
            this.emit('speech-stopped');
            
        } catch (error) {
            console.error('Failed to stop speech synthesis:', error);
        }
    }

    handleSpeechComplete(data) {
        // Ensure this is for the current speech or a queued item
        if (this.currentSpeech && this.currentSpeech.id === data.id) {
            console.log('Speech synthesis completed for ID:', data.id);
            this.emit('speech-complete', { id: data.id, timestamp: Date.now() });
            
            this.isSpeaking = false;
            this.currentSpeech = null;
            this.processNextInQueue();
        } else {
            console.warn(`Received completion for unknown or old speech ID: ${data.id}`);
        }
    }

    handleSpeechError(errorData) {
        console.error('Speech synthesis error in main process:', errorData.error || errorData);
        
        const speechId = errorData.id || this.currentSpeech?.id;

        this.emit('speech-error', {
            error: errorData.error || errorData.message || errorData,
            id: speechId,
            text: this.currentSpeech?.text,
            timestamp: Date.now(),
            source: errorData.source || 'unknown'
        });
        
        // If it's a service-related error, re-check health
        if (errorData.source === 'python-service' || 
            (typeof errorData.error === 'string' && errorData.error.toLowerCase().includes('service'))) {
            console.log('TTS Service-related error detected, re-checking health...');
            this.checkServiceHealth().then(isUp => {
                if (isUp && this.currentSpeech && this.config.fallback.fallbackOnServiceError) {
                    // If service is now up, but we were trying to use it, don't immediately fallback.
                    // The next item in queue will try the service.
                } else if (!isUp && this.currentSpeech && this.config.fallback.fallbackOnServiceError) {
                    // If service is still down, and we were trying to use it, and fallback is enabled,
                    // we could potentially retry the current item with fallback.
                    // For now, just proceed to next in queue.
                    console.warn("Service still down. Fallback might be used for next item if enabled.");
                }
            });
        }

        // Reset speaking state and process next item
        if (this.currentSpeech && speechId === this.currentSpeech.id) {
            this.isSpeaking = false;
            this.currentSpeech = null;
            this.processNextInQueue();
        } else if (!this.isSpeaking && this.speechQueue.length > 0) {
            // If not currently speaking but queue has items, try processing (e.g. initial error)
            this.processNextInQueue();
        }
    }

    async processNextInQueue() {
        if (this.isSpeaking) return; // Already processing something
        if (this.speechQueue.length > 0) {
            const nextSpeech = this.speechQueue.shift();
            console.log('Processing next speech from queue:', nextSpeech.text.substring(0,30) + "...");
            await this.processSpeechRequest(nextSpeech);
        } else {
            this.isSpeaking = false; // Ensure state is correct if queue is empty
            this.currentSpeech = null;
        }
    }

    async getAvailableVoices() {
        try {
            if (!this.serviceAvailable) await this.checkServiceHealth();

            if (this.serviceAvailable) {
                const voicesEndpoint = this.config.service.endpoints.voices || '/api/v1/speech/voices';
                const response = await fetch(`${this.config.service.baseUrl}${voicesEndpoint}`);
                if (response.ok) {
                    const data = await response.json();
                    // Ensure data.voices is an array, default to config if not
                    return Array.isArray(data.voices) ? data.voices : (this.config.tts.availableVoices || []);
                } else {
                     console.warn(`Failed to fetch voices from service, status: ${response.status}`);
                }
            }
            
            // Fallback to Web Speech API voices if service fails or not available
            if (this.config.fallback.enableWebSpeechAPI && this.mainWindow) {
                console.log('Fetching voices via Web Speech API fallback');
                // This needs to be done in renderer, ask renderer to get them
                return await this.mainWindow.webContents.invoke('get-fallback-voices');
            }
            
            return this.config.tts.availableVoices || []; // Default from config
            
        } catch (error) {
            console.error('Error getting available voices:', error);
            return this.config.tts.availableVoices || [];
        }
    }

    setVoice(voiceId) {
        this.config.tts.defaultVoice = voiceId; // Update default for Python service
        
        // If using fallback, tell renderer to update its current voice
        if (this.mainWindow && !this.serviceAvailable && this.config.fallback.enableWebSpeechAPI) {
            this.mainWindow.webContents.send('set-fallback-voice', voiceId);
        }
        console.log('Default voice set to:', voiceId);
    }

    clearQueue() {
        this.speechQueue = [];
        console.log('Speech queue cleared');
    }

    getStatus() {
        return {
            initialized: this.isInitialized,
            speaking: this.isSpeaking,
            queueLength: this.speechQueue.length,
            serviceAvailable: this.serviceAvailable,
            hasMainWindow: !!this.mainWindow,
            currentSpeech: this.currentSpeech ? {
                text: this.currentSpeech.text.substring(0, 50) + '...',
                id: this.currentSpeech.id
            } : null,
            lastHealthCheck: this.lastHealthCheck,
            serviceDownSince: this.serviceDownSince,
            config: {
                serviceUrl: this.config?.service?.baseUrl,
                ttsEndpoint: this.config?.service?.endpoints?.tts,
                voicesEndpoint: this.config?.service?.endpoints?.voices,
                defaultVoice: this.config?.tts?.defaultVoice,
                fallbackEnabled: this.config?.fallback?.enableWebSpeechAPI
            }
        };
    }

    async updateConfiguration(newConfig) {
        try {
            this.config = { 
                ...this.config, 
                ...newConfig,
                service: { ...this.config.service, ...newConfig.service },
                tts: { ...this.config.tts, ...newConfig.tts },
                monitoring: { ...this.config.monitoring, ...newConfig.monitoring },
                fallback: { ...this.config.fallback, ...newConfig.fallback }
            };
            
            if (newConfig.monitoring?.healthCheckInterval &&
                newConfig.monitoring.healthCheckInterval !== this.config.monitoring.healthCheckInterval) {
                this.startHealthMonitoring();
            }
            
            console.log('Speech Output configuration updated');
            return { success: true };
            
        } catch (error) {
            console.error('Failed to update Speech Output configuration:', error);
            return { success: false, error: error.message };
        }
    }

    async shutdown() {
        console.log('Shutting down Speech Output module...');
        
        try {
            this.stopSpeaking(); // This also clears the queue
            
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
                this.healthCheckInterval = null;
            }
            
            if (this.mainWindow) {
                const { ipcMain } = require('electron');
                ipcMain.removeHandler('speech-speak-text');
                ipcMain.removeHandler('speech-stop-speaking');
                ipcMain.removeHandler('speech-get-voices');
                ipcMain.removeHandler('speech-set-voice');
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