// Main Application Controller
class KioskApp {
    constructor() {
        this.currentMode = 'voice'; // 'voice' or 'touch'
        this.currentView = 'categories'; // 'categories', 'items', 'cart'
        this.currentCategory = null;
        this.isListening = false;
        this.isProcessing = false;
        
        // Initialize managers
        this.speechManager = new SpeechManager(this);
        this.touchManager = new TouchManager(this);
        this.cartManager = new CartManager(this);
        this.avatarManager = new AvatarManager(this);
        
        // Initialize the application
        this.init();
    }

    async init() {
        console.log('Initializing AI Kiosk System...');
        
        try {
            // Set up event listeners
            this.setupEventListeners();
            
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
        if (this.isListening) {
            await this.stopListening();
        } else {
            await this.startListening();
        }
    }

    async startListening() {
        if (this.isProcessing) return;
        
        try {
            this.isListening = true;
            this.updateVoiceButton(true);
            this.avatarManager.setListening(true);
            
            const result = await this.speechManager.startListening();
            
            if (result && result.transcript) {
                await this.processSpeechInput(result.transcript);
            }
            
        } catch (error) {
            console.error('Speech recognition error:', error);
            this.avatarManager.speak("Sorry, I couldn't hear you clearly. Please try again.");
            this.handleError('Speech recognition failed', error);
        } finally {
            this.isListening = false;
            this.updateVoiceButton(false);
            this.avatarManager.setListening(false);
        }
    }

    async stopListening() {
        this.speechManager.stopListening();
        this.isListening = false;
        this.updateVoiceButton(false);
        this.avatarManager.setListening(false);
    }

    async processSpeechInput(transcript) {
        console.log('Processing speech input:', transcript);
        
        this.isProcessing = true;
        this.showLoading(true);
        this.avatarManager.setThinking(true);
        
        // Display what was heard
        document.getElementById('speech-text').textContent = `You said: "${transcript}"`;
        
        try {
            // Send to backend for NLU processing
            const response = await this.sendToNLU(transcript);
            
            if (response && response.intent) {
                await this.handleNLUResponse(response);
            } else {
                this.avatarManager.speak("I'm not sure I understood that. Could you please try again?");
                this.avatarManager.setEmotion('confused');
            }
            
        } catch (error) {
            console.error('NLU processing error:', error);
            this.avatarManager.speak("I'm having trouble understanding right now. You can use the touch screen instead.");
            this.handleError('NLU processing failed', error);
        } finally {
            this.isProcessing = false;
            this.showLoading(false);
            this.avatarManager.setThinking(false);
        }
    }

    async sendToNLU(text) {
        try {
            // Send to Electron main process for NLU processing
            const response = await window.electronAPI?.invoke('speech-input', { text });
            return response;
        } catch (error) {
            console.error('Failed to send to NLU:', error);
            throw error;
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
            // Load menu data from backend
            const menuData = await window.electronAPI?.invoke('menu-request', { action: 'get_menu' });
            
            if (menuData) {
                this.menuData = menuData;
                this.touchManager.setMenuData(menuData);
                console.log('Menu data loaded successfully');
            } else {
                // Fallback to sample data
                this.loadSampleMenuData();
            }
        } catch (error) {
            console.error('Failed to load menu data:', error);
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

// Handle Electron API availability
if (typeof require !== 'undefined') {
    const { ipcRenderer } = require('electron');
    
    // Set up Electron API bridge
    window.electronAPI = {
        invoke: (channel, data) => ipcRenderer.invoke(channel, data),
        send: (channel, data) => ipcRenderer.send(channel, data),
        on: (channel, callback) => ipcRenderer.on(channel, callback)
    };
}