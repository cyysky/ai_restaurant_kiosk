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
            
            // Start system monitoring
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
            const configPath = path.join(__dirname, '../../config');
            
            // Load all configuration files
            const llmConfig = await this.loadConfigFile(path.join(configPath, 'llm_config.json'));
            const promptConfig = await this.loadConfigFile(path.join(configPath, 'prompt_config.json'));
            const nluConfig = await this.loadConfigFile(path.join(configPath, 'nlu_config.json'));
            
            this.config = {
                llm: llmConfig,
                prompts: promptConfig,
                nlu: nluConfig
            };
            
            console.log('Configuration loaded successfully');
            
        } catch (error) {
            console.error('Failed to load configuration:', error);
            // Use default configuration
            this.config = this.getDefaultConfiguration();
        }
    }

    async loadConfigFile(filePath) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.warn(`Failed to load config file ${filePath}:`, error.message);
            return {};
        }
    }

    getDefaultConfiguration() {
        return {
            llm: {
                baseURL: 'http://localhost:11434/v1',
                model: 'gemma3:4b',
                temperature: 0.7,
                maxTokens: 150,
                timeout: 10000
            },
            prompts: {
                systemPrompt: 'You are a helpful restaurant kiosk assistant.',
                menuPrompt: 'Help customers navigate the menu and place orders.',
                fallbackPrompt: 'I apologize, but I need clarification.'
            },
            nlu: {
                confidenceThreshold: 0.7,
                fallbackEnabled: true,
                contextWindow: 5
            }
        };
    }

    async initializeComponents() {
        console.log('Initializing system components...');
        
        // Initialize Data Store first (other components depend on it)
        this.components.dataStore = new DataStore();
        await this.components.dataStore.initialize();
        
        // Initialize NLU Engine with Gemma 3:4B
        this.components.nluEngine = new NLUEngine(this.config.llm, this.config.nlu);
        await this.components.nluEngine.initialize();
        
        // Initialize Dialog Manager
        this.components.dialogManager = new DialogManager(this.config.prompts);
        await this.components.dialogManager.initialize();
        
        // Initialize Menu Engine
        this.components.menuEngine = new MenuEngine(this.components.dataStore);
        await this.components.menuEngine.initialize();
        
        // Initialize Speech Components with main window reference
        this.components.speechInput = new SpeechInput();
        await this.components.speechInput.initialize();
        
        this.components.speechOutput = new SpeechOutput();
        await this.components.speechOutput.initialize();
        
        console.log('All components initialized successfully');
    }

    setMainWindow(mainWindow) {
        // Set main window reference for speech components to enable IPC
        if (this.components.speechInput) {
            this.components.speechInput.mainWindow = mainWindow;
            this.components.speechInput.setupIPCHandlers();
        }
        
        if (this.components.speechOutput) {
            this.components.speechOutput.mainWindow = mainWindow;
            this.components.speechOutput.setupIPCHandlers();
        }
        
        console.log('Main window reference set for speech components');
    }

    setupCommunication() {
        // Set up event-driven communication between components
        
        // NLU Engine events
        this.components.nluEngine.on('intent-recognized', (data) => {
            this.handleIntentRecognized(data);
        });
        
        this.components.nluEngine.on('nlu-error', (error) => {
            this.handleNLUError(error);
        });
        
        // Dialog Manager events
        this.components.dialogManager.on('response-generated', (response) => {
            this.handleDialogResponse(response);
        });
        
        this.components.dialogManager.on('action-required', (action) => {
            this.handleActionRequired(action);
        });
        
        // Menu Engine events
        this.components.menuEngine.on('menu-updated', (data) => {
            this.emit('menu-updated', data);
        });
        
        this.components.menuEngine.on('order-updated', (order) => {
            this.emit('order-updated', order);
        });
        
        // System-wide error handling
        Object.values(this.components).forEach(component => {
            component.on('error', (error) => {
                this.handleComponentError(component.constructor.name, error);
            });
        });
    }

    async handleSpeechInput(audioData) {
        try {
            console.log('Processing speech input...');
            
            // Extract text from audio data
            const text = audioData.text || audioData.transcript;
            
            if (!text) {
                throw new Error('No text provided in speech input');
            }
            
            // Process through NLU
            const nluResult = await this.components.nluEngine.processText(text);
            
            // Generate dialog response
            const dialogResponse = await this.components.dialogManager.processIntent(nluResult);
            
            // Execute any required actions
            if (dialogResponse.actions) {
                await this.executeActions(dialogResponse.actions);
            }
            
            return {
                intent: nluResult.intent,
                entities: nluResult.entities,
                response_text: dialogResponse.text,
                actions: dialogResponse.actions
            };
            
        } catch (error) {
            console.error('Speech input processing error:', error);
            return this.generateErrorResponse(error);
        }
    }

    async handleTouchInput(action, data) {
        try {
            console.log('Processing touch input:', action, data);
            
            switch (action) {
                case 'select_category':
                    return await this.handleCategorySelection(data.category);
                case 'select_item':
                    return await this.handleItemSelection(data.item);
                case 'add_to_cart':
                    return await this.handleAddToCart(data);
                case 'update_cart':
                    return await this.handleCartUpdate(data);
                case 'checkout':
                    return await this.handleCheckout(data);
                default:
                    throw new Error(`Unknown touch action: ${action}`);
            }
            
        } catch (error) {
            console.error('Touch input processing error:', error);
            return this.generateErrorResponse(error);
        }
    }

    async handleMenuRequest(request) {
        try {
            console.log('Processing menu request:', request);
            
            switch (request.action) {
                case 'get_menu':
                    return await this.components.menuEngine.getFullMenu();
                case 'get_category':
                    return await this.components.menuEngine.getCategory(request.category);
                case 'search_items':
                    return await this.components.menuEngine.searchItems(request.query);
                case 'get_item_details':
                    return await this.components.menuEngine.getItemDetails(request.itemId);
                default:
                    throw new Error(`Unknown menu action: ${request.action}`);
            }
            
        } catch (error) {
            console.error('Menu request processing error:', error);
            return this.generateErrorResponse(error);
        }
    }

    async executeActions(actions) {
        for (const action of actions) {
            try {
                switch (action.type) {
                    case 'show_menu':
                        await this.handleShowMenu(action.data);
                        break;
                    case 'add_item':
                        await this.handleAddToCart(action.data);
                        break;
                    case 'update_cart':
                        await this.handleCartUpdate(action.data);
                        break;
                    case 'speak':
                        await this.components.speechOutput.speak(action.data.text);
                        break;
                    default:
                        console.warn('Unknown action type:', action.type);
                }
            } catch (error) {
                console.error(`Failed to execute action ${action.type}:`, error);
            }
        }
    }

    async handleCategorySelection(category) {
        const menuItems = await this.components.menuEngine.getCategory(category);
        return {
            success: true,
            category: category,
            items: menuItems
        };
    }

    async handleItemSelection(item) {
        const itemDetails = await this.components.menuEngine.getItemDetails(item.id);
        return {
            success: true,
            item: itemDetails
        };
    }

    async handleAddToCart(data) {
        const result = await this.components.menuEngine.addToCart(data.item, data.quantity);
        return {
            success: true,
            cart: result.cart,
            message: `Added ${data.quantity} ${data.item.name} to cart`
        };
    }

    async handleCartUpdate(data) {
        const result = await this.components.menuEngine.updateCart(data);
        return {
            success: true,
            cart: result.cart
        };
    }

    async handleCheckout(data) {
        const result = await this.components.menuEngine.processCheckout(data);
        return {
            success: true,
            orderId: result.orderId,
            total: result.total,
            message: 'Order placed successfully'
        };
    }

    handleIntentRecognized(data) {
        console.log('Intent recognized:', data.intent);
        this.emit('intent-recognized', data);
    }

    handleNLUError(error) {
        console.error('NLU Error:', error);
        this.emit('nlu-error', error);
    }

    handleDialogResponse(response) {
        console.log('Dialog response generated');
        this.emit('dialog-response', response);
    }

    handleActionRequired(action) {
        console.log('Action required:', action.type);
        this.emit('action-required', action);
    }

    handleComponentError(componentName, error) {
        console.error(`Component error in ${componentName}:`, error);
        this.emit('component-error', { component: componentName, error });
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
                componentStatus[name] = component.getStatus ? await component.getStatus() : 'unknown';
            } catch (error) {
                componentStatus[name] = 'error';
            }
        }
        
        return {
            system: this.systemStatus,
            components: componentStatus,
            initialized: this.isInitialized,
            timestamp: Date.now()
        };
    }

    async updateConfiguration(newConfig) {
        try {
            // Merge with existing configuration
            this.config = { ...this.config, ...newConfig };
            
            // Update components that support configuration updates
            if (newConfig.llm && this.components.nluEngine) {
                await this.components.nluEngine.updateConfiguration(newConfig.llm);
            }
            
            if (newConfig.prompts && this.components.dialogManager) {
                await this.components.dialogManager.updateConfiguration(newConfig.prompts);
            }
            
            console.log('Configuration updated successfully');
            return { success: true };
            
        } catch (error) {
            console.error('Failed to update configuration:', error);
            return { success: false, error: error.message };
        }
    }

    startSystemMonitoring() {
        // Monitor system health
        this.monitoringInterval = setInterval(async () => {
            try {
                const status = await this.getSystemStatus();
                
                // Check for component failures
                const failedComponents = Object.entries(status.components)
                    .filter(([name, status]) => status === 'error')
                    .map(([name]) => name);
                
                if (failedComponents.length > 0) {
                    console.warn('Failed components detected:', failedComponents);
                    this.emit('components-failed', failedComponents);
                }
                
            } catch (error) {
                console.error('System monitoring error:', error);
            }
        }, 30000); // Check every 30 seconds
    }

    async shutdown() {
        console.log('Shutting down System Orchestrator...');
        
        try {
            // Stop monitoring
            if (this.monitoringInterval) {
                clearInterval(this.monitoringInterval);
            }
            
            // Shutdown all components
            for (const [name, component] of Object.entries(this.components)) {
                try {
                    if (component.shutdown) {
                        await component.shutdown();
                    }
                    console.log(`${name} shut down successfully`);
                } catch (error) {
                    console.error(`Failed to shutdown ${name}:`, error);
                }
            }
            
            this.isInitialized = false;
            this.systemStatus = 'offline';
            
            console.log('System Orchestrator shut down successfully');
            
        } catch (error) {
            console.error('Error during shutdown:', error);
        }
    }
}

module.exports = SystemOrchestrator;