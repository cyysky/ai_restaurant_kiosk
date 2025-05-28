# Speech Service Integration Guide

This guide explains how to use the integrated Python speech service with the Electron menu AI application.

## Overview

The application now supports both Python-based speech services (Whisper for STT and Kokoro for TTS) and Web Speech API fallback. The integration provides:

- **Speech-to-Text (STT)**: Whisper model via Python service with Web Speech API fallback
- **Text-to-Speech (TTS)**: Kokoro voices via Python service with Web Speech API fallback
- **Health Monitoring**: Automatic service health checks and graceful degradation
- **Audio Processing**: Web Audio API for recording with WAV conversion for Python service

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Renderer      │    │   Main Process   │    │  Python Service │
│   Process       │    │                  │    │                 │
│                 │    │                  │    │                 │
│ SpeechManager   │◄──►│ SpeechInput      │◄──►│ FastAPI Server  │
│ (Frontend)      │    │ SpeechOutput     │    │ (Whisper+Kokoro)│
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Getting Started

### 1. Start the Python Service

Before using speech functionality, start the Python speech service:

**Windows:**
```bash
cd python_service
start_service.bat
```

**Linux/macOS:**
```bash
cd python_service
chmod +x start_service.sh
./start_service.sh
```

**Manual start:**
```bash
cd python_service
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### 2. Verify Service Health

The application automatically checks service health every 30 seconds. You can also manually verify:

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "services": {
    "whisper": "ready",
    "kokoro": "ready"
  }
}
```

### 3. Test Speech Functionality

1. **Launch the Electron app**
2. **Test TTS**: The app will announce when speech services are ready
3. **Test STT**: Click the microphone button or use voice activation
4. **Monitor logs**: Check both Electron and Python service logs for any issues

## Configuration

### Speech Service Configuration

Edit [`config/speech_service_config.json`](config/speech_service_config.json:1) to customize:

```json
{
  "service": {
    "baseUrl": "http://localhost:8000",
    "timeout": 30000,
    "retryAttempts": 3
  },
  "audio": {
    "sampleRate": 16000,
    "channels": 1,
    "maxRecordingDuration": 30000
  },
  "stt": {
    "language": "auto",
    "confidenceThreshold": 0.7
  },
  "tts": {
    "defaultVoice": "af_heart",
    "speed": 1.0,
    "pitch": 1.0
  },
  "fallback": {
    "enableWebSpeechAPI": true,
    "fallbackOnServiceError": true
  }
}
```

### Available TTS Voices

The Python service supports these Kokoro voices:
- `af_heart` - Female, warm tone
- `af_sky` - Female, clear tone  
- `af_bella` - Female, expressive
- `af_sarah` - Female, professional
- `am_adam` - Male, deep tone
- `am_michael` - Male, clear tone

## API Endpoints

### Python Service Endpoints

- **Health Check**: `GET /health`
- **Speech-to-Text**: `POST /speech-to-text`
- **Text-to-Speech**: `POST /text-to-speech`
- **Available Voices**: `GET /voices`

### Example Usage

**STT Request:**
```javascript
const formData = new FormData();
formData.append('audio', audioBlob, 'audio.wav');
formData.append('language', 'auto');

const response = await fetch('http://localhost:8000/speech-to-text', {
    method: 'POST',
    body: formData
});
```

**TTS Request:**
```javascript
const response = await fetch('http://localhost:8000/text-to-speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        text: "Hello, how can I help you today?",
        voice: "af_heart",
        speed: 1.0
    })
});
```

## Component Integration

### Frontend (Renderer Process)

**SpeechManager** ([`app/ui/scripts/speech_manager.js`](app/ui/scripts/speech_manager.js:1)):
- Handles Web Audio API recording
- Converts audio to WAV format
- Manages Python service communication
- Provides Web Speech API fallback
- Implements health monitoring

### Backend (Main Process)

**SpeechInput** ([`app/speech_input/speech_input.js`](app/speech_input/speech_input.js:1)):
- Manages STT requests via IPC
- Handles service health monitoring
- Coordinates with system orchestrator

**SpeechOutput** ([`app/speech_output/speech_output.js`](app/speech_output/speech_output.js:1)):
- Manages TTS requests and queuing
- Handles audio playback coordination
- Provides voice management

**SystemOrchestrator** ([`app/orchestrator/system_orchestrator.js`](app/orchestrator/system_orchestrator.js:1)):
- Coordinates speech components
- Handles service status updates
- Manages graceful degradation

## Troubleshooting

### Common Issues

**1. Python Service Not Starting**
- Check Python dependencies: `pip install -r requirements.txt`
- Verify port 8000 is available
- Check Python service logs for errors

**2. Audio Recording Issues**
- Ensure microphone permissions are granted
- Check browser audio device settings
- Verify Web Audio API support

**3. Service Connection Errors**
- Verify Python service is running on localhost:8000
- Check firewall settings
- Review network connectivity

**4. Poor Speech Recognition**
- Check microphone quality and positioning
- Adjust confidence threshold in config
- Ensure quiet environment for recording

**5. TTS Playback Issues**
- Check audio output device settings
- Verify audio codec support
- Review browser audio policies

### Debug Commands

**Check service status:**
```bash
curl -v http://localhost:8000/health
```

**Test STT endpoint:**
```bash
curl -X POST -F "audio=@test.wav" http://localhost:8000/speech-to-text
```

**Test TTS endpoint:**
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"text":"Hello world","voice":"af_heart"}' \
  http://localhost:8000/text-to-speech --output test.wav
```

### Log Locations

- **Electron Main Process**: Console output
- **Electron Renderer**: Browser DevTools Console
- **Python Service**: Terminal/Command Prompt where service was started

## Performance Optimization

### Audio Processing
- Use 16kHz sample rate for optimal Whisper performance
- Keep recording duration under 30 seconds
- Enable noise suppression and echo cancellation

### Service Communication
- Implement request timeouts (default: 30s)
- Use retry logic for transient failures
- Monitor service health regularly

### Memory Management
- Clean up audio blobs after processing
- Limit TTS queue size
- Close audio contexts when not needed

## Security Considerations

- Python service runs on localhost only by default
- Audio data is processed locally (no external API calls)
- Temporary audio files are cleaned up automatically
- No persistent storage of audio data

## Development Notes

### Adding New Voices
1. Add voice ID to `availableVoices` in config
2. Ensure Python service supports the voice
3. Test voice availability via `/voices` endpoint

### Extending Audio Formats
1. Update `convertToWav()` method in SpeechManager
2. Modify Python service to accept new formats
3. Update MIME type handling in MediaRecorder

### Custom Error Handling
1. Implement custom error types in SpeechManager
2. Add error recovery strategies
3. Update UI feedback mechanisms

## Support

For issues related to:
- **Whisper STT**: Check OpenAI Whisper documentation
- **Kokoro TTS**: Review Kokoro model documentation  
- **Electron Integration**: See Electron IPC documentation
- **Web Audio API**: Consult MDN Web Audio documentation

## Version Compatibility

- **Node.js**: 16.x or higher
- **Electron**: 20.x or higher
- **Python**: 3.8 or higher
- **Browser**: Chrome 66+, Firefox 60+, Safari 14+