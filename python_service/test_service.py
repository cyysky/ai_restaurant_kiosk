#!/usr/bin/env python3
"""
Test script for the speech processing service.
"""

import asyncio
import aiohttp
import json
import io
import wave
import numpy as np
from pathlib import Path

async def test_health_check(session, base_url):
    """Test the health check endpoint."""
    print("Testing health check...")
    try:
        async with session.get(f"{base_url}/api/v1/health") as response:
            if response.status == 200:
                data = await response.json()
                print(f"✓ Health check passed: {data['status']}")
                return True
            else:
                print(f"✗ Health check failed: {response.status}")
                return False
    except Exception as e:
        print(f"✗ Health check error: {e}")
        return False

async def test_voices(session, base_url):
    """Test the voices endpoint."""
    print("Testing voices endpoint...")
    try:
        async with session.get(f"{base_url}/api/v1/speech/voices") as response:
            if response.status == 200:
                data = await response.json()
                voices = data.get('voices', [])
                print(f"✓ Available voices ({len(voices)}): {', '.join(voices[:5])}...")
                return True
            else:
                print(f"✗ Voices endpoint failed: {response.status}")
                return False
    except Exception as e:
        print(f"✗ Voices endpoint error: {e}")
        return False

def create_test_audio():
    """Create a simple test audio file."""
    # Generate a simple sine wave
    sample_rate = 16000
    duration = 2.0  # seconds
    frequency = 440  # Hz (A note)
    
    t = np.linspace(0, duration, int(sample_rate * duration))
    audio_data = np.sin(2 * np.pi * frequency * t) * 0.3
    
    # Convert to 16-bit PCM
    audio_data = (audio_data * 32767).astype(np.int16)
    
    # Create WAV file in memory
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav_file:
        wav_file.setnchannels(1)  # Mono
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_data.tobytes())
    
    buffer.seek(0)
    return buffer.getvalue()

async def test_transcription(session, base_url):
    """Test the transcription endpoint."""
    print("Testing transcription...")
    try:
        # Create test audio
        audio_data = create_test_audio()
        
        # Prepare form data
        data = aiohttp.FormData()
        data.add_field('audio', audio_data, filename='test.wav', content_type='audio/wav')
        data.add_field('language', 'auto')
        
        async with session.post(f"{base_url}/api/v1/speech/transcribe", data=data) as response:
            if response.status == 200:
                result = await response.json()
                print(f"✓ Transcription successful: '{result['text'][:50]}...'")
                print(f"  Language: {result['language']}, Confidence: {result['confidence']:.2f}")
                return True
            else:
                error_text = await response.text()
                print(f"✗ Transcription failed: {response.status} - {error_text}")
                return False
    except Exception as e:
        print(f"✗ Transcription error: {e}")
        return False

async def test_synthesis(session, base_url):
    """Test the speech synthesis endpoint."""
    print("Testing speech synthesis...")
    try:
        payload = {
            "text": "Hello, this is a test of the speech synthesis system.",
            "voice": "af_heart",
            "speed": 1.0,
            "pitch": 1.0
        }
        
        async with session.post(
            f"{base_url}/api/v1/speech/synthesize",
            json=payload,
            headers={"Content-Type": "application/json"}
        ) as response:
            if response.status == 200:
                audio_data = await response.read()
                print(f"✓ Speech synthesis successful: {len(audio_data)} bytes of audio")
                
                # Optionally save the audio file
                output_file = Path("test_output.wav")
                with open(output_file, "wb") as f:
                    f.write(audio_data)
                print(f"  Audio saved to: {output_file}")
                return True
            else:
                error_text = await response.text()
                print(f"✗ Speech synthesis failed: {response.status} - {error_text}")
                return False
    except Exception as e:
        print(f"✗ Speech synthesis error: {e}")
        return False

async def run_tests(base_url="http://localhost:8000"):
    """Run all tests."""
    print(f"Testing Speech Processing Service at {base_url}")
    print("=" * 50)
    
    async with aiohttp.ClientSession() as session:
        tests = [
            test_health_check,
            test_voices,
            test_synthesis,
            test_transcription,  # Test transcription last as it's most likely to have issues
        ]
        
        results = []
        for test_func in tests:
            result = await test_func(session, base_url)
            results.append(result)
            print()
        
        # Summary
        passed = sum(results)
        total = len(results)
        print("=" * 50)
        print(f"Test Results: {passed}/{total} tests passed")
        
        if passed == total:
            print("✓ All tests passed!")
        else:
            print("✗ Some tests failed. Check the service logs for details.")
        
        return passed == total

def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Test Speech Processing Service")
    parser.add_argument("--url", default="http://localhost:8000", help="Service URL")
    args = parser.parse_args()
    
    try:
        success = asyncio.run(run_tests(args.url))
        exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\nTest interrupted by user")
        exit(1)
    except Exception as e:
        print(f"Test failed with error: {e}")
        exit(1)

if __name__ == "__main__":
    main()