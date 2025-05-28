# Integration Guide: Python Speech Service with Electron App

This guide explains how to integrate the Python speech processing service with the existing Electron menu AI application.

## Overview

The Python service replaces the Web Speech API functionality in the Electron app, providing:
- **Whisper STT**: High-quality offline speech-to-text
- **Kokoro TTS**: Natural offline text-to-speech
- **REST API**: Easy integration with the existing JavaScript frontend

## Integration Steps

### 1. Start the Python Service

Before running the Electron app, start the Python speech service:

```bash
cd python_service
python start_service.py
```

The service will be available at `http://localhost:8000`

### 2. Update Electron App Configuration

Modify the existing speech manager to use the Python service instead of Web Speech API.

#### Update `app/ui/scripts/speech_manager.js`:

```javascript
class SpeechManager {
    constructor() {
        this.isListening = false;
        this.isSpeaking = false;
        this.serviceUrl = 'http://localhost:8000/api/v1';
        this.mediaRecorder = null;
        this.audioChunks = [];
    }

    // Replace Web Speech API STT with Python service
    async startListening() {
        if (this.isListening) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };

            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                await this.transcribeAudio(audioBlob);
            };

            this.mediaRecorder.start();
            this.isListening = true;
            
            // Auto-stop after 5 seconds (or implement voice activity detection)
            setTimeout(() => this.stopListening(), 5000);
            
        } catch (error) {
            console.error('Error starting speech recognition:', error);
        }
    }

    stopListening() {
        if (this.mediaRecorder && this.isListening) {
            this.mediaRecorder.stop();
            this.isListening = false;
        }
    }

    async transcribeAudio(audioBlob) {
        try {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'audio.wav');
            formData.append('language', 'auto');

            const response = await fetch(`${this.serviceUrl}/speech/transcribe`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                this.onSpeechResult(result.text, result.confidence);
            } else {
                console.error('Transcription failed:', response.statusText);
            }
        } catch (error) {
            console.error('Error transcribing audio:', error);
        }
    }

    // Replace Web Speech API TTS with Python service
    async speak(text, voice = 'af_heart') {
        if (this.isSpeaking) return;

        try {
            this.isSpeaking = true;

            const response = await fetch(`${this.serviceUrl}/speech/synthesize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    voice: voice,
                    speed: 1.0,
                    pitch: 1.0
                })
            });

            if (response.ok) {
                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);
                
                audio.onended = () => {
                    this.isSpeaking = false;
                    URL.revokeObjectURL(audioUrl);
                };
                
                await audio.play();
            } else {
                console.error('Speech synthesis failed:', response.statusText);
                this.isSpeaking = false;
            }
        } catch (error) {
            console.error('Error synthesizing speech:', error);
            this.isSpeaking = false;
        }
    }

    async getAvailableVoices() {
        try {
            const response = await fetch(`${this.serviceUrl}/speech/voices`);
            if (response.ok) {
                const data = await response.json();
                return data.voices;
            }
        } catch (error) {
            console.error('Error getting voices:', error);
        }
        return [];
    }

    // Callback for speech recognition results
    onSpeechResult(text, confidence) {
        // This should be implemented to handle the transcribed text
        // Connect to your existing NLU pipeline
        console.log('Speech recognized:', text, 'Confidence:', confidence);
        
        // Example: Send to NLU engine
        if (window.nluEngine) {
            window.nluEngine.processInput(text);
        }
    }
}
```

### 3. Update Main Process

Ensure the main Electron process allows network requests to localhost:

#### Update `main.js`:

```javascript
// Add to webSecurity configuration
const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: false // Allow localhost requests
    }
});
```

### 4. Service Health Check

Add a health check to ensure the Python service is running:

```javascript
class ServiceHealthChecker {
    constructor(serviceUrl = 'http://localhost:8000/api/v1') {
        this.serviceUrl = serviceUrl;
        this.isHealthy = false;
    }

    async checkHealth() {
        try {
            const response = await fetch(`${this.serviceUrl}/health`);
            if (response.ok) {
                const data = await response.json();
                this.isHealthy = data.status === 'healthy';
                return this.isHealthy;
            }
        } catch (error) {
            console.error('Service health check failed:', error);
        }
        this.isHealthy = false;
        return false;
    }

    async waitForService(maxAttempts = 30, interval = 1000) {
        for (let i = 0; i < maxAttempts; i++) {
            if (await this.checkHealth()) {
                console.log('Speech service is ready');
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        console.error('Speech service failed to start');
        return false;
    }
}
```

### 5. Error Handling and Fallbacks

Implement graceful fallbacks when the Python service is unavailable:

```javascript
class RobustSpeechManager extends SpeechManager {
    constructor() {
        super();
        this.healthChecker = new ServiceHealthChecker();
        this.fallbackToWebAPI = true;
    }

    async initialize() {
        const serviceAvailable = await this.healthChecker.checkHealth();
        if (!serviceAvailable && this.fallbackToWebAPI) {
            console.warn('Python service unavailable, falling back to Web Speech API');
            this.initializeWebSpeechAPI();
        }
    }

    initializeWebSpeechAPI() {
        // Fallback to original Web Speech API implementation
        if ('webkitSpeechRecognition' in window) {
            this.recognition = new webkitSpeechRecognition();
            // Configure Web Speech API as before
        }
    }
}
```

## Configuration

### Environment Variables

Create a `.env` file in the Electron app root:

```env
SPEECH_SERVICE_URL=http://localhost:8000/api/v1
SPEECH_SERVICE_TIMEOUT=30000
ENABLE_SPEECH_FALLBACK=true
```

### Service Configuration

The Python service can be configured via environment variables or the `.env` file in the `python_service` directory.

## Testing the Integration

1. **Start the Python service**:
   ```bash
   cd python_service
   python start_service.py
   ```

2. **Test the service**:
   ```bash
   python test_service.py
   ```

3. **Start the Electron app**:
   ```bash
   npm start
   ```

4. **Test speech functionality**:
   - Try voice input
   - Test text-to-speech responses
   - Verify fallback behavior when service is stopped

## Performance Considerations

### Model Loading
- Models are loaded once at service startup
- First requests may be slower due to initialization
- Consider pre-warming with a test request

### Memory Usage
- Whisper and Kokoro models require significant memory
- Monitor system resources during operation
- Consider model size vs. quality trade-offs

### Network Latency
- Local service should have minimal latency
- Audio data transfer may take time for longer recordings
- Implement appropriate timeouts

## Troubleshooting

### Common Issues

1. **Service not starting**: Check Python dependencies and port availability
2. **CORS errors**: Ensure CORS is properly configured in the Python service
3. **Audio format issues**: Verify browser audio recording format compatibility
4. **Model loading failures**: Check available memory and disk space

### Debug Mode

Enable debug logging in both services:

```bash
# Python service
LOG_LEVEL=DEBUG python start_service.py

# Electron app (in DevTools console)
localStorage.setItem('debug', 'true');
```

## Production Deployment

For production deployment:

1. **Package the Python service** with the Electron app
2. **Use process management** (PM2, systemd) for the Python service
3. **Configure proper logging** and monitoring
4. **Set up health checks** and automatic restarts
5. **Optimize model loading** and caching strategies

## Security Considerations

- The service runs on localhost only by default
- No authentication is implemented (suitable for local kiosk use)
- Audio data is processed locally (privacy-friendly)
- Consider firewall rules for production deployment