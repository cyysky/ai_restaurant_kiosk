"""
Configuration settings for the speech processing service.
"""

import os
from typing import List

class Settings:
    """Application settings."""
    
    # Server configuration
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    # CORS configuration
    CORS_ORIGINS: List[str] = [
        "http://localhost:*",
        "http://127.0.0.1:*",
        "file://*",  # For Electron apps
        "*"  # Allow all for development
    ]
    
    # Speech processing settings
    MAX_TEXT_LENGTH: int = int(os.getenv("MAX_TEXT_LENGTH", "1000"))
    MAX_AUDIO_SIZE: int = int(os.getenv("MAX_AUDIO_SIZE", "10485760"))  # 10MB
    
    # Whisper settings
    WHISPER_MODEL: str = os.getenv("WHISPER_MODEL", "turbo")
    
    # Kokoro settings
    KOKORO_LANG_CODE: str = os.getenv("KOKORO_LANG_CODE", "a")
    DEFAULT_VOICE: str = os.getenv("DEFAULT_VOICE", "af_heart")
    
    # Logging settings
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # Model paths (if using local models)
    MODELS_DIR: str = os.getenv("MODELS_DIR", "./models")
    
    def __init__(self):
        """Initialize settings and create necessary directories."""
        os.makedirs(self.MODELS_DIR, exist_ok=True)