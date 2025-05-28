const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;
const fetch = require('node-fetch');

/**
 * Speech Input Module - Backend STT integration for Electron main process
 * Now integrates with Python speech service via HTTP API
 */
class SpeechInput extends EventEmitter {
    constructor() {
        super();
        this.isInitialized = false;
        this.isListening = false;
        this.mainWindow = null;
        this.config = null;
        this.serviceAvailable = false;
        this.healthCheckInterval = null;
        this.lastHealthCheck = 0;
        this.serviceDownSince = null;
    }

    async initialize(mainWindow = null) {
        console.log('Initializing Speech Input module with Python service integration...');
        
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
            console.log('Speech Input module initialized successfully');
            console.log(`Python service available: ${this.serviceAvailable}`);
            
        } catch (error) {
            console.error('Failed to initialize Speech Input module:', error);
            throw error;
        }
    }

    async loadConfiguration() {
        try {
            const configPath = path.join(__dirname, '../../config/speech_service_config.json');
            const configData = await fs.readFile(configPath, 'utf8');
            this.config = JSON.parse(configData);
            console.log('Speech service configuration loaded for SpeechInput');
        } catch (error) {
            console.warn('Failed to load speech service config for SpeechInput, using defaults:', error);
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
                    stt: '/api/v1/speech/transcribe'
                }
            },
            stt: {
                language: 'auto',
                confidenceThreshold: 0.7
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
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout for health check
            
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
                    console.log('Python speech service (STT) is back online');
                    this.serviceDownSince = null;
                    this.emit('service-restored');
                }
            } else {
                this.serviceAvailable = false;
            }
        } catch (error) {
            console.warn('Python speech service (STT) health check failed:', error.message);
            this.serviceAvailable = false;
            
            if (!this.serviceDownSince) {
                this.serviceDownSince = Date.now();
                console.warn('Python speech service (STT) appears to be down');
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
        
        // Handle speech recognition requests from renderer
        ipcMain.handle('speech-start-listening', async () => {
            return await this.startListening();
        });
        
        ipcMain.handle('speech-stop-listening', () => {
            this.stopListening();
            return { success: true };
        });
        
        // Handle speech recognition results from renderer (for fallback mode or direct service calls)
        ipcMain.on('speech-recognition-result', (event, data) => {
            this.handleSpeechResult(data);
        });
        
        // Handle speech recognition errors from renderer
        ipcMain.on('speech-recognition-error', (event, error) => {
            this.handleSpeechError(error);
        });
        
        // Handle speech recognition status updates from renderer
        ipcMain.on('speech-recognition-status', (event, status) => {
            this.isListening = status.listening;
            // Optionally, update other statuses if provided
        });
        
        // Handle service health requests from renderer
        ipcMain.handle('speech-service-health', async () => {
            return {
                available: this.serviceAvailable,
                lastCheck: this.lastHealthCheck,
                downSince: this.serviceDownSince
            };
        });
    }

    async startListening() {
        if (!this.isInitialized) {
            throw new Error('Speech Input module not initialized');
        }

        if (this.isListening) {
            console.log('Already listening for speech input');
            return { success: true, message: 'Already listening' };
        }

        try {
            // Ensure service health is current
            if (!this.serviceAvailable) {
                await this.checkServiceHealth();
            }
            
            // Determine which method to use (service or fallback)
            const usePythonService = this.serviceAvailable;
            const useFallback = !this.serviceAvailable && this.config.fallback.enableWebSpeechAPI;

            if (usePythonService) {
                if (this.mainWindow) {
                    this.mainWindow.webContents.send('start-python-speech-recognition');
                } else {
                    throw new Error('No main window available for Python service speech recognition');
                }
            } else if (useFallback) {
                console.log('Python service unavailable, using Web Speech API fallback for STT');
                if (this.mainWindow) {
                    this.mainWindow.webContents.send('start-fallback-speech-recognition');
                } else {
                    throw new Error('No main window available for fallback speech recognition');
                }
            } else {
                throw new Error('No speech recognition service available (Python service down, fallback disabled)');
            }
            
            this.isListening = true; // This will be updated by 'speech-recognition-status' from renderer
            console.log(`Speech recognition initiated (Service: ${usePythonService}, Fallback: ${useFallback})`);
            
            return { 
                success: true, 
                usingService: usePythonService,
                usingFallback: useFallback
            };
            
        } catch (error) {
            console.error('Failed to start speech recognition:', error);
            this.emit('speech-error', {
                error: error.message || error,
                timestamp: Date.now()
            });
            throw error;
        }
    }

    stopListening() {
        if (!this.isListening && this.mainWindow) { // Check if already stopped or no window
             // If not listening, but command received, ensure renderer is also stopped
            this.mainWindow.webContents.send('stop-speech-recognition');
            return;
        }
        if (!this.mainWindow) {
            console.warn('No main window to send stop-speech-recognition command.');
            this.isListening = false; // Manually set if no window
            return;
        }


        try {
            this.mainWindow.webContents.send('stop-speech-recognition');
            // isListening will be updated by 'speech-recognition-status' from renderer
            console.log('Stop speech recognition command sent to renderer');
            
        } catch (error) {
            console.error('Failed to send stop speech recognition command:', error);
            this.isListening = false; // Force stop on error
        }
    }

    handleSpeechResult(data) {
        console.log('🔍 DEBUG: handleSpeechResult called in main process with data:', JSON.stringify(data));
        console.log('Speech recognition result received in main process:', data.transcript || data.text);
        
        const confidence = data.confidence || (this.config.stt.confidenceThreshold + 0.01); // Default if not provided
        if (confidence < this.config.stt.confidenceThreshold) {
            console.warn(`Low confidence speech result (${confidence}), ignoring.`);
            this.emit('low-confidence-speech', {
                text: data.transcript || data.text,
                confidence: confidence,
                timestamp: Date.now()
            });
            return;
        }
        
        this.emit('speech-recognized', {
            text: data.transcript || data.text,
            confidence: confidence,
            timestamp: Date.now(),
            source: data.source || (this.serviceAvailable ? 'python-service' : 'web-speech-api')
        });
    }

    handleSpeechError(error) {
        console.error('Speech recognition error received in main process:', error);
        this.isListening = false; // Ensure listening state is reset
        
        this.emit('speech-error', {
            error: error.message || error.error || error, // Handle different error structures
            timestamp: Date.now(),
            source: error.source || 'unknown'
        });
        
        // If it's a service-related error, re-check health
        if (error.source === 'python-service' || (typeof error === 'string' && error.toLowerCase().includes('service'))) {
            console.log('Service-related error detected, re-checking health...');
            this.checkServiceHealth();
        }
    }

    getStatus() {
        return {
            initialized: this.isInitialized,
            listening: this.isListening,
            serviceAvailable: this.serviceAvailable,
            hasMainWindow: !!this.mainWindow,
            lastHealthCheck: this.lastHealthCheck,
            serviceDownSince: this.serviceDownSince,
            config: {
                serviceUrl: this.config?.service?.baseUrl,
                sttEndpoint: this.config?.service?.endpoints?.stt,
                confidenceThreshold: this.config?.stt?.confidenceThreshold,
                fallbackEnabled: this.config?.fallback?.enableWebSpeechAPI
            }
        };
    }

    async updateConfiguration(newConfig) {
        try {
            // Deep merge for nested objects like 'service' or 'stt'
            this.config = { 
                ...this.config, 
                ...newConfig,
                service: { ...this.config.service, ...newConfig.service },
                stt: { ...this.config.stt, ...newConfig.stt },
                monitoring: { ...this.config.monitoring, ...newConfig.monitoring },
                fallback: { ...this.config.fallback, ...newConfig.fallback }
            };
            
            if (newConfig.monitoring?.healthCheckInterval && 
                newConfig.monitoring.healthCheckInterval !== this.config.monitoring.healthCheckInterval) {
                this.startHealthMonitoring(); // Restart with new interval
            }
            
            console.log('Speech Input configuration updated');
            return { success: true };
            
        } catch (error) {
            console.error('Failed to update Speech Input configuration:', error);
            return { success: false, error: error.message };
        }
    }

    async shutdown() {
        console.log('Shutting down Speech Input module...');
        
        try {
            this.stopListening();
            
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
                this.healthCheckInterval = null;
            }
            
            if (this.mainWindow) {
                const { ipcMain } = require('electron');
                ipcMain.removeHandler('speech-start-listening');
                ipcMain.removeHandler('speech-stop-listening');
                ipcMain.removeHandler('speech-service-health');
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