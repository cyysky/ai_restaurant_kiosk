# AI-Powered Kiosk System with Gemma 3:4B

A sophisticated offline AI kiosk system featuring a digital avatar, natural language understanding powered by Gemma 3:4B, and dual-mode interaction (voice + touch).

## Features

### Phase 1 Implementation ✅

- **Electron-based Kiosk Application**: Full-screen kiosk mode with touch-optimized UI
- **Gemma 3:4B Integration**: Local LLM with OpenAI-compatible API for advanced NLU
- **Dual-Mode Interaction**: Voice commands and touch navigation
- **Digital Avatar**: Animated avatar with emotional responses and speech feedback
- **Offline Operation**: Complete functionality without internet connection
- **Advanced Speech Processing**: Web Speech API for STT/TTS
- **Smart Cart Management**: Real-time cart updates with persistence
- **Comprehensive Menu System**: Category-based navigation with detailed item information

## Architecture

```
/ai-kiosk-system/
├── /app/                     # Main application source
│   ├── /ui/                  # Frontend UI components
│   ├── /orchestrator/        # System orchestrator
│   ├── /nlu/                 # NLU engine with Gemma 3:4B
│   ├── /dialog_manager/      # Dialog management
│   ├── /menu_engine/         # Menu & ordering logic
│   └── /data_store/          # Local data storage
├── /config/                  # Configuration files
├── /data/                    # Menu data and models
├── main.js                   # Electron main process
└── package.json              # Dependencies
```

## Prerequisites

### System Requirements
- **OS**: Windows 10/11, macOS 10.14+, or Linux (Ubuntu 18.04+)
- **RAM**: Minimum 8GB (16GB recommended for Gemma 3:4B)
- **Storage**: 10GB free space
- **CPU**: Multi-core processor (Intel i5/AMD Ryzen 5 or better)
- **GPU**: Optional but recommended for faster inference

### Software Dependencies
- **Node.js**: Version 18.0 or higher
- **Ollama**: For running Gemma 3:4B locally
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
ollama pull gemma3:4b
```

#### macOS:
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull Gemma 3:4B model
ollama pull gemma3:4b
```

#### Linux:
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull Gemma 3:4B model
ollama pull gemma3:4b
```

### 4. Start Ollama Server
```bash
# Start Ollama server (runs on http://localhost:11434)
ollama serve
```

### 5. Verify Gemma 3:4B Installation
```bash
# Test the model
ollama run gemma3:4b "Hello, how are you?"
```

## Configuration

### LLM Configuration (`config/llm_config.json`)
```json
{
  "baseURL": "http://localhost:11434/v1",
  "model": "gemma3:4b",
  "temperature": 0.7,
  "maxTokens": 150,
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

### Testing Individual Components
```bash
# Test speech recognition
node test/test_speech.js

# Test NLU engine
node test/test_nlu.js

# Test menu system
node test/test_menu.js
```

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

#### Gemma 3:4B Not Responding
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

### Gemma 3:4B Optimization
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

MIT License - see LICENSE file for details.

## Acknowledgments

- **Gemma 3:4B**: Google's efficient language model
- **Ollama**: Local LLM inference platform
- **Electron**: Cross-platform desktop application framework
- **Web Speech API**: Browser-based speech recognition and synthesis