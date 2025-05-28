"""
API models for request and response handling.
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

class TranscriptionResponse(BaseModel):
    """Response model for speech transcription."""
    text: str = Field(..., description="Transcribed text")
    language: str = Field(..., description="Detected or specified language")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score")
    duration: float = Field(..., ge=0.0, description="Audio duration in seconds")

class SynthesisRequest(BaseModel):
    """Request model for speech synthesis."""
    text: str = Field(..., min_length=1, max_length=1000, description="Text to synthesize")
    voice: str = Field(default="af_heart", description="Voice to use for synthesis")
    speed: float = Field(default=1.0, ge=0.5, le=2.0, description="Speech speed multiplier")
    pitch: float = Field(default=1.0, ge=0.5, le=2.0, description="Pitch adjustment")

class HealthResponse(BaseModel):
    """Response model for health check."""
    status: str = Field(..., description="Overall service status")
    services: Dict[str, bool] = Field(..., description="Individual service status")
    version: str = Field(..., description="Service version")

class ErrorResponse(BaseModel):
    """Response model for errors."""
    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Detailed error information")
    code: Optional[str] = Field(None, description="Error code")