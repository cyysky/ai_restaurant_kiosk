// Speech Manager - Handles speech recognition and synthesis with Python service integration
class SpeechManager {
    constructor(app) {
        this.app = app;
        this.isListening = false;
        this.isSpeaking = false;
        this.isSupported = false;
        this.serviceAvailable = false;
        this.config = null;
        
        // Web Audio API components
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.audioContext = null;
        this.stream = null;
        
        // Service monitoring
        this.healthCheckInterval = null;
        this.lastHealthCheck = 0;
        this.serviceDownSince = null;
        
        // Fallback Web Speech API
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.currentVoice = null;
        
        // Audio processing
        this.recordingTimeout = null;
        this.silenceDetectionTimeout = null;
        
        // DEBUG: Resource tracking
        this.debugInfo = {
            audioContextCount: 0,
            mediaRecorderCount: 0,
            streamCount: 0,
            activeTimeouts: new Set(),
            activeIntervals: new Set(),
            memorySnapshots: [],
            errorHistory: []
        };
        
        // DEBUG: Add global error handler for unhandled exceptions
        this.setupGlobalErrorHandlers();
    }
    
    setupGlobalErrorHandlers() {
        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('🚨 UNHANDLED PROMISE REJECTION in SpeechManager context:', event.reason);
            this.logError('unhandled_promise_rejection', event.reason);
            this.logResourceState('unhandled_rejection');
        });
        
        // Capture general errors
        window.addEventListener('error', (event) => {
            if (event.filename && event.filename.includes('speech_manager')) {
                console.error('🚨 UNHANDLED ERROR in SpeechManager:', event.error);
                this.logError('unhandled_error', event.error);
                this.logResourceState('unhandled_error');
            }
        });
    }
    
    logError(type, error) {
        const errorEntry = {
            type,
            error: error?.message || error,
            stack: error?.stack,
            timestamp: Date.now(),
            state: {
                isListening: this.isListening,
                isSpeaking: this.isSpeaking,
                hasAudioContext: !!this.audioContext,
                hasMediaRecorder: !!this.mediaRecorder,
                hasStream: !!this.stream
            }
        };
        
        this.debugInfo.errorHistory.push(errorEntry);
        
        // Keep only last 10 errors
        if (this.debugInfo.errorHistory.length > 10) {
            this.debugInfo.errorHistory.shift();
        }
        
        console.error('🔍 ERROR LOGGED:', errorEntry);
    }
    
    logResourceState(context) {
        const memoryInfo = performance.memory ? {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        } : null;
        
        const resourceState = {
            context,
            timestamp: Date.now(),
            audioContextCount: this.debugInfo.audioContextCount,
            mediaRecorderCount: this.debugInfo.mediaRecorderCount,
            streamCount: this.debugInfo.streamCount,
            activeTimeouts: this.debugInfo.activeTimeouts.size,
            activeIntervals: this.debugInfo.activeIntervals.size,
            audioContextState: this.audioContext?.state,
            mediaRecorderState: this.mediaRecorder?.state,
            streamActive: this.stream?.active,
            memory: memoryInfo
        };
        
        this.debugInfo.memorySnapshots.push(resourceState);
        
        // Keep only last 20 snapshots
        if (this.debugInfo.memorySnapshots.length > 20) {
            this.debugInfo.memorySnapshots.shift();
        }
        
        console.log('🔍 RESOURCE STATE:', resourceState);
        
        // Warn about potential memory leaks
        if (memoryInfo && memoryInfo.usedJSHeapSize > 50 * 1024 * 1024) { // 50MB
            console.warn('⚠️ HIGH MEMORY USAGE detected:', memoryInfo.usedJSHeapSize / 1024 / 1024, 'MB');
        }
        
        if (this.debugInfo.audioContextCount > 1) {
            console.warn('⚠️ MULTIPLE AUDIO CONTEXTS detected:', this.debugInfo.audioContextCount);
        }
    }

    async init() {
        // Set up IPC communication with main process
        this.setupIPCHandlers();
        
        console.log('Initializing Speech Manager with Python service integration...');
        
        try {
            // Load configuration
            await this.loadConfiguration();
            
            // Check for basic audio support
            this.isSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
            
            if (!this.isSupported) {
                console.warn('Media devices not supported in this browser');
                return;
            }

            // Initialize audio context
            await this.initializeAudioContext();
            
            // Check Python service availability
            await this.checkServiceHealth();
            
            // Initialize fallback if needed
            if (!this.serviceAvailable && this.config.fallback.enableWebSpeechAPI) {
                await this.initializeFallback();
            }
            
            // Start health monitoring
            this.startHealthMonitoring();
            
            console.log('Speech Manager initialized successfully');
            console.log(`Service available: ${this.serviceAvailable}, Fallback ready: ${!!this.recognition}`);
            
        } catch (error) {
            console.error('Failed to initialize Speech Manager:', error);
            this.isSupported = false;
        }
    }

    async loadConfiguration() {
        try {
            console.log('Attempting to load config from: ./config/speech_service_config.json');
            console.log('Current location:', window.location.href);
            const response = await fetch('../../config/speech_service_config.json');
            console.log('Config fetch response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            this.config = await response.json();
            console.log('Speech service configuration loaded successfully:', this.config);
        } catch (error) {
            console.warn('Failed to load speech service config, using defaults:', error);
            console.log('Error details:', error.message);
            this.config = this.getDefaultConfig();
            console.log('Using default config:', this.config);
        }
    }

    getDefaultConfig() {
        return {
            service: {
                baseUrl: 'http://127.0.0.1:8000',
                endpoints: {
                    health: '/api/v1/health',
                    stt: '/api/v1/speech/transcribe',
                    tts: '/api/v1/speech/synthesize',
                    voices: '/api/v1/speech/voices'
                },
                timeout: 30000,
                retryAttempts: 3
            },
            audio: {
                maxRecordingDuration: 30000,
                autoStopDelay: 3000
            },
            stt: {
                language: 'auto',
                confidenceThreshold: 0
            },
            tts: {
                defaultVoice: 'af_heart',
                speed: 1.0,
                pitch: 1.0
            },
            fallback: {
                enableWebSpeechAPI: true,
                webSpeechLanguage: 'en-US'
            },
            monitoring: {
                healthCheckInterval: 30000
            }
        };
    }

    async initializeAudioContext() {
        try {
            this.logResourceState('before_audio_context_init');
            
            // Only create AudioContext if one doesn't already exist
            if (!this.audioContext || this.audioContext.state === 'closed') {
                // DEBUG: Track old context if it exists
                if (this.audioContext && this.audioContext.state === 'closed') {
                    console.log('🔍 Replacing closed AudioContext');
                    this.debugInfo.audioContextCount--;
                }
                
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.debugInfo.audioContextCount++;
                
                console.log('🔍 Audio context initialized, total count:', this.debugInfo.audioContextCount);
                
                // DEBUG: Add state change listeners
                this.audioContext.addEventListener('statechange', () => {
                    console.log('🔍 AudioContext state changed to:', this.audioContext.state);
                    this.logResourceState('audio_context_state_change');
                });
                
            } else {
                console.log('🔍 Audio context already exists, reusing existing instance, state:', this.audioContext.state);
            }
            
            this.logResourceState('after_audio_context_init');
            
        } catch (error) {
            console.error('🚨 Failed to initialize audio context:', error);
            this.logError('audio_context_init_failed', error);
            throw error;
        }
    }

    async checkServiceHealth() {
        try {
            console.log('Checking service health at:', `${this.config.service.baseUrl}${this.config.service.endpoints.health}`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(`${this.config.service.baseUrl}${this.config.service.endpoints.health}`, {
                signal: controller.signal,
                method: 'GET'
            });
            
            clearTimeout(timeoutId);
            console.log('Health check response status:', response.status);
            
            if (response.ok) {
                const health = await response.json();
                console.log('Health check response data:', health);
                this.serviceAvailable = health.status === 'healthy';
                this.lastHealthCheck = Date.now();
                
                if (this.serviceDownSince && this.serviceAvailable) {
                    console.log('Python speech service is back online');
                    this.serviceDownSince = null;
                }
            } else {
                this.serviceAvailable = false;
                console.warn('Health check failed with status:', response.status);
            }
        } catch (error) {
            console.warn('Python speech service health check failed:', error.message);
            console.log('Full error object:', error);
            this.serviceAvailable = false;
            
            if (!this.serviceDownSince) {
                this.serviceDownSince = Date.now();
                console.warn('Python speech service appears to be down');
            }
        }
        
        console.log('Service available after health check:', this.serviceAvailable);
        return this.serviceAvailable;
    }

    async initializeFallback() {
        try {
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                this.recognition = new SpeechRecognition();
                
                this.recognition.continuous = false;
                this.recognition.interimResults = true;
                this.recognition.lang = this.config.fallback.webSpeechLanguage;
                this.recognition.maxAlternatives = 1;
                
                this.setupFallbackHandlers();
                
                // Initialize TTS voices
                await this.initializeTTSVoices();
                
                console.log('Web Speech API fallback initialized');
            }
        } catch (error) {
            console.error('Failed to initialize Web Speech API fallback:', error);
        }
    }

    setupFallbackHandlers() {
        this.recognition.onstart = () => {
            console.log('Fallback speech recognition started');
            this.isListening = true;
        };

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            if (interimTranscript) {
                this.updateUI(`Listening: ${interimTranscript}`);
            }

            if (finalTranscript) {
                this.handleRecognitionResult(finalTranscript.trim(), event.results[0][0].confidence || 0.8);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Fallback speech recognition error:', event.error);
            this.isListening = false;
            this.handleRecognitionError(new Error(`Speech recognition error: ${event.error}`));
        };

        this.recognition.onend = () => {
            console.log('Fallback speech recognition ended');
            this.isListening = false;
        };
    }

    async initializeTTSVoices() {
        return new Promise((resolve) => {
            const loadVoices = () => {
                const voices = this.synthesis.getVoices();
                
                if (voices.length > 0) {
                    this.currentVoice = voices.find(voice => 
                        voice.lang.startsWith('en') && voice.localService
                    ) || voices.find(voice => 
                        voice.lang.startsWith('en')
                    ) || voices[0];
                    
                    console.log('TTS voice selected:', this.currentVoice?.name);
                    resolve();
                } else {
                    setTimeout(loadVoices, 100);
                }
            };
            
            if (this.synthesis.getVoices().length > 0) {
                loadVoices();
            } else {
                this.synthesis.onvoiceschanged = loadVoices;
            }
        });
    }

    startHealthMonitoring() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.debugInfo.activeIntervals.delete(this.healthCheckInterval);
        }
        
        this.healthCheckInterval = setInterval(async () => {
            await this.checkServiceHealth();
        }, this.config.monitoring.healthCheckInterval);
        
        // Track interval for debugging
        this.debugInfo.activeIntervals.add(this.healthCheckInterval);
        console.log('🔍 Health monitoring started, active intervals:', this.debugInfo.activeIntervals.size);
    }

    async startListening() {
        if (this.isListening) {
            console.log('Already listening');
            return;
        }

        try {
            // Stop any ongoing speech synthesis
            this.stopSpeaking();
            
            // Try Python service first
            if (this.serviceAvailable) {
                await this.startPythonServiceListening();
            } else if (this.recognition && this.config.fallback.enableWebSpeechAPI) {
                await this.startFallbackListening();
            } else {
                throw new Error('No speech recognition service available');
            }
            
        } catch (error) {
            console.error('Failed to start speech recognition:', error);
            this.handleRecognitionError(error);
            throw error;
        }
    }

    async startPythonServiceListening() {
        try {
            this.logResourceState('before_start_listening');
            
            // Request microphone access
            console.log('🔍 Requesting microphone access...');
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: this.config.audio.sampleRate || 16000,
                    channelCount: this.config.audio.channels || 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            
            this.debugInfo.streamCount++;
            console.log('🔍 Microphone access granted, stream count:', this.debugInfo.streamCount);
            
            // Set up MediaRecorder with crash-safe format selection
            let options = { mimeType: 'audio/wav' };
            
            // CRASH FIX: Prefer formats that don't require complex decoding
            if (MediaRecorder.isTypeSupported('audio/wav')) {
                console.log('🔍 Using WAV format (no conversion needed)');
                options.mimeType = 'audio/wav';
            } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=pcm')) {
                console.log('🔍 Using WebM with PCM codec (safer than Opus)');
                options.mimeType = 'audio/webm;codecs=pcm';
            } else if (MediaRecorder.isTypeSupported('audio/webm')) {
                console.log('🔍 Using basic WebM format');
                options.mimeType = 'audio/webm';
            } else {
                console.warn('⚠️ No preferred audio formats supported, using default');
                options = {}; // Let browser choose
            }
            
            console.log('🔍 Creating MediaRecorder with options:', options);
            this.mediaRecorder = new MediaRecorder(this.stream, options);
            this.debugInfo.mediaRecorderCount++;
            this.audioChunks = [];
            
            console.log('🔍 MediaRecorder created, count:', this.debugInfo.mediaRecorderCount);
            
            this.mediaRecorder.ondataavailable = (event) => {
                try {
                    if (event.data.size > 0) {
                        this.audioChunks.push(event.data);
                        console.log('🔍 Audio chunk received, size:', event.data.size, 'total chunks:', this.audioChunks.length);
                    }
                } catch (error) {
                    console.error('🚨 Error in ondataavailable:', error);
                    this.logError('ondataavailable_error', error);
                }
            };
            
            this.mediaRecorder.onstop = async () => {
                try {
                    console.log('🔍 MediaRecorder stopped, processing audio...');
                    this.logResourceState('before_process_audio');
                    await this.processRecordedAudio();
                    this.logResourceState('after_process_audio');
                } catch (error) {
                    console.error('🚨 Error in onstop handler:', error);
                    this.logError('onstop_error', error);
                    this.handleRecognitionError(error);
                }
            };
            
            this.mediaRecorder.onerror = (event) => {
                console.error('🚨 MediaRecorder error:', event.error);
                this.logError('mediarecorder_error', event.error);
                this.logResourceState('mediarecorder_error');
                
                // Enhanced error handling with proper resource cleanup
                try {
                    console.log('🔍 Starting MediaRecorder error cleanup...');
                    
                    // Stop and clean up MediaRecorder
                    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                        this.mediaRecorder.stop();
                    }
                    this.mediaRecorder = null;
                    this.debugInfo.mediaRecorderCount = Math.max(0, this.debugInfo.mediaRecorderCount - 1);
                    
                    // Stop and clean up audio stream
                    if (this.stream) {
                        this.stream.getTracks().forEach(track => track.stop());
                        this.stream = null;
                        this.debugInfo.streamCount = Math.max(0, this.debugInfo.streamCount - 1);
                    }
                    
                    // Clear recording timeout
                    if (this.recordingTimeout) {
                        clearTimeout(this.recordingTimeout);
                        this.recordingTimeout = null;
                        this.debugInfo.activeTimeouts.delete(this.recordingTimeout);
                    }
                    
                    // Reset listening state
                    this.isListening = false;
                    
                    // Clear audio chunks
                    this.audioChunks = [];
                    
                    console.log('🔍 MediaRecorder error cleanup completed');
                    this.logResourceState('after_mediarecorder_cleanup');
                    
                } catch (cleanupError) {
                    console.error('🚨 Error during MediaRecorder error cleanup:', cleanupError);
                    this.logError('cleanup_error', cleanupError);
                }
                
                this.handleRecognitionError(event.error);
            };
            
            // Start recording
            this.mediaRecorder.start(100); // Collect data every 100ms
            this.isListening = true;
            
            // Send status update to main process
            if (typeof window !== 'undefined' && window.electronAPI) {
                window.electronAPI.sendSpeechRecognitionStatus({
                    listening: true
                });
            }
            
            this.updateUI('Listening...');
            
            // Set auto-stop timeout
            this.recordingTimeout = setTimeout(() => {
                if (this.isListening) {
                    console.log('🔍 Auto-stop timeout triggered');
                    this.stopListening();
                }
            }, this.config.audio.maxRecordingDuration);
            
            // Track timeout for debugging
            this.debugInfo.activeTimeouts.add(this.recordingTimeout);
            console.log('🔍 Recording timeout set, active timeouts:', this.debugInfo.activeTimeouts.size);
            
            console.log('Python service speech recognition started');
            
        } catch (error) {
            console.error('Failed to start Python service listening:', error);
            throw error;
        }
    }

    async startFallbackListening() {
        try {
            this.recognition.start();
            
            this.recordingTimeout = setTimeout(() => {
                if (this.isListening) {
                    this.stopListening();
                }
            }, this.config.audio.maxRecordingDuration);
            
            console.log('Fallback speech recognition started');
            
        } catch (error) {
            console.error('Failed to start fallback listening:', error);
            throw error;
        }
    }

    stopListening() {
        if (!this.isListening) {
            console.log('🔍 stopListening called but not currently listening');
            return;
        }

        try {
            console.log('🔍 Stopping speech recognition...');
            this.logResourceState('before_stop_listening');
            
            // Set flag immediately to prevent race conditions
            this.isListening = false;
            
            // Stop MediaRecorder with state check
            if (this.mediaRecorder) {
                console.log('🔍 MediaRecorder state:', this.mediaRecorder.state);
                if (this.mediaRecorder.state === 'recording') {
                    console.log('🔍 Stopping MediaRecorder...');
                    this.mediaRecorder.stop();
                }
                this.mediaRecorder = null;
                this.debugInfo.mediaRecorderCount = Math.max(0, this.debugInfo.mediaRecorderCount - 1);
            }
            
            // Stop Web Speech API recognition
            if (this.recognition) {
                console.log('🔍 Stopping Web Speech API recognition...');
                this.recognition.stop();
            }
            
            // Stop audio stream with null check and track validation
            if (this.stream) {
                try {
                    console.log('🔍 Stopping audio stream tracks...');
                    const tracks = this.stream.getTracks();
                    console.log('🔍 Found', tracks.length, 'tracks to stop');
                    
                    tracks.forEach((track, index) => {
                        if (track && typeof track.stop === 'function' && track.readyState !== 'ended') {
                            console.log(`🔍 Stopping track ${index}, readyState:`, track.readyState);
                            track.stop();
                        }
                    });
                } catch (trackError) {
                    console.warn('⚠️ Error stopping audio tracks:', trackError);
                    this.logError('track_stop_error', trackError);
                }
                this.stream = null;
                this.debugInfo.streamCount = Math.max(0, this.debugInfo.streamCount - 1);
            }
            
            // Clear timeout
            if (this.recordingTimeout) {
                console.log('🔍 Clearing recording timeout...');
                clearTimeout(this.recordingTimeout);
                this.recordingTimeout = null;
                this.debugInfo.activeTimeouts.delete(this.recordingTimeout);
            }
            
            // Send status update to main process
            if (typeof window !== 'undefined' && window.electronAPI) {
                window.electronAPI.sendSpeechRecognitionStatus({
                    listening: false
                });
            }
            
            this.updateUI('');
            
            console.log('🔍 Speech recognition stopped successfully');
            this.logResourceState('after_stop_listening');
            
        } catch (error) {
            console.error('🚨 Error stopping speech recognition:', error);
            this.logError('stop_listening_error', error);
            
            // Ensure state is reset even if cleanup fails
            this.isListening = false;
            this.stream = null;
            this.recordingTimeout = null;
            this.debugInfo.streamCount = 0;
            this.debugInfo.mediaRecorderCount = 0;
            
            this.logResourceState('stop_listening_error_cleanup');
        }
    }

    async processRecordedAudio() {
        try {
            console.log('🔍 Processing recorded audio, chunks:', this.audioChunks.length);
            this.logResourceState('start_process_audio');
            
            if (this.audioChunks.length === 0) {
                console.warn('⚠️ No audio data recorded');
                return;
            }
            
            // Create audio blob
            console.log('🔍 Creating audio blob from chunks...');
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            console.log('🔍 Audio blob created, size:', audioBlob.size);
            
            // CRASH FIX: Skip WAV conversion entirely to prevent crashes
            console.log('🔍 Skipping WAV conversion to prevent crashes - sending original audio...');
            
            try {
                // Send original audio blob directly to Python service
                console.log('🔍 Sending to transcription service...');
                await this.transcribeAudio(audioBlob);
                console.log('🔍 Transcription completed successfully');
                
            } catch (transcriptionError) {
                console.warn('⚠️ Transcription failed, falling back to Web Speech API if available');
                
                // Try fallback if service error and fallback enabled
                if (this.config.fallback.enableWebSpeechAPI && this.recognition) {
                    console.log('🔍 Falling back to Web Speech API due to transcription error');
                    this.serviceAvailable = false;
                    await this.startFallbackListening();
                } else {
                    this.handleRecognitionError(new Error('Speech recognition failed - please try again'));
                }
            }
            
        } catch (error) {
            console.error('🚨 Error processing recorded audio:', error);
            this.logError('process_audio_error', error);
            this.logResourceState('process_audio_error');
            this.handleRecognitionError(error);
        } finally {
            console.log('🔍 Clearing audio chunks...');
            this.audioChunks = [];
            this.logResourceState('end_process_audio');
        }
    }

    async convertToWav(audioBlob) {
        try {
            console.log('🔍 Starting WAV conversion, blob size:', audioBlob.size, 'type:', audioBlob.type);
            this.logResourceState('before_wav_conversion');
            
            // CRASH FIX: Skip conversion if already in WAV format or compatible format
            if (audioBlob.type === 'audio/wav' || audioBlob.type === 'audio/wave') {
                console.log('🔍 Audio already in WAV format, skipping conversion');
                return audioBlob;
            }
            
            // Skip conversion for PCM formats that don't need decoding
            if (audioBlob.type.includes('pcm')) {
                console.log('🔍 Audio in PCM format, skipping risky conversion');
                return audioBlob;
            }
            
            // Check AudioContext state
            if (!this.audioContext) {
                throw new Error('AudioContext is null');
            }
            
            if (this.audioContext.state === 'closed') {
                throw new Error('AudioContext is closed');
            }
            
            if (this.audioContext.state === 'suspended') {
                console.log('🔍 AudioContext suspended, attempting to resume...');
                await this.audioContext.resume();
            }
            
            console.log('🔍 AudioContext state:', this.audioContext.state);
            
            // Convert WebM/Opus to WAV format for Python service
            console.log('🔍 Converting blob to array buffer...');
            const arrayBuffer = await audioBlob.arrayBuffer();
            console.log('🔍 Array buffer size:', arrayBuffer.byteLength);
            
            // Reuse the shared AudioContext instance instead of creating a new one
            console.log('🔍 Decoding audio data...');
            
            // CRASH FIX: Add timeout and error handling for decodeAudioData
            const audioBuffer = await Promise.race([
                this.audioContext.decodeAudioData(arrayBuffer.slice()), // Use slice() to create a copy
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Audio decode timeout')), 5000)
                )
            ]);
            
            console.log('🔍 Audio buffer decoded - length:', audioBuffer.length, 'channels:', audioBuffer.numberOfChannels, 'sampleRate:', audioBuffer.sampleRate);
            
            // Convert to WAV format
            console.log('🔍 Converting to WAV format...');
            const wavBuffer = this.audioBufferToWav(audioBuffer);
            console.log('🔍 WAV buffer created, size:', wavBuffer.byteLength);
            
            this.logResourceState('after_wav_conversion');
            return new Blob([wavBuffer], { type: 'audio/wav' });
            
        } catch (error) {
            console.error('🚨 WAV conversion failed:', error);
            this.logError('wav_conversion_error', error);
            this.logResourceState('wav_conversion_failed');
            
            // Log additional context for debugging
            console.error('🔍 AudioContext state during error:', this.audioContext?.state);
            console.error('🔍 Blob type:', audioBlob.type);
            console.error('🔍 Blob size:', audioBlob.size);
            
            // CRASH FIX: If WAV conversion fails, try to send original blob or skip transcription
            if (error.message.includes('decode') || error.message.includes('timeout')) {
                console.warn('⚠️ Audio decode error detected - this could cause crashes. Skipping transcription.');
                throw new Error('Audio format incompatible - skipping transcription to prevent crash');
            }
            
            console.warn('⚠️ Using original blob due to conversion failure');
            return audioBlob;
        }
    }

    audioBufferToWav(buffer) {
        const length = buffer.length;
        const numberOfChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
        const view = new DataView(arrayBuffer);
        
        // WAV header
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + length * numberOfChannels * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numberOfChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numberOfChannels * 2, true);
        view.setUint16(32, numberOfChannels * 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, length * numberOfChannels * 2, true);
        
        // Convert float samples to 16-bit PCM
        let offset = 44;
        for (let i = 0; i < length; i++) {
            for (let channel = 0; channel < numberOfChannels; channel++) {
                const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
                view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
                offset += 2;
            }
        }
        
        return arrayBuffer;
    }

    async transcribeAudio(audioBlob) {
        try {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'audio.wav');
            formData.append('language', this.config.stt.language);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.config.service.timeout);
            
            const response = await fetch(`${this.config.service.baseUrl}${this.config.service.endpoints.stt}`, {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const result = await response.json();
                this.handleRecognitionResult(result.text, result.confidence);
            } else {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(`Transcription failed: ${error.error || response.statusText}`);
            }
            
        } catch (error) {
            console.error('Error transcribing audio:', error);
            
            // Try fallback if service error and fallback enabled
            if (this.config.fallback.fallbackOnServiceError && this.recognition) {
                console.log('Falling back to Web Speech API due to service error');
                this.serviceAvailable = false;
                await this.startFallbackListening();
            } else {
                this.handleRecognitionError(error);
            }
        }
    }

    async speak(text, options = {}) {
        if (!text) {
            return Promise.resolve();
        }

        try {
            // Stop any ongoing speech
            this.stopSpeaking();
            
            // Try Python service first
            if (this.serviceAvailable) {
                await this.speakWithPythonService(text, options);
            } else if (this.synthesis && this.config.fallback.enableWebSpeechAPI) {
                await this.speakWithFallback(text, options);
            } else {
                throw new Error('No speech synthesis service available');
            }
            
        } catch (error) {
            console.error('Failed to speak text:', error);
            
            // Try fallback if service error
            if (this.serviceAvailable && this.synthesis && this.config.fallback.fallbackOnServiceError) {
                console.log('Falling back to Web Speech API for TTS');
                await this.speakWithFallback(text, options);
            } else {
                throw error;
            }
        }
    }

    async speakWithPythonService(text, options = {}) {
        try {
            this.isSpeaking = true;
            
            const requestBody = {
                text: text,
                voice: options.voice || this.config.tts.defaultVoice,
                speed: options.speed || this.config.tts.speed,
                pitch: options.pitch || this.config.tts.pitch
            };
            
            // 🔍 DEBUG: Log TTS request parameters
            console.log('🔍 TTS REQUEST PARAMETERS:', {
                endpoint: `${this.config.service.baseUrl}${this.config.service.endpoints.tts}`,
                requestBody: requestBody,
                headers: { 'Content-Type': 'application/json' }
            });
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.config.service.timeout);
            
            const response = await fetch(`${this.config.service.baseUrl}${this.config.service.endpoints.tts}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const audioBlob = await response.blob();
                console.log('🔍 TTS SUCCESS: Audio blob received, size:', audioBlob.size);
                await this.playAudioBlob(audioBlob);
            } else {
                // 🔍 DEBUG: Log detailed error response
                console.error('🔍 TTS ERROR RESPONSE:', {
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries())
                });
                
                const errorText = await response.text().catch(() => 'Unable to read error response');
                console.error('🔍 TTS ERROR BODY:', errorText);
                
                let errorObj;
                try {
                    errorObj = JSON.parse(errorText);
                } catch (e) {
                    errorObj = { error: errorText || 'Unknown error' };
                }
                
                throw new Error(`Speech synthesis failed: ${errorObj.error || response.statusText}`);
            }
            
        } catch (error) {
            this.isSpeaking = false;
            throw error;
        }
    }

    async speakWithFallback(text, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                this.isSpeaking = true;
                
                // Cancel any ongoing speech
                this.synthesis.cancel();

                const utterance = new SpeechSynthesisUtterance(text);
                
                // Configure utterance
                utterance.voice = this.currentVoice;
                utterance.rate = options.rate || this.config.tts.speed;
                utterance.pitch = options.pitch || this.config.tts.pitch;
                utterance.volume = options.volume || 1.0;
                
                utterance.onstart = () => {
                    console.log('Fallback TTS started:', text.substring(0, 50));
                };
                
                utterance.onend = () => {
                    console.log('Fallback TTS ended');
                    this.isSpeaking = false;
                    resolve();
                };
                
                utterance.onerror = (event) => {
                    console.error('Fallback TTS error:', event.error);
                    this.isSpeaking = false;
                    reject(new Error(`TTS error: ${event.error}`));
                };
                
                this.synthesis.speak(utterance);
                
            } catch (error) {
                this.isSpeaking = false;
                reject(error);
            }
        });
    }

    async playAudioBlob(audioBlob) {
        return new Promise((resolve, reject) => {
            try {
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);
                
                audio.onloadeddata = () => {
                    console.log('Python service TTS audio loaded');
                };
                
                audio.onended = () => {
                    console.log('Python service TTS ended');
                    this.isSpeaking = false;
                    URL.revokeObjectURL(audioUrl);
                    resolve();
                };
                
                audio.onerror = (event) => {
                    console.error('Audio playback error:', event);
                    this.isSpeaking = false;
                    URL.revokeObjectURL(audioUrl);
                    reject(new Error('Audio playback failed'));
                };
                
                audio.play().catch(error => {
                    console.error('Failed to play audio:', error);
                    this.isSpeaking = false;
                    URL.revokeObjectURL(audioUrl);
                    reject(error);
                });
                
            } catch (error) {
                this.isSpeaking = false;
                reject(error);
            }
        });
    }

    stopSpeaking() {
        try {
            // Stop Web Speech API synthesis
            if (this.synthesis) {
                this.synthesis.cancel();
            }
            
            // Stop any playing audio elements
            const audioElements = document.querySelectorAll('audio');
            audioElements.forEach(audio => {
                if (!audio.paused) {
                    audio.pause();
                    audio.currentTime = 0;
                }
            });
            
            this.isSpeaking = false;
            
        } catch (error) {
            console.error('Error stopping speech:', error);
        }
    }

    async getAvailableVoices() {
        try {
            if (this.serviceAvailable) {
                const response = await fetch(`${this.config.service.baseUrl}${this.config.service.endpoints.voices}`);
                if (response.ok) {
                    const data = await response.json();
                    return data.voices || this.config.tts.availableVoices || [];
                }
            }
            
            // Fallback to Web Speech API voices
            if (this.synthesis) {
                return this.synthesis.getVoices().map(voice => ({
                    id: voice.name,
                    name: voice.name,
                    language: voice.lang
                }));
            }
            
            return [];
            
        } catch (error) {
            console.error('Error getting available voices:', error);
            return this.config.tts.availableVoices || [];
        }
    }

    setVoice(voiceId) {
        if (this.serviceAvailable) {
            this.config.tts.defaultVoice = voiceId;
        } else if (this.synthesis) {
            const voices = this.synthesis.getVoices();
            this.currentVoice = voices.find(voice => voice.name === voiceId) || this.currentVoice;
        }
        
        console.log('Voice changed to:', voiceId);
    }

    handleRecognitionResult(transcript, confidence = 0.3) {
        console.log('Speech recognition result:', transcript, 'Confidence:', confidence);
        
        this.updateUI('');
        
        // Check confidence threshold
        if (confidence < this.config.stt.confidenceThreshold) {
            console.warn('Low confidence recognition result, ignoring');
            return;
        }
        
        // Send to main process via IPC
        if (typeof window !== 'undefined' && window.electronAPI) {
            window.electronAPI.sendSpeechRecognitionResult({
                transcript,
                text: transcript, // For compatibility
                confidence,
                timestamp: Date.now(),
                source: this.serviceAvailable ? 'python-service' : 'web-speech-api'
            });
            
            // Update status
            window.electronAPI.sendSpeechRecognitionStatus({
                listening: false // Recognition completed
            });
        }
        
        // Emit event for system orchestrator
        if (this.recognitionResolve) {
            this.recognitionResolve({
                transcript,
                confidence,
                timestamp: Date.now()
            });
            this.recognitionResolve = null;
            this.recognitionReject = null;
        }
        
        // Send to app for processing
        if (this.app && this.app.handleSpeechInput) {
            this.app.handleSpeechInput({ text: transcript, confidence });
        }
    }

    handleRecognitionError(error) {
        console.error('Speech recognition error:', error);
        
        this.updateUI('');
        
        // Send to main process via IPC
        if (typeof window !== 'undefined' && window.electronAPI) {
            window.electronAPI.sendSpeechRecognitionError({
                error: error.message || error,
                timestamp: Date.now(),
                source: this.serviceAvailable ? 'python-service' : 'web-speech-api'
            });
            
            // Update status
            window.electronAPI.sendSpeechRecognitionStatus({
                listening: false // Recognition stopped due to error
            });
        }
        
        if (this.recognitionReject) {
            this.recognitionReject(error);
            this.recognitionResolve = null;
            this.recognitionReject = null;
        }
        
        if (this.app && this.app.handleError) {
            this.app.handleError('Speech recognition error', error);
        }
    }

    updateUI(message) {
        const speechTextElement = document.getElementById('speech-text');
        if (speechTextElement) {
            speechTextElement.textContent = message;
        }
    }

    // Public API methods
    isRecognitionSupported() {
        return this.isSupported && (this.serviceAvailable || !!this.recognition);
    }

    isCurrentlyListening() {
        return this.isListening;
    }

    isCurrentlySpeaking() {
        return this.isSpeaking || (this.synthesis && this.synthesis.speaking);
    }

    getStatus() {
        return {
            supported: this.isSupported,
            serviceAvailable: this.serviceAvailable,
            listening: this.isListening,
            speaking: this.isCurrentlySpeaking(),
            fallbackReady: !!this.recognition,
            lastHealthCheck: this.lastHealthCheck,
            serviceDownSince: this.serviceDownSince
        };
    }
    
    // DEBUG: Get comprehensive debug information
    getDebugInfo() {
        return {
            ...this.debugInfo,
            currentState: {
                isListening: this.isListening,
                isSpeaking: this.isSpeaking,
                isSupported: this.isSupported,
                serviceAvailable: this.serviceAvailable,
                hasAudioContext: !!this.audioContext,
                audioContextState: this.audioContext?.state,
                hasMediaRecorder: !!this.mediaRecorder,
                mediaRecorderState: this.mediaRecorder?.state,
                hasStream: !!this.stream,
                streamActive: this.stream?.active,
                hasRecognition: !!this.recognition,
                audioChunksCount: this.audioChunks.length
            },
            memoryInfo: performance.memory ? {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
            } : null
        };
    }

    async testSpeech() {
        try {
            await this.speak("Speech test successful. I can hear and speak using the new Python service.");
            return true;
        } catch (error) {
            console.error('Speech test failed:', error);
            return false;
        }
    }

    async requestMicrophonePermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (error) {
            console.error('Microphone permission denied:', error);
            return false;
        }
    }

    setupIPCHandlers() {
        if (typeof window !== 'undefined' && window.electronAPI) {
            // Listen for commands from main process
            window.electronAPI.onStartPythonSpeechRecognition(() => {
                this.startPythonServiceListening().catch(error => {
                    console.error('Failed to start Python service listening:', error);
                    window.electronAPI.sendSpeechRecognitionError({
                        error: error.message,
                        source: 'python-service'
                    });
                });
            });

            window.electronAPI.onStartFallbackSpeechRecognition(() => {
                this.startFallbackListening().catch(error => {
                    console.error('Failed to start fallback listening:', error);
                    window.electronAPI.sendSpeechRecognitionError({
                        error: error.message,
                        source: 'web-speech-api'
                    });
                });
            });

            window.electronAPI.onStopSpeechRecognition(() => {
                this.stopListening();
            });

            window.electronAPI.onSpeakTextPythonService((speechRequest) => {
                this.speakWithPythonService(speechRequest.text, speechRequest.options)
                    .then(() => {
                        window.electronAPI.sendSpeechSynthesisComplete({ id: speechRequest.id });
                    })
                    .catch(error => {
                        window.electronAPI.sendSpeechSynthesisError({
                            error: error.message,
                            id: speechRequest.id,
                            source: 'python-service'
                        });
                    });
            });

            window.electronAPI.onSpeakTextFallback((speechRequest) => {
                this.speakWithFallback(speechRequest.text, speechRequest.options)
                    .then(() => {
                        window.electronAPI.sendSpeechSynthesisComplete({ id: speechRequest.id });
                    })
                    .catch(error => {
                        window.electronAPI.sendSpeechSynthesisError({
                            error: error.message,
                            id: speechRequest.id,
                            source: 'web-speech-api'
                        });
                    });
            });

            window.electronAPI.onStopSpeech(() => {
                this.stopSpeaking();
            });

            window.electronAPI.onSetFallbackVoice((voiceId) => {
                this.setVoice(voiceId);
            });

            // Handle voice requests
            window.electronAPI.handleGetFallbackVoices(async () => {
                if (this.synthesis) {
                    const voices = this.synthesis.getVoices();
                    return voices.map(voice => ({
                        id: voice.name,
                        name: voice.name,
                        language: voice.lang,
                        localService: voice.localService
                    }));
                }
                return [];
            });

            console.log('IPC handlers set up for speech manager');
        }
    }

    destroy() {
        console.log('🔍 Destroying Speech Manager...');
        this.logResourceState('before_destroy');
        
        try {
            // Stop all active operations
            this.stopListening();
            this.stopSpeaking();
            
            // Clear all intervals
            if (this.healthCheckInterval) {
                console.log('🔍 Clearing health check interval...');
                clearInterval(this.healthCheckInterval);
                this.healthCheckInterval = null;
                this.debugInfo.activeIntervals.delete(this.healthCheckInterval);
            }
            
            // Clear all timeouts
            if (this.recordingTimeout) {
                console.log('🔍 Clearing recording timeout...');
                clearTimeout(this.recordingTimeout);
                this.recordingTimeout = null;
                this.debugInfo.activeTimeouts.delete(this.recordingTimeout);
            }
            
            // Clear any remaining timeouts and intervals
            this.debugInfo.activeTimeouts.forEach(timeout => {
                try {
                    clearTimeout(timeout);
                } catch (e) {
                    console.warn('⚠️ Error clearing timeout:', e);
                }
            });
            this.debugInfo.activeTimeouts.clear();
            
            this.debugInfo.activeIntervals.forEach(interval => {
                try {
                    clearInterval(interval);
                } catch (e) {
                    console.warn('⚠️ Error clearing interval:', e);
                }
            });
            this.debugInfo.activeIntervals.clear();
            
            // Close AudioContext
            if (this.audioContext) {
                console.log('🔍 Closing AudioContext, state:', this.audioContext.state);
                if (this.audioContext.state !== 'closed') {
                    this.audioContext.close().then(() => {
                        console.log('🔍 AudioContext closed successfully');
                    }).catch(error => {
                        console.warn('⚠️ Error closing AudioContext:', error);
                    });
                }
                this.audioContext = null;
                this.debugInfo.audioContextCount = Math.max(0, this.debugInfo.audioContextCount - 1);
            }
            
            // Clean up recognition
            if (this.recognition) {
                console.log('🔍 Cleaning up Web Speech API recognition...');
                try {
                    this.recognition.stop();
                } catch (e) {
                    console.warn('⚠️ Error stopping recognition:', e);
                }
                this.recognition = null;
            }
            
            // Clean up MediaRecorder
            if (this.mediaRecorder) {
                console.log('🔍 Cleaning up MediaRecorder...');
                try {
                    if (this.mediaRecorder.state !== 'inactive') {
                        this.mediaRecorder.stop();
                    }
                } catch (e) {
                    console.warn('⚠️ Error stopping MediaRecorder:', e);
                }
                this.mediaRecorder = null;
                this.debugInfo.mediaRecorderCount = 0;
            }
            
            // Clean up stream
            if (this.stream) {
                console.log('🔍 Cleaning up audio stream...');
                try {
                    this.stream.getTracks().forEach(track => track.stop());
                } catch (e) {
                    console.warn('⚠️ Error stopping stream tracks:', e);
                }
                this.stream = null;
                this.debugInfo.streamCount = 0;
            }
            
            // Clear audio chunks
            this.audioChunks = [];
            
            // Reset state
            this.isListening = false;
            this.isSpeaking = false;
            this.serviceAvailable = false;
            
            console.log('🔍 Speech Manager destroyed successfully');
            this.logResourceState('after_destroy');
            
            // Log final debug summary
            console.log('🔍 FINAL DEBUG SUMMARY:', {
                errorHistory: this.debugInfo.errorHistory,
                finalResourceCounts: {
                    audioContext: this.debugInfo.audioContextCount,
                    mediaRecorder: this.debugInfo.mediaRecorderCount,
                    stream: this.debugInfo.streamCount,
                    timeouts: this.debugInfo.activeTimeouts.size,
                    intervals: this.debugInfo.activeIntervals.size
                }
            });
            
        } catch (error) {
            console.error('🚨 Error during Speech Manager destruction:', error);
            this.logError('destroy_error', error);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpeechManager;
}