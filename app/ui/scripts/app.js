// Main Application Controller
class KioskApp {
    constructor() {
        this.currentMode = 'voice'; // 'voice' or 'touch'
        this.currentView = 'categories'; // 'categories', 'items', 'cart'
        this.currentCategory = null;
        this.isListening = false;
        this.isProcessing = false;
        
        // DEBUG: Error tracking
        this.errorHistory = [];
        this.crashPreventionActive = true;
        
        // Set up global error handlers before initializing managers
        this.setupGlobalErrorHandlers();
        
        // Initialize managers
        this.speechManager = new SpeechManager(this);
        this.touchManager = new TouchManager(this);
        this.cartManager = new CartManager(this);
        this.avatarManager = new AvatarManager(this);
        
        // Initialize the application
        this.init();
    }
    
    setupGlobalErrorHandlers() {
        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('🚨 UNHANDLED PROMISE REJECTION in KioskApp:', event.reason);
            this.logAppError('unhandled_promise_rejection', event.reason);
            
            // Prevent the default behavior (which would crash the app)
            if (this.crashPreventionActive) {
                event.preventDefault();
                this.handleCriticalError('Unhandled promise rejection', event.reason);
            }
        });
        
        // Capture general errors
        window.addEventListener('error', (event) => {
            console.error('🚨 UNHANDLED ERROR in KioskApp:', event.error);
            this.logAppError('unhandled_error', event.error);
            
            if (this.crashPreventionActive) {
                this.handleCriticalError('Unhandled error', event.error);
            }
        });
        
        console.log('🔍 Global error handlers set up for KioskApp');
    }
    
    logAppError(type, error) {
        const errorEntry = {
            type,
            error: error?.message || error,
            stack: error?.stack,
            timestamp: Date.now(),
            appState: {
                currentMode: this.currentMode,
                currentView: this.currentView,
                isListening: this.isListening,
                isProcessing: this.isProcessing,
                speechManagerState: this.speechManager?.getDebugInfo?.() || 'unavailable'
            }
        };
        
        this.errorHistory.push(errorEntry);
        
        // Keep only last 20 errors
        if (this.errorHistory.length > 20) {
            this.errorHistory.shift();
        }
        
        console.error('🔍 APP ERROR LOGGED:', errorEntry);
    }
    
    handleCriticalError(message, error) {
        console.error('🚨 CRITICAL ERROR DETECTED:', message, error);
        
        try {
            // Reset application state to prevent cascading failures
            this.isListening = false;
            this.isProcessing = false;
            
            // Stop speech manager if it exists
            if (this.speechManager) {
                try {
                    this.speechManager.stopListening();
                    this.speechManager.stopSpeaking();
                } catch (speechError) {
                    console.error('Error stopping speech manager:', speechError);
                }
            }
            
            // Update UI to reflect error state
            this.updateVoiceButton(false);
            this.showLoading(false);
            
            // Show user-friendly error message
            if (this.avatarManager) {
                this.avatarManager.speak("I've encountered a technical issue. The system is recovering. Please try again in a moment.");
                this.avatarManager.setEmotion('confused');
            }
            
            // Log debug information
            console.log('🔍 CRITICAL ERROR DEBUG INFO:', {
                speechManagerDebug: this.speechManager?.getDebugInfo?.(),
                errorHistory: this.errorHistory,
                memoryUsage: performance.memory ? {
                    used: performance.memory.usedJSHeapSize / 1024 / 1024,
                    total: performance.memory.totalJSHeapSize / 1024 / 1024
                } : 'unavailable'
            });
            
        } catch (recoveryError) {
            console.error('🚨 ERROR DURING RECOVERY:', recoveryError);
        }
    }

    async init() {
        console.log('Initializing AI Kiosk System...');
        
        try {
            // Set up event listeners
            this.setupEventListeners();
            
            // Set up system event listeners
            this.setupSystemEventListeners();
            
            // Initialize all managers
            await this.speechManager.init();
            await this.touchManager.init();
            await this.cartManager.init();
            await this.avatarManager.init();
            
            // Load initial data
            await this.loadMenuData();
            
            // Set initial mode
            this.setMode(this.currentMode);
            
            // Show welcome message
            this.avatarManager.speak("Welcome! I'm here to help you order. You can speak to me or use the touch screen.");
            this.avatarManager.setEmotion('happy');
            
            console.log('AI Kiosk System initialized successfully');
            this.updateSystemStatus('online');
            
        } catch (error) {
            console.error('Failed to initialize AI Kiosk System:', error);
            this.handleError('Initialization failed', error);
        }
    }

    setupEventListeners() {
        // Mode toggle buttons
        document.getElementById('voice-mode-btn').addEventListener('click', () => {
            this.setMode('voice');
        });
        
        document.getElementById('touch-mode-btn').addEventListener('click', () => {
            this.setMode('touch');
        });
        
        // Voice toggle button
        document.getElementById('voice-toggle').addEventListener('click', () => {
            this.toggleVoiceInput();
        });
        
        // Back to categories button
        document.getElementById('back-to-categories').addEventListener('click', () => {
            this.showCategories();
        });
        
        // Modal close button
        document.getElementById('close-modal').addEventListener('click', () => {
            this.closeModal();
        });
        
        // Checkout button
        document.getElementById('checkout-btn').addEventListener('click', () => {
            this.handleCheckout();
        });
        
        // Keyboard shortcuts for development
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            } else if (e.key === ' ' && e.ctrlKey) {
                e.preventDefault();
                this.toggleVoiceInput();
            }
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }

    setupSystemEventListeners() {
        // Set up listeners for system events from main process
        if (window.electronAPI) {
            // Listen for Python service status updates
            window.electronAPI.onPythonServiceStatus((status) => {
                this.handlePythonServiceStatus(status);
            });

            // Listen for system notifications
            window.electronAPI.onNotification((notification) => {
                this.handleSystemNotification(notification);
            });

            // Listen for raw transcripts (for debugging/display)
            window.electronAPI.onRawTranscript && window.electronAPI.onRawTranscript((data) => {
                console.log('Raw transcript:', data);
                document.getElementById('speech-text').textContent = `Heard: "${data.text}"`;
            });

            // Listen for processed interactions
            window.electronAPI.onProcessedInteraction && window.electronAPI.onProcessedInteraction((data) => {
                console.log('Processed interaction:', data);
            });

            console.log('System event listeners set up');
        }
    }

    handlePythonServiceStatus(status) {
        console.log('Python service status update:', status);
        
        // Update UI based on service status
        const serviceIndicator = document.getElementById('service-status');
        if (serviceIndicator) {
            if (status.overall === 'healthy') {
                serviceIndicator.textContent = '🟢 Speech Service Online';
                serviceIndicator.className = 'service-status online';
            } else if (status.overall === 'degraded') {
                serviceIndicator.textContent = '🟡 Speech Service Degraded';
                serviceIndicator.className = 'service-status degraded';
            } else {
                serviceIndicator.textContent = '🔴 Speech Service Offline';
                serviceIndicator.className = 'service-status offline';
            }
        }
    }

    handleSystemNotification(notification) {
        console.log('System notification:', notification);
        
        // Show notification to user if needed
        if (notification.type === 'warning' || notification.type === 'error') {
            // Could show a toast notification or update status
            console.warn('System notification:', notification.message);
        }
    }

    setMode(mode) {
        this.currentMode = mode;
        
        // Update UI
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        if (mode === 'voice') {
            document.getElementById('voice-mode-btn').classList.add('active');
            document.getElementById('voice-panel').style.display = 'block';
            document.getElementById('touch-panel').style.display = 'none';
            this.avatarManager.speak("Voice mode activated. You can speak to me now.");
        } else {
            document.getElementById('touch-mode-btn').classList.add('active');
            document.getElementById('voice-panel').style.display = 'none';
            document.getElementById('touch-panel').style.display = 'block';
            this.avatarManager.speak("Touch mode activated. You can use the screen to navigate.");
        }
        
        console.log(`Mode switched to: ${mode}`);
    }

    async toggleVoiceInput() {
        try {
            if (this.isListening) {
                await this.stopListening();
            } else {
                await this.startListening();
            }
        } catch (error) {
            console.error('Error in toggleVoiceInput:', error);
            
            // Reset state to prevent inconsistent UI
            this.isListening = false;
            this.updateVoiceButton(false);
            this.avatarManager.setListening(false);
            
            // Provide user feedback
            this.avatarManager.speak("I'm having trouble with voice input right now. Please try again or use the touch screen.");
            this.avatarManager.setEmotion('confused');
            
            // Log error for debugging
            this.handleError('Voice input toggle failed', error);
        }
    }

    async startListening() {
        if (this.isProcessing) return;
        
        try {
            this.isListening = true;
            this.updateVoiceButton(true);
            this.avatarManager.setListening(true);
            
            // Use the speech manager's startListening method
            // The result will come through the speech recognition result handler
            await this.speechManager.startListening();
            
        } catch (error) {
            console.error('Speech recognition error:', error);
            
            // Ensure state is properly reset on error
            this.isListening = false;
            this.updateVoiceButton(false);
            this.avatarManager.setListening(false);
            
            // Provide user feedback
            this.avatarManager.speak("Sorry, I couldn't hear you clearly. Please try again.");
            this.handleError('Speech recognition failed', error);
            
            // Re-throw to allow calling code to handle if needed
            throw error;
        }
    }

    async stopListening() {
        try {
            this.speechManager.stopListening();
            this.isListening = false;
            this.updateVoiceButton(false);
            this.avatarManager.setListening(false);
        } catch (error) {
            console.error('Error stopping speech recognition:', error);
            
            // Ensure state is reset even if stop fails
            this.isListening = false;
            this.updateVoiceButton(false);
            this.avatarManager.setListening(false);
            
            // Log error but don't show user message as this is usually called internally
            this.handleError('Stop listening failed', error);
        }
    }

    async processSpeechInput(transcript) {
        console.log('🔍 Processing speech input:', transcript);
        this.logAppError('speech_processing_start', { transcript });
        
        try {
            this.isProcessing = true;
            this.showLoading(true);
            this.avatarManager.setThinking(true);
            
            // Display what was heard
            document.getElementById('speech-text').textContent = `You said: "${transcript}"`;
            
            // Send to backend for NLU processing
            console.log('🔍 Sending to NLU...');
            const response = await this.sendToNLU(transcript);
            console.log('🔍 NLU response received:', response);
            
            if (response && response.intent) {
                console.log('🔍 Handling NLU response...');
                await this.handleNLUResponse(response);
                console.log('🔍 NLU response handled successfully');
            } else {
                console.warn('⚠️ No valid intent in NLU response');
                this.avatarManager.speak("I'm not sure I understood that. Could you please try again?");
                this.avatarManager.setEmotion('confused');
            }
            
        } catch (error) {
            console.error('🚨 NLU processing error:', error);
            this.logAppError('nlu_processing_error', error);
            
            // Log speech manager state for debugging
            if (this.speechManager) {
                console.log('🔍 Speech manager debug info during NLU error:', this.speechManager.getDebugInfo());
            }
            
            this.avatarManager.speak("I'm having trouble understanding right now. You can use the touch screen instead.");
            this.handleError('NLU processing failed', error);
        } finally {
            console.log('🔍 Speech processing cleanup...');
            this.isProcessing = false;
            this.showLoading(false);
            this.avatarManager.setThinking(false);
        }
    }

    async sendToNLU(text) {
        try {
            // Check if Electron API is available
            if (!window.electronAPI || typeof window.electronAPI.handleSpeechInput !== 'function') {
                console.warn('Electron API not available, using fallback NLU processing');
                // Fallback: Simple pattern matching for basic commands
                return this.fallbackNLUProcessing(text);
            }
            
            // Send to Electron main process for NLU processing
            const response = await window.electronAPI.handleSpeechInput({ text });
            console.log('NLU response received:', response);
            return response;
        } catch (error) {
            console.error('Failed to send to NLU:', error);
            console.warn('Falling back to local NLU processing');
            // Fallback to local processing if Electron IPC fails
            return this.fallbackNLUProcessing(text);
        }
    }

    fallbackNLUProcessing(text) {
        const lowerText = text.toLowerCase();
        console.log('Processing with fallback NLU:', lowerText);
        
        // Simple pattern matching for common intents
        if (lowerText.includes('menu') || lowerText.includes('show') || lowerText.includes('see')) {
            if (lowerText.includes('appetizer')) {
                return { intent: 'browse_menu', entities: { category: 'appetizers' }, response_text: 'Here are our appetizers.' };
            } else if (lowerText.includes('main') || lowerText.includes('entree')) {
                return { intent: 'browse_menu', entities: { category: 'mains' }, response_text: 'Here are our main courses.' };
            } else if (lowerText.includes('drink') || lowerText.includes('beverage')) {
                return { intent: 'browse_menu', entities: { category: 'beverages' }, response_text: 'Here are our beverages.' };
            } else if (lowerText.includes('dessert')) {
                return { intent: 'browse_menu', entities: { category: 'desserts' }, response_text: 'Here are our desserts.' };
            } else {
                return { intent: 'browse_menu', entities: {}, response_text: 'Here is our menu.' };
            }
        } else if (lowerText.includes('add') || lowerText.includes('order') || lowerText.includes('want')) {
            return { intent: 'add_item', entities: {}, response_text: 'What would you like to add to your order?' };
        } else if (lowerText.includes('cart') || lowerText.includes('order')) {
            return { intent: 'view_cart', entities: {}, response_text: 'Here is your current order.' };
        } else if (lowerText.includes('checkout') || lowerText.includes('pay') || lowerText.includes('done')) {
            return { intent: 'checkout', entities: {}, response_text: 'Ready to checkout?' };
        } else if (lowerText.includes('help')) {
            return { intent: 'help', entities: {}, response_text: 'I can help you browse our menu and place an order.' };
        } else if (lowerText.includes('hello') || lowerText.includes('hi')) {
            return { intent: 'greeting', entities: {}, response_text: 'Hello! Welcome to our restaurant.' };
        } else {
            return { intent: 'unknown', entities: {}, response_text: 'I\'m not sure I understood that. Could you please try again?' };
        }
    }

    async handleNLUResponse(response) {
        const { intent, entities, response_text } = response;
        
        console.log('NLU Response:', { intent, entities, response_text });
        
        switch (intent) {
            case 'browse_menu':
                await this.handleBrowseMenu(entities);
                break;
            case 'add_item':
                await this.handleAddItem(entities);
                break;
            case 'view_cart':
                await this.handleViewCart();
                break;
            case 'checkout':
                await this.handleCheckout();
                break;
            case 'help':
                await this.handleHelp();
                break;
            case 'greeting':
                await this.handleGreeting();
                break;
            default:
                this.avatarManager.speak(response_text || "I'm not sure how to help with that. What would you like to order?");
        }
    }

    async handleBrowseMenu(entities) {
        const category = entities?.category;
        
        if (category) {
            this.showMenuItems(category);
            this.avatarManager.speak(`Here are our ${category}. What looks good to you?`);
        } else {
            this.showCategories();
            this.avatarManager.speak("Here's our menu. Which category would you like to explore?");
        }
        
        this.avatarManager.setEmotion('helpful');
    }

    async handleAddItem(entities) {
        const itemName = entities?.item_name;
        const quantity = entities?.quantity || 1;
        
        if (itemName) {
            const item = this.findMenuItem(itemName);
            if (item) {
                this.cartManager.addItem(item, quantity);
                this.avatarManager.speak(`I've added ${quantity} ${item.name} to your cart. Anything else?`);
                this.avatarManager.setEmotion('happy');
            } else {
                this.avatarManager.speak(`I couldn't find ${itemName} on our menu. Would you like to see what we have?`);
                this.avatarManager.setEmotion('confused');
            }
        } else {
            this.avatarManager.speak("What would you like to add to your order?");
        }
    }

    async handleViewCart() {
        const cartItems = this.cartManager.getItems();
        
        if (cartItems.length === 0) {
            this.avatarManager.speak("Your cart is empty. Would you like to see our menu?");
        } else {
            const total = this.cartManager.getTotal();
            this.avatarManager.speak(`You have ${cartItems.length} items in your cart for a total of $${total.toFixed(2)}. Ready to checkout?`);
        }
        
        this.avatarManager.setEmotion('helpful');
    }

    async handleCheckout() {
        const cartItems = this.cartManager.getItems();
        
        if (cartItems.length === 0) {
            this.avatarManager.speak("Your cart is empty. Please add some items first.");
            this.avatarManager.setEmotion('confused');
            return;
        }
        
        // Simulate checkout process
        this.showLoading(true);
        this.avatarManager.speak("Processing your order...");
        
        setTimeout(() => {
            this.showLoading(false);
            this.cartManager.clear();
            this.avatarManager.speak("Thank you for your order! Your order number is 12345. Please wait for your order to be prepared.");
            this.avatarManager.setEmotion('happy');
            this.avatarManager.showGesture('thumbs-up');
        }, 3000);
    }

    async handleHelp() {
        this.avatarManager.speak("I can help you browse our menu, add items to your cart, and place your order. You can speak to me or use the touch screen. What would you like to do?");
        this.avatarManager.setEmotion('helpful');
    }

    async handleGreeting() {
        const greetings = [
            "Hello! Welcome to our restaurant. What can I get for you today?",
            "Hi there! I'm here to help you order. What looks good?",
            "Welcome! Ready to explore our delicious menu?"
        ];
        
        const greeting = greetings[Math.floor(Math.random() * greetings.length)];
        this.avatarManager.speak(greeting);
        this.avatarManager.setEmotion('happy');
        this.avatarManager.showGesture('wave');
    }

    showCategories() {
        this.currentView = 'categories';
        document.getElementById('menu-categories').classList.remove('hidden');
        document.getElementById('menu-items').classList.add('hidden');
        
        // Update touch panel if in touch mode
        if (this.currentMode === 'touch') {
            this.touchManager.showCategories();
        }
    }

    showMenuItems(category) {
        this.currentView = 'items';
        this.currentCategory = category;
        
        document.getElementById('menu-categories').classList.add('hidden');
        document.getElementById('menu-items').classList.remove('hidden');
        document.getElementById('current-category').textContent = category.charAt(0).toUpperCase() + category.slice(1);
        
        // Update touch panel if in touch mode
        if (this.currentMode === 'touch') {
            this.touchManager.showMenuItems(category);
        }
    }

    closeModal() {
        document.getElementById('item-modal').classList.add('hidden');
    }

    updateVoiceButton(isListening) {
        const button = document.getElementById('voice-toggle');
        const buttonText = button.querySelector('.button-text');
        const listeningIndicator = document.getElementById('listening-indicator');
        
        if (isListening) {
            button.classList.add('listening');
            buttonText.textContent = 'Listening...';
            listeningIndicator.classList.remove('hidden');
        } else {
            button.classList.remove('listening');
            buttonText.textContent = 'Tap to Speak';
            listeningIndicator.classList.add('hidden');
        }
    }

    updateSystemStatus(status) {
        const statusElement = document.getElementById('system-status');
        const statusIcon = statusElement.querySelector('.status-icon');
        const statusText = statusElement.querySelector('.status-text');
        
        switch (status) {
            case 'online':
                statusIcon.textContent = '🟢';
                statusText.textContent = 'Online';
                break;
            case 'offline':
                statusIcon.textContent = '🔴';
                statusText.textContent = 'Offline';
                break;
            case 'processing':
                statusIcon.textContent = '🟡';
                statusText.textContent = 'Processing';
                break;
        }
    }

    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    async loadMenuData() {
        try {
            console.log('Loading menu data...');
            
            // Check if Electron API is available
            if (!window.electronAPI || typeof window.electronAPI.handleMenuRequest !== 'function') {
                console.warn('Electron API not available, loading sample menu data');
                this.loadSampleMenuData();
                return;
            }
            
            // Load menu data from backend
            const rawMenuData = await window.electronAPI.handleMenuRequest({ action: 'get_menu' });
            console.log('Raw menu data received:', rawMenuData);
            
            if (rawMenuData && rawMenuData.data && rawMenuData.data.categories) {
                // Transform the data structure from backend format to frontend format
                // Backend: { "data": { "categories": { "appetizers": { "items": [...] } } } }
                // Frontend: { "appetizers": [...] }
                const transformedMenuData = {};
                
                for (const [categoryKey, categoryData] of Object.entries(rawMenuData.data.categories)) {
                    if (categoryData && categoryData.items && Array.isArray(categoryData.items)) {
                        transformedMenuData[categoryKey] = categoryData.items;
                        console.log(`Transformed ${categoryKey}: ${categoryData.items.length} items`);
                    }
                }
                
                this.menuData = transformedMenuData;
                this.touchManager.setMenuData(transformedMenuData);
                console.log('Menu data loaded and transformed successfully:', Object.keys(transformedMenuData));
            } else {
                console.warn('Invalid menu data structure received, falling back to sample data');
                this.loadSampleMenuData();
            }
        } catch (error) {
            console.error('Failed to load menu data:', error);
            console.warn('Falling back to sample menu data');
            this.loadSampleMenuData();
        }
    }

    loadSampleMenuData() {
        // Sample menu data for development
        this.menuData = {
            appetizers: [
                { id: 1, name: "Caesar Salad", price: 8.99, description: "Fresh romaine lettuce with parmesan cheese and croutons" },
                { id: 2, name: "Chicken Wings", price: 12.99, description: "Spicy buffalo wings with ranch dipping sauce" }
            ],
            mains: [
                { id: 3, name: "Grilled Salmon", price: 18.99, description: "Fresh Atlantic salmon with lemon herb seasoning" },
                { id: 4, name: "Beef Burger", price: 14.99, description: "Juicy beef patty with lettuce, tomato, and fries" }
            ],
            beverages: [
                { id: 5, name: "Coca Cola", price: 2.99, description: "Classic refreshing cola drink" },
                { id: 6, name: "Fresh Orange Juice", price: 4.99, description: "Freshly squeezed orange juice" }
            ],
            desserts: [
                { id: 7, name: "Chocolate Cake", price: 6.99, description: "Rich chocolate cake with vanilla ice cream" },
                { id: 8, name: "Apple Pie", price: 5.99, description: "Homemade apple pie with cinnamon" }
            ]
        };
        
        this.touchManager.setMenuData(this.menuData);
        console.log('Sample menu data loaded');
    }

    findMenuItem(itemName) {
        const normalizedName = itemName.toLowerCase();
        
        for (const category in this.menuData) {
            const item = this.menuData[category].find(item => 
                item.name.toLowerCase().includes(normalizedName) ||
                normalizedName.includes(item.name.toLowerCase())
            );
            if (item) return item;
        }
        
        return null;
    }

    // Handle speech input from speech manager
    handleSpeechInput(data) {
        console.log('Speech input received from speech manager:', data);
        
        if (data.text) {
            this.processSpeechInput(data.text).then(() => {
                this.isListening = false;
                this.updateVoiceButton(false);
                this.avatarManager.setListening(false);
            }).catch(error => {
                console.error('Error processing speech input:', error);
                this.isListening = false;
                this.updateVoiceButton(false);
                this.avatarManager.setListening(false);
            });
        }
    }

    handleError(message, error) {
        console.error(message, error);
        this.updateSystemStatus('offline');
        
        // Show user-friendly error message
        this.avatarManager.speak("I'm experiencing some technical difficulties. Please try using the touch screen or contact staff for assistance.");
        this.avatarManager.setEmotion('confused');
    }

    handleResize() {
        // Handle responsive layout adjustments
        const width = window.innerWidth;
        
        if (width < 768) {
            // Mobile layout adjustments
            document.body.classList.add('mobile-layout');
        } else {
            document.body.classList.remove('mobile-layout');
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.kioskApp = new KioskApp();
});

// The Electron API is now provided by the preload script
// No need to set up the bridge here anymore