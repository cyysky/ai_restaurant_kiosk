// Speech Manager - Handles speech recognition and synthesis
class SpeechManager {
    constructor(app) {
        this.app = app;
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.isSupported = false;
        this.currentVoice = null;
        this.recognitionTimeout = null;
    }

    async init() {
        console.log('Initializing Speech Manager...');
        
        try {
            // Check for speech recognition support
            this.isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
            
            if (!this.isSupported) {
                console.warn('Speech recognition not supported in this browser');
                return;
            }

            // Initialize speech recognition
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            
            // Configure recognition settings
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';
            this.recognition.maxAlternatives = 1;
            
            // Set up event handlers
            this.setupRecognitionHandlers();
            
            // Initialize text-to-speech
            await this.initializeTTS();
            
            console.log('Speech Manager initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Speech Manager:', error);
            this.isSupported = false;
        }
    }

    setupRecognitionHandlers() {
        this.recognition.onstart = () => {
            console.log('Speech recognition started');
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

            // Update UI with interim results
            if (interimTranscript) {
                document.getElementById('speech-text').textContent = `Listening: ${interimTranscript}`;
            }

            // Process final result
            if (finalTranscript) {
                this.handleRecognitionResult(finalTranscript.trim());
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isListening = false;
            
            let errorMessage = 'Speech recognition error';
            
            switch (event.error) {
                case 'no-speech':
                    errorMessage = "I didn't hear anything. Please try again.";
                    break;
                case 'audio-capture':
                    errorMessage = "Microphone not available. Please check your microphone.";
                    break;
                case 'not-allowed':
                    errorMessage = "Microphone access denied. Please allow microphone access.";
                    break;
                case 'network':
                    errorMessage = "Network error. Speech recognition is working offline.";
                    break;
                default:
                    errorMessage = `Speech recognition error: ${event.error}`;
            }
            
            this.app.handleError('Speech recognition error', new Error(errorMessage));
        };

        this.recognition.onend = () => {
            console.log('Speech recognition ended');
            this.isListening = false;
            
            if (this.recognitionTimeout) {
                clearTimeout(this.recognitionTimeout);
                this.recognitionTimeout = null;
            }
        };
    }

    async initializeTTS() {
        // Wait for voices to load
        return new Promise((resolve) => {
            const loadVoices = () => {
                const voices = this.synthesis.getVoices();
                
                if (voices.length > 0) {
                    // Prefer English voices
                    this.currentVoice = voices.find(voice => 
                        voice.lang.startsWith('en') && voice.localService
                    ) || voices.find(voice => 
                        voice.lang.startsWith('en')
                    ) || voices[0];
                    
                    console.log('TTS voice selected:', this.currentVoice?.name);
                    resolve();
                } else {
                    // Voices not loaded yet, try again
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

    async startListening() {
        if (!this.isSupported) {
            throw new Error('Speech recognition not supported');
        }

        if (this.isListening) {
            console.log('Already listening');
            return;
        }

        try {
            // Stop any ongoing speech synthesis
            this.synthesis.cancel();
            
            // Start recognition with timeout
            this.recognition.start();
            
            // Set timeout to automatically stop listening
            this.recognitionTimeout = setTimeout(() => {
                if (this.isListening) {
                    this.stopListening();
                }
            }, 10000); // 10 second timeout
            
            return new Promise((resolve, reject) => {
                this.recognitionResolve = resolve;
                this.recognitionReject = reject;
            });
            
        } catch (error) {
            console.error('Failed to start speech recognition:', error);
            throw error;
        }
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
        
        if (this.recognitionTimeout) {
            clearTimeout(this.recognitionTimeout);
            this.recognitionTimeout = null;
        }
        
        this.isListening = false;
    }

    handleRecognitionResult(transcript) {
        console.log('Speech recognition result:', transcript);
        
        if (this.recognitionResolve) {
            this.recognitionResolve({ transcript });
            this.recognitionResolve = null;
            this.recognitionReject = null;
        }
    }

    speak(text, options = {}) {
        return new Promise((resolve, reject) => {
            if (!text) {
                resolve();
                return;
            }

            // Cancel any ongoing speech
            this.synthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            
            // Configure utterance
            utterance.voice = this.currentVoice;
            utterance.rate = options.rate || 1.0;
            utterance.pitch = options.pitch || 1.0;
            utterance.volume = options.volume || 1.0;
            
            // Set up event handlers
            utterance.onstart = () => {
                console.log('TTS started:', text);
            };
            
            utterance.onend = () => {
                console.log('TTS ended');
                resolve();
            };
            
            utterance.onerror = (event) => {
                console.error('TTS error:', event.error);
                reject(new Error(`TTS error: ${event.error}`));
            };
            
            // Speak the text
            this.synthesis.speak(utterance);
        });
    }

    stopSpeaking() {
        this.synthesis.cancel();
    }

    // Get available voices
    getVoices() {
        return this.synthesis.getVoices();
    }

    // Set voice by name or index
    setVoice(voiceNameOrIndex) {
        const voices = this.getVoices();
        
        if (typeof voiceNameOrIndex === 'string') {
            this.currentVoice = voices.find(voice => 
                voice.name.toLowerCase().includes(voiceNameOrIndex.toLowerCase())
            );
        } else if (typeof voiceNameOrIndex === 'number') {
            this.currentVoice = voices[voiceNameOrIndex];
        }
        
        if (this.currentVoice) {
            console.log('Voice changed to:', this.currentVoice.name);
        }
    }

    // Check if speech recognition is supported
    isRecognitionSupported() {
        return this.isSupported;
    }

    // Check if currently listening
    isCurrentlyListening() {
        return this.isListening;
    }

    // Check if TTS is speaking
    isSpeaking() {
        return this.synthesis.speaking;
    }

    // Get speech recognition status
    getStatus() {
        return {
            supported: this.isSupported,
            listening: this.isListening,
            speaking: this.synthesis.speaking,
            voice: this.currentVoice?.name || 'Default'
        };
    }

    // Test speech functionality
    async testSpeech() {
        try {
            await this.speak("Speech test successful. I can hear and speak.");
            return true;
        } catch (error) {
            console.error('Speech test failed:', error);
            return false;
        }
    }

    // Handle microphone permissions
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

    // Advanced speech recognition with custom grammar
    startListeningWithGrammar(grammar) {
        if (!this.isSupported) {
            throw new Error('Speech recognition not supported');
        }

        // Note: Speech Grammar API is not widely supported
        // This is a placeholder for future implementation
        console.log('Custom grammar not supported in current implementation');
        return this.startListening();
    }

    // Process speech with confidence scoring
    processWithConfidence(result) {
        if (result.results && result.results.length > 0) {
            const confidence = result.results[0][0].confidence;
            const transcript = result.results[0][0].transcript;
            
            return {
                transcript,
                confidence,
                isReliable: confidence > 0.7
            };
        }
        
        return null;
    }

    // Cleanup resources
    destroy() {
        this.stopListening();
        this.stopSpeaking();
        
        if (this.recognition) {
            this.recognition = null;
        }
        
        if (this.recognitionTimeout) {
            clearTimeout(this.recognitionTimeout);
            this.recognitionTimeout = null;
        }
        
        console.log('Speech Manager destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpeechManager;
}