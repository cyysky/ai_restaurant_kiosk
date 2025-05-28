"""
Speech service that handles Whisper (STT) and Kokoro (TTS) models.
Models are loaded once during initialization to avoid performance issues.
"""

import asyncio
import io
import tempfile
import os
import logging
from typing import Dict, Any, List, Optional
import numpy as np
import soundfile as sf
import whisper
from kokoro import KPipeline
import torch

logger = logging.getLogger(__name__)

class SpeechService:
    """Service for speech-to-text and text-to-speech processing."""
    
    def __init__(self, settings):
        self.settings = settings
        self.whisper_model = None
        self.kokoro_pipeline = None
        self._initialized = False
        
    async def initialize(self):
        """Initialize Whisper and Kokoro models (called once at startup)."""
        if self._initialized:
            return
            
        logger.info("Loading Whisper model...")
        try:
            # Load Whisper model - using 'turbo' for good balance of speed and accuracy
            self.whisper_model = whisper.load_model("turbo")
            logger.info("Whisper model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            raise
        
        logger.info("Loading Kokoro TTS pipeline...")
        try:
            # Initialize Kokoro pipeline with language code 'a' (auto)
            self.kokoro_pipeline = KPipeline(lang_code='a')
            logger.info("Kokoro TTS pipeline loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load Kokoro pipeline: {e}")
            raise
            
        self._initialized = True
        logger.info("Speech service initialization complete")
    
    async def get_health_status(self) -> Dict[str, bool]:
        """Get health status of speech models."""
        return {
            "whisper": self.whisper_model is not None,
            "kokoro": self.kokoro_pipeline is not None,
            "initialized": self._initialized
        }
    
    async def transcribe_audio(self, audio_data: bytes, language: str = "auto") -> Dict[str, Any]:
        """
        Transcribe audio to text using Whisper.
        
        Args:
            audio_data: Raw audio data
            language: Language code for transcription
            
        Returns:
            Dictionary with transcription results
        """
        if not self._initialized or self.whisper_model is None:
            raise RuntimeError("Whisper model not initialized")
        
        try:
            # Save audio data to temporary file
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                temp_file.write(audio_data)
                temp_file_path = temp_file.name
            
            try:
                # Transcribe using Whisper
                logger.info(f"Transcribing audio file: {temp_file_path}")
                
                # Run transcription in thread pool to avoid blocking
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(
                    None, 
                    self._transcribe_sync, 
                    temp_file_path, 
                    language
                )
                
                return {
                    "text": result["text"].strip(),
                    "language": result.get("language", "unknown"),
                    "confidence": self._calculate_confidence(result),
                    "duration": result.get("duration", 0.0)
                }
                
            finally:
                # Clean up temporary file
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                    
        except Exception as e:
            logger.error(f"Transcription error: {e}")
            raise RuntimeError(f"Transcription failed: {str(e)}")
    
    def _transcribe_sync(self, audio_path: str, language: str) -> Dict[str, Any]:
        """Synchronous transcription method."""
        options = {}
        if language != "auto":
            options["language"] = language
            
        return self.whisper_model.transcribe(audio_path, **options)
    
    def _calculate_confidence(self, result: Dict[str, Any]) -> float:
        """Calculate confidence score from Whisper result."""
        # Whisper doesn't provide direct confidence scores
        # We can estimate based on segment probabilities if available
        if "segments" in result:
            segments = result["segments"]
            if segments:
                # Average the probability scores from segments
                probs = [seg.get("avg_logprob", 0.0) for seg in segments]
                if probs:
                    # Convert log probabilities to confidence (0-1)
                    avg_logprob = sum(probs) / len(probs)
                    return max(0.0, min(1.0, np.exp(avg_logprob)))
        
        # Default confidence if no segments available
        return 0.8
    
    async def synthesize_speech(
        self, 
        text: str, 
        voice: str = "af_heart", 
        speed: float = 1.0, 
        pitch: float = 1.0
    ) -> bytes:
        """
        Synthesize speech from text using Kokoro TTS.
        
        Args:
            text: Text to synthesize
            voice: Voice to use for synthesis
            speed: Speech speed multiplier
            pitch: Pitch adjustment (not directly supported by Kokoro)
            
        Returns:
            Audio data as bytes (WAV format)
        """
        if not self._initialized or self.kokoro_pipeline is None:
            raise RuntimeError("Kokoro pipeline not initialized")
        
        try:
            logger.info(f"Synthesizing speech for text: {text[:50]}...")
            
            # Run synthesis in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            audio_data = await loop.run_in_executor(
                None, 
                self._synthesize_sync, 
                text, 
                voice
            )
            
            # Apply speed adjustment if needed
            if speed != 1.0:
                audio_data = self._adjust_speed(audio_data, speed)
            
            # Convert numpy array to WAV bytes
            wav_bytes = self._audio_to_wav_bytes(audio_data, sample_rate=24000)
            
            return wav_bytes
            
        except Exception as e:
            logger.error(f"Speech synthesis error: {e}")
            raise RuntimeError(f"Speech synthesis failed: {str(e)}")
    
    def _synthesize_sync(self, text: str, voice: str) -> np.ndarray:
        """Synchronous speech synthesis method."""
        generator = self.kokoro_pipeline(text, voice=voice)
        
        # Collect all audio segments
        audio_segments = []
        for i, (gs, ps, audio) in enumerate(generator):
            logger.debug(f"Generated segment {i}: gs={gs}, ps={ps}")
            audio_segments.append(audio)
        
        # Concatenate all segments
        if audio_segments:
            return np.concatenate(audio_segments)
        else:
            # Return silence if no audio generated
            return np.zeros(24000, dtype=np.float32)  # 1 second of silence
    
    def _adjust_speed(self, audio: np.ndarray, speed: float) -> np.ndarray:
        """Adjust audio speed by resampling."""
        if speed == 1.0:
            return audio
        
        # Simple speed adjustment by changing sample rate
        # This is a basic implementation - more sophisticated methods could be used
        try:
            import librosa
            return librosa.effects.time_stretch(audio, rate=speed)
        except ImportError:
            # Fallback: simple resampling
            if speed > 1.0:
                # Speed up by skipping samples
                step = int(speed)
                return audio[::step]
            else:
                # Slow down by repeating samples
                repeat = int(1.0 / speed)
                return np.repeat(audio, repeat)
    
    def _audio_to_wav_bytes(self, audio: np.ndarray, sample_rate: int = 24000) -> bytes:
        """Convert audio numpy array to WAV bytes."""
        # Create in-memory buffer
        buffer = io.BytesIO()
        
        # Write audio to buffer as WAV
        sf.write(buffer, audio, sample_rate, format='WAV')
        
        # Get bytes
        buffer.seek(0)
        return buffer.read()
    
    async def get_available_voices(self) -> List[str]:
        """Get list of available Kokoro voices."""
        # Common Kokoro voices - this could be made configurable
        return [
            "af_heart",
            "af_sky", 
            "af_bella",
            "af_sarah",
            "am_adam",
            "am_michael",
            "bf_emma",
            "bf_isabella",
            "bm_george",
            "bm_lewis"
        ]
    
    async def cleanup(self):
        """Cleanup resources."""
        logger.info("Cleaning up speech service...")
        
        # Clear models to free memory
        if self.whisper_model is not None:
            del self.whisper_model
            self.whisper_model = None
        
        if self.kokoro_pipeline is not None:
            del self.kokoro_pipeline
            self.kokoro_pipeline = None
        
        # Clear CUDA cache if available
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        self._initialized = False
        logger.info("Speech service cleanup complete")