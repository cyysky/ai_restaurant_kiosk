# Speech Processing Service

A FastAPI backend service for speech processing with Whisper (STT) and Kokoro (TTS) integration.

## Features

- **Speech-to-Text (STT)**: Uses OpenAI Whisper for high-quality audio transcription
- **Text-to-Speech (TTS)**: Uses Kokoro for natural speech synthesis
- **FastAPI**: Modern, fast web framework with automatic API documentation
- **Model Caching**: Models are loaded once at startup to avoid performance issues
- **CORS Support**: Configured for Electron frontend integration
- **Error Handling**: Comprehensive error handling and logging

## API Endpoints

### Health Check
- `GET /api/v1/health` - Service health status

### Speech-to-Text
- `POST /api/v1/speech/transcribe` - Transcribe audio to text
  - Upload audio file (WAV, MP3, M4A, etc.)
  - Optional language parameter

### Text-to-Speech
- `POST /api/v1/speech/synthesize` - Synthesize speech from text
  - JSON body with text, voice, speed, and pitch parameters
  - Returns WAV audio data

### Voice Management
- `GET /api/v1/speech/voices` - Get available TTS voices

## Installation

### Prerequisites

- Python 3.8 or higher
- pip package manager

### Option 1: Using the startup script (Recommended)

```bash
cd python_service
python start_service.py --install
```

### Option 2: Manual installation

```bash
cd python_service
pip install -r requirements.txt
```

## Usage

### Starting the Service

#### Using the startup script:
```bash
python start_service.py
```

#### With custom host/port:
```bash
python start_service.py --host 127.0.0.1 --port 8080
```

#### Manual start:
```bash
python main.py
```

### API Documentation

Once the service is running, visit:
- Interactive API docs: http://localhost:8000/docs
- Alternative docs: http://localhost:8000/redoc

## Configuration

The service can be configured using environment variables:

- `HOST`: Server host (default: 0.0.0.0)
- `PORT`: Server port (default: 8000)
- `DEBUG`: Enable debug mode (default: false)
- `MAX_TEXT_LENGTH`: Maximum text length for TTS (default: 1000)
- `MAX_AUDIO_SIZE`: Maximum audio file size (default: 10MB)
- `WHISPER_MODEL`: Whisper model to use (default: turbo)
- `DEFAULT_VOICE`: Default Kokoro voice (default: af_heart)
- `LOG_LEVEL`: Logging level (default: INFO)

## Example Usage

### Transcription (STT)
```bash
curl -X POST "http://localhost:8000/api/v1/speech/transcribe" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "audio=@audio_file.wav" \
  -F "language=auto"
```

### Speech Synthesis (TTS)
```bash
curl -X POST "http://localhost:8000/api/v1/speech/synthesize" \
  -H "accept: audio/wav" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, this is a test of the speech synthesis system.",
    "voice": "af_heart",
    "speed": 1.0,
    "pitch": 1.0
  }' \
  --output synthesized_speech.wav
```

### Get Available Voices
```bash
curl -X GET "http://localhost:8000/api/v1/speech/voices" \
  -H "accept: application/json"
```

## Available Voices

The service supports multiple Kokoro voices:
- `af_heart` - Female, warm voice
- `af_sky` - Female, clear voice
- `af_bella` - Female, expressive voice
- `af_sarah` - Female, professional voice
- `am_adam` - Male, deep voice
- `am_michael` - Male, clear voice
- `bf_emma` - Female, British accent
- `bf_isabella` - Female, British accent
- `bm_george` - Male, British accent
- `bm_lewis` - Male, British accent

## Integration with Electron App

The service is configured with CORS to work with Electron applications. The frontend can make requests to:

```javascript
// Transcription
const formData = new FormData();
formData.append('audio', audioBlob);
const response = await fetch('http://localhost:8000/api/v1/speech/transcribe', {
  method: 'POST',
  body: formData
});

// Speech synthesis
const response = await fetch('http://localhost:8000/api/v1/speech/synthesize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'Hello world',
    voice: 'af_heart'
  })
});
const audioBlob = await response.blob();
```

## Troubleshooting

### Common Issues

1. **Models not loading**: Ensure you have sufficient disk space and memory
2. **CUDA errors**: The service works with CPU-only inference if CUDA is not available
3. **Audio format errors**: Ensure audio files are in supported formats (WAV, MP3, M4A)
4. **Port conflicts**: Change the port using `--port` parameter or `PORT` environment variable

### Logs

The service provides detailed logging. Increase log level for debugging:
```bash
LOG_LEVEL=DEBUG python start_service.py
```

## Performance Notes

- **First Request**: Initial requests may be slower due to model initialization
- **Memory Usage**: Whisper and Kokoro models require significant memory
- **CPU vs GPU**: The service will use GPU if available, otherwise falls back to CPU
- **Concurrent Requests**: The service handles multiple requests concurrently

## Development

### Project Structure
```
python_service/
├── main.py                 # FastAPI application
├── start_service.py        # Startup script
├── requirements.txt        # Dependencies
├── services/
│   └── speech_service.py   # Core speech processing logic
├── models/
│   └── api_models.py       # Pydantic models
├── config/
│   └── settings.py         # Configuration
└── utils/
    └── logger.py           # Logging utilities
```

### Adding New Features

1. Add new endpoints in `main.py`
2. Implement business logic in `services/speech_service.py`
3. Define request/response models in `models/api_models.py`
4. Update configuration in `config/settings.py`