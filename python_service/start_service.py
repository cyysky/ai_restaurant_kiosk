#!/usr/bin/env python3
"""
Startup script for the speech processing service.
"""

import os
import sys
import subprocess
import argparse
from pathlib import Path

def check_dependencies():
    """Check if required dependencies are installed."""
    try:
        import fastapi
        import uvicorn
        import whisper
        import kokoro
        import soundfile
        import torch
        print("✓ All dependencies are installed")
        return True
    except ImportError as e:
        print(f"✗ Missing dependency: {e}")
        return False

def install_dependencies():
    """Install dependencies from requirements.txt."""
    requirements_file = Path(__file__).parent / "requirements.txt"
    if not requirements_file.exists():
        print("✗ requirements.txt not found")
        return False
    
    print("Installing dependencies...")
    try:
        subprocess.check_call([
            sys.executable, "-m", "pip", "install", "-r", str(requirements_file)
        ])
        print("✓ Dependencies installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Failed to install dependencies: {e}")
        return False

def start_service(host="0.0.0.0", port=8000, reload=False):
    """Start the FastAPI service."""
    print(f"Starting speech processing service on {host}:{port}")
    
    # Set environment variables
    os.environ.setdefault("HOST", host)
    os.environ.setdefault("PORT", str(port))
    
    try:
        import uvicorn
        uvicorn.run(
            "main:app",
            host=host,
            port=port,
            reload=reload,
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\n✓ Service stopped")
    except Exception as e:
        print(f"✗ Failed to start service: {e}")
        return False
    
    return True

def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Speech Processing Service")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind to")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload")
    parser.add_argument("--install", action="store_true", help="Install dependencies")
    parser.add_argument("--check", action="store_true", help="Check dependencies")
    
    args = parser.parse_args()
    
    # Change to script directory
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    if args.install:
        if not install_dependencies():
            sys.exit(1)
        return
    
    if args.check:
        if not check_dependencies():
            print("\nRun with --install to install missing dependencies")
            sys.exit(1)
        return
    
    # Check dependencies before starting
    if not check_dependencies():
        print("\nMissing dependencies. Run with --install to install them.")
        sys.exit(1)
    
    # Start the service
    start_service(args.host, args.port, args.reload)

if __name__ == "__main__":
    main()