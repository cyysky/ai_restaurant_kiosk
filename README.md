# AI-Powered Kiosk System with llama3.1

Video Introduction
https://www.facebook.com/share/v/1APmyuPXqz/

[![Tests](https://img.shields.io/badge/tests-70%2F70%20passing-brightgreen)](tests/README.md)
[![Coverage](https://img.shields.io/badge/coverage-90%25+-brightgreen)](tests/README.md)
[![Jest](https://img.shields.io/badge/tested%20with-Jest-blue)](https://jestjs.io/)

A sophisticated offline AI kiosk system featuring a digital avatar, natural language understanding powered by llama3.1, and dual-mode interaction (voice + touch).

## Features

### Phase 1 Implementation ✅

- **Electron-based Kiosk Application**: Full-screen kiosk mode with touch-optimized UI
- **llama3.1 Integration**: Local LLM with OpenAI-compatible API for advanced NLU
- **Dual-Mode Interaction**: Voice commands and touch navigation
- **Digital Avatar**: Animated avatar with emotional responses and speech feedback
- **Offline Operation**: Complete functionality without internet connection
- **Advanced Speech Processing**: Web Speech API for STT/TTS
- **Smart Cart Management**: Real-time cart updates with persistence
- **Comprehensive Menu System**: Category-based navigation with detailed item information

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Testing](#testing)
- [Starting the System](#starting-the-system)
- [Usage](#usage)
- [Troubleshooting](#troubleshooting)
- [Customization](#customization)
- [API Reference](#api-reference)
- [Performance Optimization](#performance-optimization)
- [Security Considerations](#security-considerations)
- [Future Enhancements](#future-enhancements-planned)
- [Support](#support)
- [License](#license)

## Architecture

```
/ai-kiosk-system/
├── /app/                     # Main application source
│   ├── /ui/                  # Frontend UI components
│   ├── /orchestrator/        # System orchestrator
│   ├── /nlu/                 # NLU engine with llama3.1
│   ├── /dialog_manager/      # Dialog management
│   ├── /menu_engine/         # Menu & ordering logic
│   └── /data_store/          # Local data storage
├── /tests/                   # Comprehensive test suite
│   ├── /unit/                # Unit tests
│   ├── /integration/         # Integration tests
│   └── setup.js              # Test configuration
├── /config/                  # Configuration files
├── /data/                    # Menu data and models
├── main.js                   # Electron main process
├── jest.config.js            # Jest test configuration
└── package.json              # Dependencies
```

## Prerequisites

### System Requirements
- **OS**: Windows 10/11, macOS 10.14+, or Linux (Ubuntu 18.04+)
- **RAM**: Minimum 8GB (16GB recommended for llama3.1)
- **Storage**: 10GB free space
- **CPU**: Multi-core processor (Intel i5/AMD Ryzen 5 or better)
- **GPU**: NVIDIA GPU with at least 12GB VRAM strongly recommended for optimal performance, especially for local speech processing (Whisper) and LLM (llama3.1).

### Software Dependencies
- **Node.js**: Version 18.0 or higher
- **Ollama**: For running llama3.1 locally
- **Git**: For cloning the repository

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd ai-kiosk-system
```

### 2. Install Node.js Dependencies
```bash
npm install
```

### 3. Install and Setup Ollama

#### Windows:
1. Download Ollama from https://ollama.ai/download
2. Install the application
3. Open Command Prompt and run:
```cmd
ollama pull llama3.1:latest
```

#### macOS:
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull llama3.1 model
ollama pull llama3.1:latest
```

#### Linux:
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull llama3.1 model
ollama pull llama3.1:latest
```

### 4. Start Ollama Server
```bash
# Start Ollama server (runs on http://localhost:11434)
ollama serve
```

### 5. Verify llama3.1 Installation
```bash
# Test the model
ollama run llama3.1:latest "Hello, how are you?"
```

## Configuration

### LLM Configuration (`config/llm_config.json`)
```json
{
  "baseURL": "http://localhost:11434/v1",
  "model": "llama3.1:latest",
  "temperature": 0.7,
  "maxTokens": 1500,
  "timeout": 10000
}
```

### Customizing Prompts (`config/prompt_config.json`)
- Modify conversation prompts for different responses
- Adjust system prompts for specific restaurant needs
- Configure error handling messages

### NLU Settings (`config/nlu_config.json`)
- Adjust confidence thresholds
- Enable/disable fallback mechanisms
- Configure intent recognition parameters

## Running the Application

### Development Mode
```bash
npm run dev
```
This starts the application in windowed mode with developer tools enabled.

### Production Mode (Kiosk)
```bash
npm start
```
This starts the application in full-screen kiosk mode.

### Debug Modes
The application includes several debugging options for development and troubleshooting:

#### Full Debug Mode (Recommended for Development)
```bash
npm run debug
```
Enables development mode + remote debugging + enhanced logging.

#### Remote Debugging Only
```bash
npm run debug:remote
```
Enables development mode + remote debugging on port 9222.
- Access Chrome DevTools at: `chrome://inspect/#devices`
- Or navigate to: `chrome://inspect` in Chrome browser

#### Enhanced Logging Only
```bash
npm run debug:logging
```
Enables development mode + enhanced console logging for frontend errors.

#### Production Debug Mode
```bash
npm run debug:prod
```
Enables remote debugging + enhanced logging in production (full-screen) mode.

#### Manual Debug Flags
You can also manually add debug flags to any npm script:
```bash
# Custom combinations
electron . --dev --remote-debugging-port=9222
electron . --enable-logging
electron . --dev --remote-debugging-port=9222 --enable-logging
```

### Debug Features
When debugging flags are enabled, you'll see:
- 🐛 Remote debugging status and connection instructions
- 📝 Enhanced logging for frontend errors and crashes
- 🔧 Development mode indicators
- Console output for renderer process events (crashes, unresponsive states)
- Detailed frontend console messages with source locations

## Testing

The application includes a comprehensive testing suite built with Jest, providing unit tests, integration tests, and automated testing workflows.

### Quick Testing Commands

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run tests with coverage report
npm run test:coverage

# Watch mode for development
npm run test:watch

# CI mode (coverage + bail on failure)
npm run test:ci
```

### Test Coverage

The testing suite includes **70+ comprehensive tests** covering:

- ✅ **Menu Engine**: Menu management, cart operations, order processing (53 tests)
- ✅ **System Orchestrator**: Component coordination and speech processing
- ✅ **Main Process**: Electron application lifecycle and IPC communication
- ✅ **Preload Script**: IPC bridge functionality and API exposure
- ✅ **Integration Tests**: Full application workflow testing
- ✅ **Test Environment**: Mock validation and setup verification (17 tests)

### Test Results

Current test status: **70/70 tests passing** ✅

```
Test Suites: 2 passed, 2 total
Tests:       70 passed, 70 total
Snapshots:   0 total
Time:        ~0.5s
```

### Advanced Testing Options

```bash
# Custom test runner with options
node tests/run-tests.js [options]

# Available options:
--coverage, -c         Generate coverage report
--watch, -w           Watch mode for continuous testing
--verbose, -v         Verbose output
--unit, -u            Run only unit tests
--integration, -i     Run only integration tests
--bail, -b            Stop on first test failure
--silent, -s          Minimal output
--help, -h            Show help message
```

### Testing Documentation

For detailed testing information, see:
- [`tests/README.md`](tests/README.md) - Comprehensive testing documentation
- [`TESTING_SUMMARY.md`](TESTING_SUMMARY.md) - Testing implementation summary
- [`jest.config.js`](jest.config.js) - Jest configuration

### Testing Individual Components (Legacy)
```bash
# Test speech recognition
node test/test_speech.js

# Test NLU engine
node test/test_nlu.js

# Test menu system
node test/test_menu.js
```

## Starting the System

To run the complete AI Kiosk System, you need to start both the Python speech processing service and the main Electron application.

### 1. Start the Python Speech Service

The Python service handles Speech-to-Text (STT) and Text-to-Speech (TTS).

**Prerequisites:**
- Ensure Python 3.8+ is installed.
- Install dependencies (if not already done during initial setup):
  ```bash
  cd python_service
  pip install -r requirements.txt
  cd ..
  ```
  Alternatively, you can use the startup script for installation:
  ```bash
  cd python_service
  python start_service.py --install
  cd ..
  ```

**Start the service:**
Open a new terminal and run:
```bash
cd python_service
python start_service.py
```
Or, for manual start (if `start_service.py` is not used):
```bash
cd python_service
python main.py
```
This service typically runs on `http://localhost:8000`. Keep this terminal window open.

### 2. Start the Main Kiosk Application

Once the Python service is running, you can start the main Electron application.

Open another new terminal and run:
```bash
# For production/kiosk mode (recommended for full experience)
npm start

# Or, for development mode
npm run dev
```

The Kiosk application will connect to the Python service for speech functionalities. Ensure Ollama with llama3.1:latest is also running as per the "Installation" section if you haven't started it yet.
## Usage

### Voice Interaction
1. Click the "Tap to Speak" button or press `Ctrl+Space`
2. Speak your order naturally:
   - "I'd like a burger and fries"
   - "Show me the appetizers"
   - "Add two chicken wings to my cart"
   - "What's in my order?"
   - "I'm ready to checkout"

### Touch Interaction
1. Browse menu categories by tapping category buttons
2. Select items to view details and add to cart
3. Manage cart quantities with +/- buttons
4. Proceed to checkout when ready

### Switching Modes
- Use the mode toggle buttons at the bottom
- Seamlessly switch between voice and touch at any time
- Cart state is preserved across mode changes

## Troubleshooting

### Common Issues

#### llama3.1 Not Responding
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Restart Ollama service
ollama serve

# Verify model is available
ollama list
```

#### Speech Recognition Not Working
- Ensure microphone permissions are granted
- Check browser compatibility (Chrome/Edge recommended)
- Verify microphone is not muted or used by other applications

#### Touch Interface Issues
- Ensure screen is calibrated for touch input
- Check for conflicting mouse/touch drivers
- Verify display scaling settings

#### Performance Issues
- Close unnecessary applications to free RAM
- Consider using GPU acceleration for Ollama
- Adjust model parameters in `config/llm_config.json`

### Debug Mode
```bash
# Enable full debug mode with remote debugging and enhanced logging
npm run debug

# Enable only remote debugging (Chrome DevTools)
npm run debug:remote

# Enable only enhanced logging
npm run debug:logging

# Debug in production mode (full-screen)
npm run debug:prod
```

#### Using Remote Debugging
1. Start the app with remote debugging enabled:
   ```bash
   npm run debug:remote
   ```
2. Open Chrome browser and navigate to: `chrome://inspect`
3. Click "Configure" and ensure `localhost:9222` is listed
4. Click "inspect" under your Electron app to open DevTools
5. Debug the renderer process directly in Chrome DevTools

#### Enhanced Logging Output
When `--enable-logging` is enabled, you'll see detailed console output:
```
🐛 Remote debugging enabled on port 9222
📝 Enhanced logging enabled
🔧 Development mode enabled
🚀 Electron app ready, initializing kiosk application...
[FRONTEND ERROR] TypeError: Cannot read property 'x' of undefined
  at app.js:123
```

## Customization

### Adding Menu Items
Edit `data/menu/menu.json` to add new categories, items, or modify existing ones:
```json
{
  "id": 99,
  "name": "New Item",
  "description": "Description here",
  "price": 9.99,
  "category": "mains"
}
```

### Customizing Avatar
- Modify avatar animations in `app/ui/styles/avatar.css`
- Add new emotions and gestures in `app/ui/scripts/avatar_manager.js`
- Customize speech responses in `config/prompt_config.json`

### Branding
- Update restaurant name and logo in `app/ui/index.html`
- Modify color scheme in `app/ui/styles/main.css`
- Replace placeholder images with actual food photos

## API Reference

### System Orchestrator
```javascript
// Handle speech input
await orchestrator.handleSpeechInput({ text: "user input" });

// Handle touch input
await orchestrator.handleTouchInput("add_to_cart", { item, quantity });

// Get system status
const status = await orchestrator.getSystemStatus();
```

### NLU Engine
```javascript
// Process natural language
const result = await nluEngine.processText("I want a burger");
// Returns: { intent: "add_item", entities: { item_name: "burger" }, confidence: 0.9 }
```

### Menu Engine
```javascript
// Get menu categories
const menu = await menuEngine.getFullMenu();

// Add item to cart
await menuEngine.addToCart(item, quantity);
```

## Performance Optimization

### llama3.1 Optimization
```bash
# Use GPU acceleration (if available)
OLLAMA_GPU=1 ollama serve

# Adjust context window for faster responses
# Edit config/llm_config.json:
{
  "modelParameters": {
    "num_ctx": 1024  // Reduce for faster inference
  }
}
```

### System Optimization
- Allocate sufficient RAM to Ollama process
- Use SSD storage for faster model loading
- Close unnecessary background applications
- Consider dedicated hardware for production deployment

## Security Considerations

- All processing happens locally (offline)
- No customer data transmitted to external servers
- Speech recognition uses local Web Speech API
- Menu data stored locally in JSON format
- Consider encrypting sensitive configuration files for production

## Future Enhancements (Planned)

### Phase 2
- Advanced menu filtering and search
- Customer preferences and recommendations
- Order history and favorites
- Enhanced avatar animations

### Phase 3
- Multi-language support
- Voice biometrics for personalization
- Integration with POS systems
- Analytics and reporting dashboard

## Support

### Documentation
- Check the `/docs` folder for detailed component documentation
- Review configuration examples in `/config`
- Examine test files in `/test` for usage examples

### Community
- Report issues on GitHub
- Contribute improvements via pull requests
- Share customizations and extensions

## License

Apache-2.0 license - see LICENSE file for details.

## Acknowledgments

- **llama3.1**: Meta's efficient language model
- **Ollama**: Local LLM inference platform
- **Electron**: Cross-platform desktop application framework
- **Web Speech API**: Browser-based speech recognition and synthesis
