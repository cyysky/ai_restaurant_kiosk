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
                confidenceThreshold: 0.7
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
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('Audio context initialized');
        } catch (error) {
            console.error('Failed to initialize audio context:', error);
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
        }
        
        this.healthCheckInterval = setInterval(async () => {
            await this.checkServiceHealth();
        }, this.config.monitoring.healthCheckInterval);
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
            // Request microphone access
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: this.config.audio.sampleRate || 16000,
                    channelCount: this.config.audio.channels || 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            
            // Set up MediaRecorder
            const options = {
                mimeType: 'audio/webm;codecs=opus'
            };
            
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'audio/webm';
            }
            
            this.mediaRecorder = new MediaRecorder(this.stream, options);
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = async () => {
                await this.processRecordedAudio();
            };
            
            this.mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error);
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
                    this.stopListening();
                }
            }, this.config.audio.maxRecordingDuration);
            
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
            return;
        }

        try {
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.stop();
            }
            
            if (this.recognition) {
                this.recognition.stop();
            }
            
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
            }
            
            if (this.recordingTimeout) {
                clearTimeout(this.recordingTimeout);
                this.recordingTimeout = null;
            }
            
            this.isListening = false;
            
            // Send status update to main process
            if (typeof window !== 'undefined' && window.electronAPI) {
                window.electronAPI.sendSpeechRecognitionStatus({
                    listening: false
                });
            }
            
            this.updateUI('');
            
            console.log('Speech recognition stopped');
            
        } catch (error) {
            console.error('Error stopping speech recognition:', error);
        }
    }

    async processRecordedAudio() {
        try {
            if (this.audioChunks.length === 0) {
                console.warn('No audio data recorded');
                return;
            }
            
            // Create audio blob
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            
            // Convert to WAV if needed
            const wavBlob = await this.convertToWav(audioBlob);
            
            // Send to Python service
            await this.transcribeAudio(wavBlob);
            
        } catch (error) {
            console.error('Error processing recorded audio:', error);
            this.handleRecognitionError(error);
        } finally {
            this.audioChunks = [];
        }
    }

    async convertToWav(audioBlob) {
        try {
            // Convert WebM/Opus to WAV format for Python service
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            // Convert to WAV format
            const wavBuffer = this.audioBufferToWav(audioBuffer);
            return new Blob([wavBuffer], { type: 'audio/wav' });
        } catch (error) {
            console.warn('WAV conversion failed, using original blob:', error);
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
                await this.playAudioBlob(audioBlob);
            } else {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(`Speech synthesis failed: ${error.error || response.statusText}`);
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

    handleRecognitionResult(transcript, confidence = 0.8) {
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
        console.log('Destroying Speech Manager...');
        
        this.stopListening();
        this.stopSpeaking();
        
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        
        if (this.recordingTimeout) {
            clearTimeout(this.recordingTimeout);
            this.recordingTimeout = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        this.recognition = null;
        this.mediaRecorder = null;
        this.stream = null;
        
        console.log('Speech Manager destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpeechManager;
}