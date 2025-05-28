# Electron Renderer Process Crash Debugging Guide

## Overview
This guide documents the comprehensive debugging setup added to diagnose and fix the "Renderer process crashed! { killed: false }" error in the AI kiosk system.

## Changes Made

### 1. Main Process (main.js)
- **Fixed deprecated event handler**: Replaced `'crashed'` event with `'render-process-gone'` event
- **Enhanced crash logging**: Added detailed crash information including memory usage and active handles
- **Automatic recovery**: Attempts to reload renderer process on unexpected crashes

### 2. Speech Manager (speech_manager.js)
- **Resource tracking**: Comprehensive tracking of AudioContext, MediaRecorder, and Stream instances
- **Memory monitoring**: Automatic memory usage warnings and snapshots
- **Error history**: Detailed logging of all errors with context and stack traces
- **Global error handlers**: Catches unhandled promise rejections and errors
- **Enhanced cleanup**: Improved resource cleanup in all error scenarios
- **Timeout/interval tracking**: Tracks all active timeouts and intervals to prevent leaks

### 3. Application Controller (app.js)
- **Global error handling**: Prevents crashes from unhandled errors and promise rejections
- **Error logging**: Comprehensive error tracking with application state context
- **Critical error recovery**: Automatic state reset and user notification on critical errors

## Key Debugging Features

### Resource Tracking
```javascript
debugInfo = {
    audioContextCount: 0,        // Number of active AudioContext instances
    mediaRecorderCount: 0,       // Number of active MediaRecorder instances
    streamCount: 0,              // Number of active audio streams
    activeTimeouts: new Set(),   // Active setTimeout references
    activeIntervals: new Set(),  // Active setInterval references
    memorySnapshots: [],         // Memory usage over time
    errorHistory: []             // Detailed error log
}
```

### Memory Monitoring
- Automatic warnings when memory usage exceeds 50MB
- Memory snapshots at critical points in the speech processing pipeline
- Detection of multiple AudioContext instances (potential leak)

### Error Context
Every error is logged with:
- Error type and message
- Stack trace
- Current application state
- Speech manager state
- Memory usage
- Active resource counts

## How to Use

### 1. Enable Debugging
Start the application with logging enabled:
```bash
npm start -- --enable-logging
```

### 2. Monitor Console Output
Look for these debug markers:
- `🔍` - General debugging information
- `⚠️` - Warnings about potential issues
- `🚨` - Critical errors
- `✅` - Successful operations

### 3. Get Debug Information
In the browser console:
```javascript
// Get current debug state
getDebugState()

// Get speech manager debug info
window.kioskApp.speechManager.getDebugInfo()

// Get application error history
window.kioskApp.errorHistory
```

### 4. Run Debug Test
Load the debug test script in the console:
```javascript
// Copy and paste the contents of debug_test.js
```

## Most Likely Crash Causes Identified

### 1. AudioContext Memory Leaks
- **Symptom**: Multiple AudioContext instances created without proper cleanup
- **Fix**: Enhanced tracking and proper cleanup in destroy() method
- **Detection**: Warnings when audioContextCount > 1

### 2. Unhandled Promise Rejections in Audio Processing
- **Symptom**: Errors in convertToWav() or processRecordedAudio() not properly caught
- **Fix**: Comprehensive try-catch blocks and global error handlers
- **Detection**: Detailed logging in audio processing pipeline

### 3. MediaRecorder Resource Leaks
- **Symptom**: MediaRecorder instances not properly cleaned up on errors
- **Fix**: Enhanced error handling in MediaRecorder event handlers
- **Detection**: Resource count tracking and cleanup verification

## Monitoring Points

### Critical Operations
1. **AudioContext Creation/Destruction**
   - Before/after audio context initialization
   - State changes (suspended, running, closed)

2. **Speech Recognition Lifecycle**
   - Start listening (microphone access, MediaRecorder setup)
   - Audio processing (blob creation, WAV conversion)
   - Stop listening (resource cleanup)

3. **Error Scenarios**
   - MediaRecorder errors
   - AudioContext decode failures
   - Network timeouts
   - Permission denials

### Memory Checkpoints
- Before/after audio context initialization
- Before/after WAV conversion
- Before/after audio processing
- During error cleanup
- Application destruction

## Expected Log Output

### Normal Operation
```
🔍 Audio context initialized, total count: 1
🔍 Microphone access granted, stream count: 1
🔍 MediaRecorder created, count: 1
🔍 Audio chunk received, size: 1024, total chunks: 1
🔍 Processing recorded audio, chunks: 5
🔍 WAV conversion completed, size: 44100
🔍 Speech recognition stopped successfully
```

### Error Scenario
```
🚨 MediaRecorder error: NotAllowedError
🔍 Starting MediaRecorder error cleanup...
🔍 MediaRecorder error cleanup completed
🔍 RESOURCE STATE: { context: 'mediarecorder_error', audioContextCount: 1, ... }
```

## Recovery Mechanisms

### Automatic Recovery
1. **Global error handlers** prevent renderer crashes
2. **State reset** on critical errors
3. **Resource cleanup** on all error paths
4. **User notification** of issues with fallback options

### Manual Recovery
1. **Reload application** if issues persist
2. **Clear browser cache** to reset state
3. **Restart Electron application**

## Performance Monitoring

### Memory Thresholds
- **Warning**: > 50MB heap usage
- **Critical**: > 100MB heap usage
- **Resource leak**: Multiple AudioContext instances

### Resource Limits
- **Max AudioContext**: 1 instance
- **Max MediaRecorder**: 1 instance per session
- **Max Streams**: 1 active stream
- **Timeout cleanup**: All timeouts cleared on destroy

## Next Steps

1. **Run the application** with debugging enabled
2. **Reproduce the crash** scenario
3. **Analyze the logs** for patterns
4. **Check resource counts** before crash
5. **Review error history** for unhandled exceptions

The comprehensive debugging setup should now provide clear visibility into the crash cause and prevent most renderer process crashes through improved error handling and resource management.