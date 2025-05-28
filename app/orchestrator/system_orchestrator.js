const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;

// Import system components
const NLUEngine = require('../nlu/nlu_engine');
const DialogManager = require('../dialog_manager/dialog_manager');
const MenuEngine = require('../menu_engine/menu_engine');
const DataStore = require('../data_store/data_store');
const SpeechInput = require('../speech_input/speech_input');
const SpeechOutput = require('../speech_output/speech_output');

class SystemOrchestrator extends EventEmitter {
    constructor() {
        super();
        this.components = {};
        this.isInitialized = false;
        this.systemStatus = 'offline';
        this.config = null;
        this.pythonServiceStatus = {
            stt: 'unknown',
            tts: 'unknown',
            overall: 'unknown'
        };
        this.serviceCheckInterval = null;
    }

    async initialize() {
        console.log('Initializing System Orchestrator...');
        
        try {
            // Load configuration
            await this.loadConfiguration();
            
            // Initialize core components
            await this.initializeComponents();
            
            // Set up inter-component communication
            this.setupCommunication();
            
            // Start system monitoring (including Python service health)
            this.startSystemMonitoring();
            
            this.isInitialized = true;
            this.systemStatus = 'online';
            
            console.log('System Orchestrator initialized successfully');
            this.emit('system-ready');
            
        } catch (error) {
            console.error('Failed to initialize System Orchestrator:', error);
            this.systemStatus = 'error';
            throw error;
        }
    }

    async loadConfiguration() {
        try {
            const configDir = path.join(__dirname, '../../config');
            
            // Load all configuration files
            const llmConfig = await this.loadConfigFile(path.join(configDir, 'llm_config.json'));
            const promptConfig = await this.loadConfigFile(path.join(configDir, 'prompt_config.json'));
            const nluConfig = await this.loadConfigFile(path.join(configDir, 'nlu_config.json'));
            const speechConfig = await this.loadConfigFile(path.join(configDir, 'speech_service_config.json'));
            
            this.config = {
                llm: llmConfig,
                prompts: promptConfig,
                nlu: nluConfig,
                speech: speechConfig // Added speech config
            };
            
            console.log('All configurations loaded successfully');
            
        } catch (error) {
            console.error('Failed to load one or more configurations:', error);
            // Use default configuration or handle error appropriately
            this.config = this.getDefaultConfiguration();
            console.warn('Using default configurations due to loading error.');
        }
    }

    async loadConfigFile(filePath) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.warn(`Failed to load config file ${path.basename(filePath)}:`, error.message);
            // Return an empty object or a default structure for this specific config
            // This allows other configs to load even if one fails.
            if (path.basename(filePath) === 'speech_service_config.json') {
                return this.getDefaultSpeechConfig(); // Provide a default for speech if it fails
            }
            return {};
        }
    }
    
    getDefaultSpeechConfig() { // Helper for default speech config
        return {
            service: { baseUrl: 'http://127.0.0.1:8000', endpoints: { health: '/api/v1/health' } },
            monitoring: { healthCheckInterval: 30000 }
        };
    }

    getDefaultConfiguration() {
        // Simplified default config, ensure speech part is present
        return {
            llm: { baseURL: 'http://localhost:11434/v1', model: 'gemma3:4b' },
            prompts: { systemPrompt: 'You are a helpful assistant.' },
            nlu: { confidenceThreshold: 0.7 },
            speech: this.getDefaultSpeechConfig()
        };
    }

    async initializeComponents() {
        console.log('Initializing system components...');
        
        this.components.dataStore = new DataStore();
        await this.components.dataStore.initialize();
        
        this.components.nluEngine = new NLUEngine(this.config.llm, this.config.nlu);
        await this.components.nluEngine.initialize();
        
        this.components.dialogManager = new DialogManager(this.config.prompts);
        await this.components.dialogManager.initialize();
        
        this.components.menuEngine = new MenuEngine(this.components.dataStore);
        await this.components.menuEngine.initialize();
        
        // Initialize Speech Components
        // The mainWindow reference will be set later via setMainWindow()
        this.components.speechInput = new SpeechInput();
        await this.components.speechInput.initialize(null); // Pass null initially
        
        this.components.speechOutput = new SpeechOutput();
        await this.components.speechOutput.initialize(null); // Pass null initially
        
        console.log('All components initialized successfully');
    }

    setMainWindow(mainWindow) {
        // Pass mainWindow to components that need it (SpeechInput, SpeechOutput)
        if (this.components.speechInput) {
            this.components.speechInput.mainWindow = mainWindow;
            if (this.components.speechInput.isInitialized) { // If already initialized, re-setup IPC
                this.components.speechInput.setupIPCHandlers();
            }
        }
        
        if (this.components.speechOutput) {
            this.components.speechOutput.mainWindow = mainWindow;
            if (this.components.speechOutput.isInitialized) { // If already initialized, re-setup IPC
                this.components.speechOutput.setupIPCHandlers();
            }
        }
        
        console.log('Main window reference set for speech components');
    }

    setupCommunication() {
        // NLU Engine events
        this.components.nluEngine.on('intent-recognized', (data) => this.handleIntentRecognized(data));
        this.components.nluEngine.on('nlu-error', (error) => this.handleNLUError(error));
        
        // Dialog Manager events
        this.components.dialogManager.on('response-generated', (response) => this.handleDialogResponse(response));
        this.components.dialogManager.on('action-required', (action) => this.handleActionRequired(action));
        
        // Menu Engine events
        this.components.menuEngine.on('menu-updated', (data) => this.emit('menu-updated', data));
        this.components.menuEngine.on('order-updated', (order) => this.emit('order-updated', order));

        // Speech Input events
        this.components.speechInput.on('speech-recognized', (data) => this.handleSpeechInput(data));
        this.components.speechInput.on('speech-error', (error) => this.handleSpeechError('input', error));
        this.components.speechInput.on('service-down', () => this.updatePythonServiceStatus('stt', 'down'));
        this.components.speechInput.on('service-restored', () => this.updatePythonServiceStatus('stt', 'healthy'));


        // Speech Output events
        this.components.speechOutput.on('speech-complete', (data) => this.emit('speech-output-complete', data));
        this.components.speechOutput.on('speech-error', (error) => this.handleSpeechError('output', error));
        this.components.speechOutput.on('speech-start', (data) => this.emit('speech-output-start', data));
        this.components.speechOutput.on('service-down', () => this.updatePythonServiceStatus('tts', 'down'));
        this.components.speechOutput.on('service-restored', () => this.updatePythonServiceStatus('tts', 'healthy'));
        
        // System-wide error handling
        Object.values(this.components).forEach(component => {
            if (component && typeof component.on === 'function') { // Check if component is valid and has 'on'
                component.on('error', (error) => { // General error from component
                    this.handleComponentError(component.constructor.name, error);
                });
            }
        });
    }

    async handleSpeechInput(audioData) { // audioData is now {text, confidence, timestamp, source}
        try {
            console.log(`🔍 Processing speech input from ${audioData.source}: "${audioData.text}"`);
            console.log('🔍 Audio data structure:', audioData);
            
            const text = audioData.text;
            if (!text) {
                throw new Error('No text provided in speech input');
            }
            
            // Emit raw transcript for UI update or logging
            this.emit('raw-transcript', { text, confidence: audioData.confidence, source: audioData.source });

            console.log('🔍 Sending to NLU engine...');
            const nluResult = await this.components.nluEngine.processText(text);
            console.log('🔍 LLM NLU result:', {
                intent: nluResult.intent,
                entities: nluResult.entities,
                confidence: nluResult.confidence
            });
            
            console.log('🔍 Sending to dialog manager...');
            const dialogResponse = await this.components.dialogManager.processIntent(nluResult);
            console.log('🔍 Dialog response:', {
                text: dialogResponse.text,
                actions: dialogResponse.actions?.map(a => ({ type: a.type, data: a.data }))
            });
            
            if (dialogResponse.text) {
                // 🔍 DIAGNOSTIC: Safe substring for speaking response log
                let responseTextPreview;
                try {
                    if (dialogResponse.text && typeof dialogResponse.text === 'string') {
                        responseTextPreview = dialogResponse.text.substring(0, 50) + '...';
                    } else {
                        responseTextPreview = `[INVALID DIALOG RESPONSE TEXT: type=${typeof dialogResponse.text}, value=${dialogResponse.text}]`;
                    }
                } catch (responseSubstringError) {
                    console.error('🔍 DIAGNOSTIC: Substring error in dialog response logging:', {
                        error: responseSubstringError,
                        dialogResponse: dialogResponse,
                        textType: typeof dialogResponse.text
                    });
                    responseTextPreview = '[SUBSTRING ERROR]';
                }
                
                console.log('🔍 Speaking response:', responseTextPreview);
                await this.components.speechOutput.speak(dialogResponse.text);
            }

            if (dialogResponse.actions && dialogResponse.actions.length > 0) {
                console.log('🔍 Executing actions:', dialogResponse.actions.map(a => a.type));
                await this.executeActions(dialogResponse.actions);
            }
            
            // Emit processed interaction for UI or logging
            this.emit('processed-interaction', {
                input: text,
                intent: nluResult.intent,
                entities: nluResult.entities,
                response: dialogResponse.text,
                actions: dialogResponse.actions
            });

            // Return structured response for frontend
            const response = {
                intent: nluResult.intent,
                entities: nluResult.entities,
                confidence: nluResult.confidence,
                response_text: dialogResponse.text
            };
            console.log('🔍 Returning response to frontend:', response);
            return response;

        } catch (error) {
            console.error('🚨 Speech input processing error:', error);
            console.error('🔍 Error stack:', error.stack);
            const errorResponse = this.generateErrorResponse(error);
            console.log('🔍 Generated error response:', errorResponse);
            
            try {
                await this.components.speechOutput.speak(errorResponse.response_text);
            } catch (speechError) {
                console.error('🚨 Failed to speak error response:', speechError);
            }
            
            this.emit('system-error', { context: 'speech-input', error: error.message });
            return errorResponse;
        }
    }
    
    handleSpeechError(type, errorData) {
        console.error(`Speech ${type} error:`, errorData.error || errorData);
        this.emit(`speech-${type}-error`, errorData);
        // Potentially speak a generic error message if appropriate
        // e.g., if (type === 'input' && !this.components.speechOutput.isSpeaking) {
        //   this.components.speechOutput.speak("I'm having trouble understanding right now.");
        // }
    }

    updatePythonServiceStatus(serviceType, status) { // serviceType is 'stt' or 'tts'
        this.pythonServiceStatus[serviceType] = status;
        
        const sttOK = this.pythonServiceStatus.stt === 'healthy' || this.pythonServiceStatus.stt === 'unknown'; // Treat unknown as potentially ok initially
        const ttsOK = this.pythonServiceStatus.tts === 'healthy' || this.pythonServiceStatus.tts === 'unknown';

        if (sttOK && ttsOK) {
            this.pythonServiceStatus.overall = 'healthy';
        } else if (this.pythonServiceStatus.stt === 'down' && this.pythonServiceStatus.tts === 'down') {
            this.pythonServiceStatus.overall = 'down';
        } else {
            this.pythonServiceStatus.overall = 'degraded';
        }
        
        console.log(`Python service status updated: STT=${this.pythonServiceStatus.stt}, TTS=${this.pythonServiceStatus.tts}, Overall=${this.pythonServiceStatus.overall}`);
        this.emit('python-service-status', this.pythonServiceStatus);

        // Handle graceful degradation or recovery notices
        if (status === 'down') {
            const message = `The ${serviceType.toUpperCase()} service is currently unavailable. Functionality may be limited.`;
            // this.components.speechOutput.speak(message); // Be cautious with automated error speaking
            this.emit('notification', { type: 'warning', message });
        } else if (status === 'healthy' && (this.pythonServiceStatus.overall === 'healthy' || this.pythonServiceStatus.overall === 'degraded')) {
             // Check if it was previously down to announce recovery
            if (this.pythonServiceStatus.overall !== 'healthy' && (this.pythonServiceStatus.stt === 'healthy' && this.pythonServiceStatus.tts === 'healthy')) {
                 const message = `All speech services are now back online.`;
                 // this.components.speechOutput.speak(message);
                 this.emit('notification', { type: 'info', message });
            }
        }
    }


    async handleTouchInput(action, data) {
        try {
            console.log('Processing touch input:', action, data);
            let result;
            switch (action) {
                case 'select_category':
                    result = await this.components.menuEngine.getCategory(data.category);
                    this.emit('ui-update', { type: 'category-selected', data: { category: data.category, items: result }});
                    break;
                case 'select_item':
                    result = await this.components.menuEngine.getItemDetails(data.itemId);
                     this.emit('ui-update', { type: 'item-selected', data: { item: result }});
                    break;
                case 'add_to_cart':
                    result = await this.components.menuEngine.addToCart(data.item, data.quantity);
                    this.emit('order-updated', result.cart);
                    this.components.speechOutput.speak(`Added ${data.quantity} ${data.item.name} to your order.`);
                    break;
                // ... other cases from original
                default:
                    throw new Error(`Unknown touch action: ${action}`);
            }
            return { success: true, data: result };
        } catch (error) {
            console.error('Touch input processing error:', error);
            this.emit('system-error', { context: 'touch-input', error: error.message });
            return this.generateErrorResponse(error);
        }
    }

    async handleMenuRequest(request) {
        try {
            console.log('Processing menu request:', request);
            let result;
            switch (request.action) {
                case 'get_menu':
                    result = await this.components.menuEngine.getFullMenu();
                    break;
                case 'get_category':
                    result = await this.components.menuEngine.getCategory(request.category);
                    break;
                // ... other cases
                default:
                    throw new Error(`Unknown menu action: ${request.action}`);
            }
            return { success: true, data: result };
        } catch (error) {
            console.error('Menu request processing error:', error);
            this.emit('system-error', { context: 'menu-request', error: error.message });
            return this.generateErrorResponse(error);
        }
    }

    async executeActions(actions) {
        console.log('🔍 EXECUTING ACTIONS:', actions.map(a => ({ type: a.type, data: a.data })));
        
        for (const action of actions) {
            try {
                console.log('🔍 Processing action:', action.type, 'with data:', action.data);
                
                switch (action.type) {
                    case 'show_menu': // Handle dialog manager's show_menu action
                        console.log('🔍 SHOW_MENU action - view:', action.data.view, 'category:', action.data.category);
                        if (action.data.view === 'categories') {
                            console.log('🔍 Emitting ui-update: show-categories');
                            const uiUpdate = { type: 'show-categories', data: {} };
                            console.log('🔍 DIAGNOSTIC: UI update object being emitted:', JSON.stringify(uiUpdate, null, 2));
                            this.emit('ui-update', uiUpdate);
                        } else if (action.data.view === 'items' && action.data.category) {
                            console.log('🔍 Getting category items for:', action.data.category);
                            try {
                                const categoryResult = await this.components.menuEngine.getCategory(action.data.category);
                                console.log('🔍 Category resolution successful:', {
                                    requestedCategory: action.data.category,
                                    resolvedName: categoryResult.name,
                                    itemCount: categoryResult.items?.length || 0
                                });
                                console.log('🔍 Emitting ui-update: show-category with', categoryResult.items?.length || 0, 'items');
                                this.emit('ui-update', { type: 'show-category', data: { category: action.data.category, items: categoryResult }});
                            } catch (error) {
                                console.error('🚨 Category resolution failed:', {
                                    requestedCategory: action.data.category,
                                    error: error.message
                                });
                                throw error; // Re-throw to maintain existing error handling
                            }
                        }
                        break;
                    case 'show_menu_category': // More specific action
                        const items = await this.components.menuEngine.getCategory(action.data.category);
                        this.emit('ui-update', { type: 'show-category', data: { category: action.data.category, items }});
                        break;
                    case 'add_item': // Handle dialog manager's add_item action
                    case 'add_item_to_cart': // More specific
                        const cartResult = await this.components.menuEngine.addToCart(action.data.item || action.data, action.data.quantity || 1);
                        this.emit('order-updated', cartResult.cart);
                        break;
                    case 'show_cart': // Handle view cart action
                        this.emit('ui-update', { type: 'show-cart', data: {} });
                        break;
                    case 'process_checkout': // Handle checkout action
                        this.emit('ui-update', { type: 'process-checkout', data: {} });
                        break;
                    case 'end_session': // Handle session end
                        this.emit('ui-update', { type: 'end-session', data: {} });
                        break;
                    default:
                        console.error('Unknown action type:', action.type);
                        this.emit('action-execution-error', { action: action.type, error: 'Unknown action type' });
                }
            } catch (error) {
                console.error(`Failed to execute action ${action.type}:`, error);
                this.emit('action-execution-error', { action: action.type, error: error.message });
            }
        }
    }

    handleIntentRecognized(data) {
        console.log('Intent recognized by NLU:', data.intent, 'Entities:', data.entities);
        this.emit('intent-recognized', data); // Forward for logging or UI
    }

    handleNLUError(error) {
        console.error('NLU Error:', error);
        this.emit('nlu-error', error);
        this.components.speechOutput.speak("I'm having a bit of trouble understanding. Could you try rephrasing?");
    }

    handleDialogResponse(response) { // Response is {text, actions, ...}
        console.log('Dialog response generated:', response.text);
        this.emit('dialog-response', response); // Forward for UI
        // Speaking the response text is now handled in handleSpeechInput after dialogManager.processIntent
    }

    handleActionRequired(action) { // This might be deprecated if actions are part of dialogResponse
        console.log('Action required by Dialog Manager:', action.type);
        this.emit('action-required', action); // Forward for logging
        this.executeActions([action]); // Execute if it's a standalone action request
    }

    handleComponentError(componentName, error) {
        console.error(`Error in component ${componentName}:`, error.message || error);
        this.emit('component-error', { component: componentName, error: error.message || error });
        // Avoid speaking errors for every component error to prevent flooding
        if (componentName === 'NLUEngine' || componentName === 'DialogManager') {
            // this.components.speechOutput.speak("I've encountered an internal issue. Please try again.");
        }
    }

    generateErrorResponse(error) {
        return {
            success: false,
            error: error.message,
            intent: 'error',
            response_text: 'I apologize, but I encountered an error. Please try again or use the touch screen.'
        };
    }

    async getSystemStatus() {
        const componentStatus = {};
        for (const [name, component] of Object.entries(this.components)) {
            try {
                if (component && typeof component.getStatus === 'function') {
                    componentStatus[name] = await component.getStatus();
                } else {
                     componentStatus[name] = component ? 'status_not_available' : 'not_initialized';
                }
            } catch (error) {
                componentStatus[name] = { status: 'error', error: error.message };
            }
        }
        
        return {
            system: this.systemStatus,
            components: componentStatus,
            pythonService: this.pythonServiceStatus, // Added Python service status
            initialized: this.isInitialized,
            timestamp: Date.now()
        };
    }

    async updateConfiguration(newConfigUpdates) {
        try {
            // Selectively update parts of the config
            if (newConfigUpdates.llm) this.config.llm = { ...this.config.llm, ...newConfigUpdates.llm };
            if (newConfigUpdates.prompts) this.config.prompts = { ...this.config.prompts, ...newConfigUpdates.prompts };
            if (newConfigUpdates.nlu) this.config.nlu = { ...this.config.nlu, ...newConfigUpdates.nlu };
            if (newConfigUpdates.speech) this.config.speech = { ...this.config.speech, ...newConfigUpdates.speech };

            // Propagate updates to components
            if (newConfigUpdates.llm && this.components.nluEngine) {
                await this.components.nluEngine.updateConfiguration(this.config.llm);
            }
            if (newConfigUpdates.prompts && this.components.dialogManager) {
                // DialogManager might not have updateConfiguration, or it might take specific prompt parts
                // For now, assume it re-reads from this.config.prompts when needed or has its own method
            }
            if (newConfigUpdates.nlu && this.components.nluEngine) {
                 await this.components.nluEngine.updateConfiguration(this.config.nlu); // NLU might take general NLU config
            }
            if (newConfigUpdates.speech) {
                if (this.components.speechInput) await this.components.speechInput.updateConfiguration(this.config.speech);
                if (this.components.speechOutput) await this.components.speechOutput.updateConfiguration(this.config.speech);
            }
            
            console.log('System configuration updated successfully');
            this.emit('configuration-updated', this.config);
            return { success: true };
            
        } catch (error) {
            console.error('Failed to update system configuration:', error);
            return { success: false, error: error.message };
        }
    }

    startSystemMonitoring() {
        // This interval can be for general component health if needed,
        // Python service health is managed by SpeechInput/Output modules themselves.
        // For now, we rely on events from those modules for Python service status.
        
        // Example: Periodically log overall system status
        if (this.serviceCheckInterval) clearInterval(this.serviceCheckInterval);
        this.serviceCheckInterval = setInterval(async () => {
            try {
                const status = await this.getSystemStatus();
                this.emit('system-status-update', status); // For UI or logging
                
                // Check for critical component failures (example)
                if (status.components.nluEngine?.status === 'error' || status.components.dialogManager?.status === 'error') {
                    console.warn('Critical component (NLU or Dialog) in error state.');
                    // Potentially trigger a more global error state or recovery attempt
                }

            } catch (error) {
                console.error('System monitoring error:', error);
            }
        }, this.config.speech.monitoring.healthCheckInterval || 60000); // Use speech config interval or a default
    }

    async shutdown() {
        console.log('Shutting down System Orchestrator...');
        if (this.serviceCheckInterval) {
            clearInterval(this.serviceCheckInterval);
        }
        
        try {
            for (const [name, component] of Object.entries(this.components)) {
                try {
                    if (component && typeof component.shutdown === 'function') {
                        await component.shutdown();
                        console.log(`${name} shut down successfully`);
                    }
                } catch (error) {
                    console.error(`Failed to shutdown ${name}:`, error);
                }
            }
            
            this.isInitialized = false;
            this.systemStatus = 'offline';
            this.pythonServiceStatus = { stt: 'unknown', tts: 'unknown', overall: 'unknown' };
            
            console.log('System Orchestrator shut down successfully');
            this.emit('system-shutdown');
            
        } catch (error) {
            console.error('Error during System Orchestrator shutdown:', error);
        }
    }
}

module.exports = SystemOrchestrator;