const EventEmitter = require('events');

class DialogManager extends EventEmitter {
    constructor(promptConfig) {
        super();
        this.promptConfig = promptConfig;
        this.conversationState = {
            currentIntent: null,
            context: {},
            userPreferences: {},
            sessionId: null,
            startTime: Date.now()
        };
        this.responseTemplates = {};
        this.isInitialized = false;
    }

    async initialize() {
        console.log('Initializing Dialog Manager...');
        
        try {
            this.loadResponseTemplates();
            this.resetConversationState();
            this.isInitialized = true;
            
            console.log('Dialog Manager initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Dialog Manager:', error);
            throw error;
        }
    }

    loadResponseTemplates() {
        // Load response templates from prompt config
        this.responseTemplates = this.promptConfig.conversationPrompts || {};
        
        // Set default templates if not provided
        if (!this.responseTemplates.greeting) {
            this.responseTemplates.greeting = [
                "Welcome! How can I help you today?",
                "Hello! What would you like to order?",
                "Hi there! I'm here to assist you."
            ];
        }
    }

    resetConversationState() {
        this.conversationState = {
            currentIntent: null,
            context: {},
            userPreferences: {},
            sessionId: this.generateSessionId(),
            startTime: Date.now(),
            lastInteraction: Date.now(),
            turnCount: 0
        };
    }

    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async processIntent(nluResult) {
        console.log('Processing intent in Dialog Manager:', nluResult);
        
        try {
            // Update conversation state
            this.updateConversationState(nluResult);
            
            // Generate appropriate response
            const response = await this.generateResponse(nluResult);
            
            // Emit response event
            this.emit('response-generated', response);
            
            return response;
            
        } catch (error) {
            console.error('Dialog processing error:', error);
            return this.generateErrorResponse(error);
        }
    }

    updateConversationState(nluResult) {
        this.conversationState.currentIntent = nluResult.intent;
        this.conversationState.lastInteraction = Date.now();
        this.conversationState.turnCount++;
        
        // Update context with entities
        if (nluResult.entities) {
            this.conversationState.context = {
                ...this.conversationState.context,
                ...nluResult.entities
            };
        }
        
        // Track user preferences
        this.updateUserPreferences(nluResult);
    }

    updateUserPreferences(nluResult) {
        const { intent, entities } = nluResult;
        
        // Track dietary preferences
        if (entities.dietary_restrictions) {
            this.conversationState.userPreferences.dietary = entities.dietary_restrictions;
        }
        
        // Track preferred categories
        if (intent === 'browse_menu' && entities.category) {
            if (!this.conversationState.userPreferences.categories) {
                this.conversationState.userPreferences.categories = [];
            }
            this.conversationState.userPreferences.categories.push(entities.category);
        }
        
        // Track order patterns
        if (intent === 'add_item' && entities.item_name) {
            if (!this.conversationState.userPreferences.items) {
                this.conversationState.userPreferences.items = [];
            }
            this.conversationState.userPreferences.items.push(entities.item_name);
        }
    }

    async generateResponse(nluResult) {
        const { intent, entities, confidence } = nluResult;
        
        // Handle low confidence responses
        if (confidence < 0.5) {
            return this.generateClarificationResponse();
        }
        
        // Generate intent-specific response
        switch (intent) {
            case 'greeting':
                return this.handleGreeting();
            case 'browse_menu':
                return this.handleMenuBrowsing(entities);
            case 'add_item':
                return this.handleAddItem(entities);
            case 'remove_item':
                return this.handleRemoveItem(entities);
            case 'view_cart':
                return this.handleViewCart();
            case 'checkout':
                return this.handleCheckout();
            case 'help':
                return this.handleHelp();
            case 'goodbye':
                return this.handleGoodbye();
            default:
                return this.generateClarificationResponse();
        }
    }

    handleGreeting() {
        const templates = this.responseTemplates.greeting;
        const response = this.selectRandomTemplate(templates);
        
        return {
            text: response,
            actions: [
                {
                    type: 'show_menu',
                    data: { view: 'categories' }
                }
            ],
            context: this.conversationState.context
        };
    }

    handleMenuBrowsing(entities) {
        const category = entities.category;
        let response;
        let actions = [];
        
        if (category) {
            // Specific category requested
            const templates = this.responseTemplates.menuBrowsing;
            response = this.selectRandomTemplate(templates).replace('{category}', category);
            
            actions.push({
                type: 'show_menu',
                data: { view: 'items', category: category }
            });
        } else {
            // General menu browsing
            response = "Here's our menu. Which category would you like to explore?";
            
            actions.push({
                type: 'show_menu',
                data: { view: 'categories' }
            });
        }
        
        return {
            text: response,
            actions: actions,
            context: this.conversationState.context
        };
    }

    handleAddItem(entities) {
        const itemName = entities.item_name;
        const quantity = entities.quantity || 1;
        
        if (!itemName) {
            return {
                text: "What would you like to add to your order?",
                actions: [],
                context: this.conversationState.context
            };
        }
        
        const templates = this.responseTemplates.itemAdded;
        const response = this.selectRandomTemplate(templates)
            .replace('{quantity}', quantity)
            .replace('{item}', itemName);
        
        return {
            text: response,
            actions: [
                {
                    type: 'add_item',
                    data: { item_name: itemName, quantity: quantity }
                }
            ],
            context: this.conversationState.context
        };
    }

    handleRemoveItem(entities) {
        const itemName = entities.item_name;
        
        if (!itemName) {
            return {
                text: "Which item would you like to remove from your cart?",
                actions: [],
                context: this.conversationState.context
            };
        }
        
        return {
            text: `I'll remove ${itemName} from your cart.`,
            actions: [
                {
                    type: 'remove_item',
                    data: { item_name: itemName }
                }
            ],
            context: this.conversationState.context
        };
    }

    handleViewCart() {
        return {
            text: "Let me show you what's in your cart.",
            actions: [
                {
                    type: 'show_cart',
                    data: {}
                }
            ],
            context: this.conversationState.context
        };
    }

    handleCheckout() {
        const templates = this.responseTemplates.checkout;
        const response = this.selectRandomTemplate(templates);
        
        return {
            text: response,
            actions: [
                {
                    type: 'process_checkout',
                    data: {}
                }
            ],
            context: this.conversationState.context
        };
    }

    handleHelp() {
        const templates = this.responseTemplates.help;
        const response = this.selectRandomTemplate(templates);
        
        return {
            text: response,
            actions: [],
            context: this.conversationState.context
        };
    }

    handleGoodbye() {
        const templates = this.responseTemplates.goodbye;
        const response = this.selectRandomTemplate(templates);
        
        // Reset session after goodbye
        setTimeout(() => {
            this.resetConversationState();
        }, 5000);
        
        return {
            text: response,
            actions: [
                {
                    type: 'end_session',
                    data: {}
                }
            ],
            context: this.conversationState.context
        };
    }

    generateClarificationResponse() {
        const templates = this.responseTemplates.clarification || [
            "I'm not sure I understood that. Could you please rephrase?",
            "Could you be more specific?",
            "I didn't catch that. Could you try again?"
        ];
        
        const response = this.selectRandomTemplate(templates);
        
        return {
            text: response,
            actions: [],
            context: this.conversationState.context,
            needsClarification: true
        };
    }

    generateErrorResponse(error) {
        const errorTemplates = this.promptConfig.errorHandling || {
            systemError: "I'm experiencing technical difficulties. Please try again."
        };
        
        return {
            text: errorTemplates.systemError,
            actions: [],
            context: this.conversationState.context,
            error: error.message
        };
    }

    selectRandomTemplate(templates) {
        if (!templates || templates.length === 0) {
            return "I'm here to help you with your order.";
        }
        
        const randomIndex = Math.floor(Math.random() * templates.length);
        return templates[randomIndex];
    }

    // Context-aware response generation
    generateContextualResponse(intent, entities) {
        const context = this.conversationState.context;
        const preferences = this.conversationState.userPreferences;
        
        // Customize response based on context
        if (intent === 'browse_menu' && preferences.dietary) {
            return `Based on your ${preferences.dietary} preferences, here are some options...`;
        }
        
        if (intent === 'add_item' && context.category) {
            return `Great choice from our ${context.category} menu!`;
        }
        
        // Default response generation
        return this.generateResponse({ intent, entities });
    }

    // Session management
    isSessionActive() {
        const sessionTimeout = 30 * 60 * 1000; // 30 minutes
        return (Date.now() - this.conversationState.lastInteraction) < sessionTimeout;
    }

    extendSession() {
        this.conversationState.lastInteraction = Date.now();
    }

    getSessionInfo() {
        return {
            sessionId: this.conversationState.sessionId,
            startTime: this.conversationState.startTime,
            lastInteraction: this.conversationState.lastInteraction,
            turnCount: this.conversationState.turnCount,
            isActive: this.isSessionActive()
        };
    }

    // Configuration updates
    async updateConfiguration(newConfig) {
        try {
            this.promptConfig = { ...this.promptConfig, ...newConfig };
            this.loadResponseTemplates();
            
            console.log('Dialog Manager configuration updated');
            return true;
        } catch (error) {
            console.error('Failed to update Dialog Manager configuration:', error);
            throw error;
        }
    }

    // Status and diagnostics
    getStatus() {
        return {
            initialized: this.isInitialized,
            sessionActive: this.isSessionActive(),
            currentIntent: this.conversationState.currentIntent,
            turnCount: this.conversationState.turnCount,
            hasPreferences: Object.keys(this.conversationState.userPreferences).length > 0
        };
    }

    // Cleanup
    async shutdown() {
        console.log('Shutting down Dialog Manager...');
        this.resetConversationState();
        this.isInitialized = false;
        console.log('Dialog Manager shut down successfully');
    }
}

module.exports = DialogManager;