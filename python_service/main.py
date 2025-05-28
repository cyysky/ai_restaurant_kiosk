"""
FastAPI backend service for speech processing with Whisper (STT) and Kokoro (TTS) integration.
"""

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import uvicorn

from services.speech_service import SpeechService
from models.api_models import TranscriptionResponse, SynthesisRequest, HealthResponse
from utils.logger import setup_logger
from config.settings import Settings

# Initialize settings and logger
settings = Settings()
logger = setup_logger(__name__)

# Global speech service instance (loaded once)
speech_service = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown events."""
    global speech_service
    
    # Startup - Load models once
    logger.info("Starting speech processing service...")
    try:
        speech_service = SpeechService(settings)
        await speech_service.initialize()
        logger.info("Speech service initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize speech service: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down speech processing service...")
    if speech_service:
        await speech_service.cleanup()

# Create FastAPI app
app = FastAPI(
    title="Speech Processing Service",
    description="FastAPI backend for speech-to-text and text-to-speech processing",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS for Electron frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for Electron app
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/v1/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    try:
        if speech_service is None:
            raise HTTPException(status_code=503, detail="Speech service not initialized")
        
        status = await speech_service.get_health_status()
        return HealthResponse(
            status="healthy" if status["whisper"] and status["kokoro"] else "degraded",
            services=status,
            version="1.0.0"
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail="Health check failed")

@app.post("/api/v1/speech/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    audio: UploadFile = File(..., description="Audio file to transcribe"),
    language: str = Form("auto", description="Language code (auto for auto-detection)")
):
    """
    Transcribe audio to text using Whisper.
    
    Args:
        audio: Audio file (WAV, MP3, M4A, etc.)
        language: Language code for transcription (optional, auto-detects if not specified)
    
    Returns:
        TranscriptionResponse with transcribed text and metadata
    """
    if speech_service is None:
        raise HTTPException(status_code=503, detail="Speech service not available")
    
    try:
        # Validate file type
        if not audio.content_type or not audio.content_type.startswith('audio/'):
            raise HTTPException(status_code=400, detail="Invalid audio file format")
        
        # Read audio data
        audio_data = await audio.read()
        
        # Transcribe audio using pre-loaded Whisper model
        result = await speech_service.transcribe_audio(audio_data, language)
        
        return TranscriptionResponse(
            text=result["text"],
            language=result["language"],
            confidence=result.get("confidence", 0.0),
            duration=result.get("duration", 0.0)
        )
        
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

@app.post("/api/v1/speech/synthesize")
async def synthesize_speech(request: SynthesisRequest):
    """
    Synthesize speech from text using Kokoro TTS.
    
    Args:
        request: SynthesisRequest containing text and voice parameters
    
    Returns:
        Audio data as WAV file
    """
    if speech_service is None:
        raise HTTPException(status_code=503, detail="Speech service not available")
    
    try:
        # Validate input
        if not request.text or len(request.text.strip()) == 0:
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        if len(request.text) > 1000:  # Reasonable limit
            raise HTTPException(
                status_code=400, 
                detail="Text too long. Maximum length: 1000 characters"
            )
        
        # Synthesize speech using pre-loaded Kokoro model
        audio_data = await speech_service.synthesize_speech(
            text=request.text,
            voice=request.voice,
            speed=request.speed,
            pitch=request.pitch
        )
        
        return Response(
            content=audio_data,
            media_type="audio/wav",
            headers={
                "Content-Disposition": "attachment; filename=synthesized_speech.wav"
            }
        )
        
    except Exception as e:
        logger.error(f"Speech synthesis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Speech synthesis failed: {str(e)}")

@app.get("/api/v1/speech/voices")
async def get_available_voices():
    """Get list of available TTS voices."""
    if speech_service is None:
        raise HTTPException(status_code=503, detail="Speech service not available")
    
    try:
        voices = await speech_service.get_available_voices()
        return {"voices": voices}
    except Exception as e:
        logger.error(f"Failed to get voices: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get voices: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,  # Disable reload to prevent model reloading
        log_level="info"
    )