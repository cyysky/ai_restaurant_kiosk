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
            
            // Update UI to reflect error state using safe DOM utilities
            console.log('🔍 Updating UI during critical error recovery...');
            
            // Use batch operations for safer recovery
            const recoveryOperations = [
                { type: 'class', elementId: 'voice-toggle', action: 'remove', className: 'listening' },
                { type: 'class', elementId: 'listening-indicator', action: 'add', className: 'hidden' },
                { type: 'class', elementId: 'loading-overlay', action: 'add', className: 'hidden' }
            ];
            
            const results = domUtils.safeBatchUpdate(recoveryOperations);
            
            if (results.failed > 0) {
                console.error('🚨 UI recovery partially failed:', results.errors);
            } else {
                console.log('✅ UI recovery completed successfully');
            }
            
            // Update button text safely
            const buttonText = domUtils.safeQuerySelector('voice-toggle', '.button-text');
            if (buttonText) {
                try {
                    buttonText.textContent = 'Tap to Speak';
                } catch (textError) {
                    console.error('Error updating button text during recovery:', textError);
                }
            }
            
            // Show user-friendly error message
            if (this.avatarManager) {
                this.avatarManager.speak("I've encountered a technical issue. The system is recovering. Please try again in a moment.");
                this.avatarManager.setEmotion('confused');
            }
            
            // Log debug information
            console.log('🔍 CRITICAL ERROR DEBUG INFO:', {
                speechManagerDebug: this.speechManager?.getDebugInfo?.(),
                errorHistory: this.errorHistory,
                domCacheStats: domUtils.getCacheStats(),
                memoryUsage: performance.memory ? {
                    used: performance.memory.usedJSHeapSize / 1024 / 1024,
                    total: performance.memory.totalJSHeapSize / 1024 / 1024
                } : 'unavailable'
            });
            
            // Clear DOM cache to force fresh lookups after recovery
            domUtils.clearCache();
            
        } catch (recoveryError) {
            console.error('🚨 ERROR DURING RECOVERY:', recoveryError);
            
            // Last resort: try to at least clear the DOM cache
            try {
                domUtils.clearCache();
            } catch (cacheError) {
                console.error('🚨 Failed to clear DOM cache during recovery:', cacheError);
            }
        }
    }

    async init() {
        console.log('Initializing AI Kiosk System...');
        
        try {
            // Validate critical DOM elements first
            await this.validateCriticalElements();
            
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

    async validateCriticalElements() {
        console.log('🔍 Validating critical DOM elements...');
        
        const criticalElements = [
            'voice-toggle',
            'listening-indicator',
            'speech-text',
            'loading-overlay',
            'voice-mode-btn',
            'touch-mode-btn',
            'voice-panel',
            'touch-panel',
            'menu-categories',
            'menu-items',
            'back-to-categories',
            'close-modal',
            'checkout-btn',
            'system-status'
        ];
        
        // Wait a moment for DOM to be fully ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const validation = domUtils.validateCriticalElements(criticalElements);
        
        if (!validation.allFound) {
            const error = new Error(`Critical DOM elements missing: ${validation.missing.join(', ')}`);
            this.logAppError('critical_elements_missing', {
                missing: validation.missing,
                found: validation.found,
                details: validation.details
            });
            
            // Try to recover by waiting and re-checking
            console.warn('⚠️ Attempting DOM recovery...');
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const retryValidation = domUtils.validateCriticalElements(validation.missing);
            if (!retryValidation.allFound) {
                throw error;
            } else {
                console.log('✅ DOM recovery successful');
            }
        } else {
            console.log('✅ All critical DOM elements validated successfully');
        }
        
        // Clear any cached elements to ensure fresh lookups
        domUtils.clearCache();
    }

    setupEventListeners() {
        console.log('🔍 DEBUG: Setting up event listeners...');
        
        // Mode toggle buttons
        const voiceModeBtn = document.getElementById('voice-mode-btn');
        console.log('🔍 DEBUG: voice-mode-btn element:', voiceModeBtn);
        if (voiceModeBtn) {
            voiceModeBtn.addEventListener('click', () => {
                this.setMode('voice');
            });
        } else {
            console.error('🚨 CRITICAL: voice-mode-btn element not found during setup!');
            this.logAppError('missing_voice_mode_btn_setup', { timestamp: Date.now() });
        }
        
        const touchModeBtn = document.getElementById('touch-mode-btn');
        console.log('🔍 DEBUG: touch-mode-btn element:', touchModeBtn);
        if (touchModeBtn) {
            touchModeBtn.addEventListener('click', () => {
                this.setMode('touch');
            });
        } else {
            console.error('🚨 CRITICAL: touch-mode-btn element not found during setup!');
            this.logAppError('missing_touch_mode_btn_setup', { timestamp: Date.now() });
        }
        
        // Voice toggle button
        const voiceToggle = document.getElementById('voice-toggle');
        console.log('🔍 DEBUG: voice-toggle element during setup:', voiceToggle);
        if (voiceToggle) {
            voiceToggle.addEventListener('click', () => {
                this.toggleVoiceInput();
            });
        } else {
            console.error('🚨 CRITICAL: voice-toggle element not found during setup!');
            this.logAppError('missing_voice_toggle_setup', { timestamp: Date.now() });
        }
        
        // Back to categories button
        const backToCategories = document.getElementById('back-to-categories');
        console.log('🔍 DEBUG: back-to-categories element:', backToCategories);
        if (backToCategories) {
            backToCategories.addEventListener('click', () => {
                this.showCategories();
            });
        } else {
            console.error('🚨 CRITICAL: back-to-categories element not found during setup!');
            this.logAppError('missing_back_to_categories_setup', { timestamp: Date.now() });
        }
        
        // Modal close button
        const closeModal = document.getElementById('close-modal');
        console.log('🔍 DEBUG: close-modal element:', closeModal);
        if (closeModal) {
            closeModal.addEventListener('click', () => {
                this.closeModal();
            });
        } else {
            console.error('🚨 CRITICAL: close-modal element not found during setup!');
            this.logAppError('missing_close_modal_setup', { timestamp: Date.now() });
        }
        
        // Checkout button
        const checkoutBtn = document.getElementById('checkout-btn');
        console.log('🔍 DEBUG: checkout-btn element:', checkoutBtn);
        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', () => {
                this.handleCheckout();
            });
        } else {
            console.error('🚨 CRITICAL: checkout-btn element not found during setup!');
            this.logAppError('missing_checkout_btn_setup', { timestamp: Date.now() });
        }
        
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
                
                console.log('🔍 DEBUG: Attempting to update speech-text from raw transcript...');
                const success = domUtils.safeUpdateText('speech-text', `Heard: "${data.text}"`);
                
                if (!success) {
                    console.error('🚨 CRITICAL: Failed to update speech-text from raw transcript!');
                    this.logAppError('speech_text_raw_transcript_failed', { data, timestamp: Date.now() });
                } else {
                    console.log('🔍 DEBUG: Speech text updated successfully from raw transcript');
                }
            });

            // Listen for processed interactions
            window.electronAPI.onProcessedInteraction && window.electronAPI.onProcessedInteraction((data) => {
                console.log('Processed interaction:', data);
            });

            // 🔍 DEBUG: Listen for UI update events from backend
            window.electronAPI.onUIUpdate && window.electronAPI.onUIUpdate((update) => {
                console.log('🔍 UI UPDATE EVENT RECEIVED:', update);
                this.handleUIUpdate(update);
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

    handleUIUpdate(update) {
        console.log('🔍 HANDLING UI UPDATE:', update);
        
        // 🔍 FIX: Handle IPC serialization corruption
        let processedUpdate = update;
        
        // Check if the update object has been corrupted by IPC
        if (update && typeof update === 'object') {
            // Try to access properties directly - if they're undefined, the object is corrupted
            if (update.type === undefined && update.data === undefined) {
                console.log('🔍 FIX: Detected corrupted UI update object, attempting reconstruction');
                
                // Try to extract from the object's internal structure
                const keys = Object.getOwnPropertyNames(update);
                console.log('🔍 FIX: Available property names:', keys);
                
                // Check if it's a serialized object that needs manual reconstruction
                if (keys.length === 0) {
                    console.error('🔍 FIX: UI update object is completely empty, cannot recover');
                    return;
                }
                
                // Try to reconstruct from prototype or descriptor
                try {
                    const descriptor = Object.getOwnPropertyDescriptor(update, 'type');
                    if (descriptor) {
                        console.log('🔍 FIX: Found type descriptor:', descriptor);
                    }
                    
                    // Last resort: check if it's a stringified object in disguise
                    const updateStr = String(update);
                    if (updateStr !== '[object Object]') {
                        console.log('🔍 FIX: Attempting to parse string representation:', updateStr);
                        processedUpdate = JSON.parse(updateStr);
                    } else {
                        console.error('🔍 FIX: Cannot recover UI update structure');
                        return;
                    }
                } catch (reconstructError) {
                    console.error('🔍 FIX: Failed to reconstruct UI update:', reconstructError);
                    return;
                }
            } else {
                // Object seems intact
                processedUpdate = update;
            }
        } else {
            console.error('🔍 FIX: Invalid UI update object type:', typeof update);
            return;
        }
        
        // Validate the processed update
        if (!processedUpdate || !processedUpdate.type) {
            console.error('🔍 FIX: Processed UI update still missing type field:', processedUpdate);
            return;
        }
        
        console.log('🔍 FIX: Successfully processed UI update:', processedUpdate);
        update = processedUpdate;
        
        switch (update.type) {
            case 'show-categories':
                console.log('🔍 UI Update: Showing categories');
                this.showCategories();
                break;
            case 'show-category':
                console.log('🔍 UI Update: Showing category items for:', update.data.category);
                this.showMenuItems(update.data.category);
                break;
            case 'show-cart':
                console.log('🔍 UI Update: Showing cart');
                // Handle cart display
                break;
            case 'process-checkout':
                console.log('🔍 UI Update: Processing checkout');
                this.handleCheckout();
                break;
            case 'end-session':
                console.log('🔍 UI Update: Ending session');
                // Handle session end
                break;
            default:
                console.warn('🔍 Unknown UI update type:', update.type);
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
            
            // Display what was heard using safe DOM utilities
            console.log('🔍 DEBUG: Attempting to update speech-text element...');
            const success = domUtils.safeUpdateText('speech-text', `You said: "${transcript}"`);
            
            if (!success) {
                console.error('🚨 CRITICAL: Failed to update speech-text during processing!');
                this.logAppError('speech_text_update_failed', { transcript, timestamp: Date.now() });
            } else {
                console.log('🔍 DEBUG: Speech text updated successfully during processing');
            }
            
            // Send to backend for NLU processing
            console.log('🔍 Sending to NLU...');
            const response = await this.sendToNLU(transcript);
            console.log('🔍 NLU response received:', response);
            
            if (response && response.intent) {
                console.log('🔍 Valid intent found:', response.intent, 'with entities:', response.entities);
                console.log('🔍 Handling NLU response...');
                await this.handleNLUResponse(response);
                console.log('🔍 NLU response handled successfully');
            } else {
                console.warn('⚠️ No valid intent in NLU response:', response);
                this.logAppError('invalid_nlu_response', { transcript, response });
                this.avatarManager.speak("I'm not sure I understood that. Could you please try again?");
                this.avatarManager.setEmotion('confused');
            }
            
        } catch (error) {
            console.error('🚨 NLU processing error:', error);
            this.logAppError('nlu_processing_error', error);
            
            // Enhanced error logging for debugging
            console.error('🔍 Error details:', {
                message: error.message,
                stack: error.stack,
                transcript: transcript,
                timestamp: Date.now()
            });
            
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
            console.log('🔍 NLU response received:', response);
            
            // Validate response structure
            if (response && response.success && response.intent) {
                return {
                    intent: response.intent,
                    entities: response.entities || {},
                    confidence: response.confidence || 0.8,
                    response_text: response.response_text
                };
            } else if (response && response.intent) {
                // Handle case where success flag might be missing but intent exists
                return {
                    intent: response.intent,
                    entities: response.entities || {},
                    confidence: response.confidence || 0.8,
                    response_text: response.response_text
                };
            } else {
                console.warn('⚠️ Invalid NLU response structure:', response);
                return this.fallbackNLUProcessing(text);
            }
        } catch (error) {
            console.error('🚨 Failed to send to NLU:', error);
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
        
        console.log('🔍 HANDLE BROWSE MENU called with category:', category);
        console.log('🔍 Current mode:', this.currentMode);
        console.log('🔍 Current view:', this.currentView);
        
        if (category) {
            console.log('🔍 Showing menu items for category:', category);
            this.showMenuItems(category);
            this.avatarManager.speak(`Here are our ${category}. What looks good to you?`);
        } else {
            console.log('🔍 Showing categories menu');
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
        console.log('🔍 SHOW CATEGORIES called');
        console.log('🔍 Current mode:', this.currentMode);
        
        this.currentView = 'categories';
        
        const categoriesElement = document.getElementById('menu-categories');
        const itemsElement = document.getElementById('menu-items');
        
        console.log('🔍 Categories element found:', !!categoriesElement);
        console.log('🔍 Items element found:', !!itemsElement);
        
        if (categoriesElement) {
            categoriesElement.classList.remove('hidden');
            console.log('🔍 Categories element made visible');
        }
        
        if (itemsElement) {
            itemsElement.classList.add('hidden');
            console.log('🔍 Items element hidden');
        }
        
        // Update touch panel if in touch mode
        if (this.currentMode === 'touch') {
            console.log('🔍 Calling touchManager.showCategories()');
            this.touchManager.showCategories();
        } else {
            console.log('🔍 Voice mode - ensuring menu is visible in voice panel');
            // In voice mode, we need to ensure the menu is visible
            const touchPanel = document.getElementById('touch-panel');
            if (touchPanel) {
                touchPanel.style.display = 'block';
                console.log('🔍 Touch panel made visible for voice mode menu display');
            }
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
        console.log('🔍 DEBUG: updateVoiceButton called with isListening:', isListening);
        
        // Use safe DOM utilities for race condition prevention
        const operations = [];
        
        if (isListening) {
            operations.push(
                { type: 'class', elementId: 'voice-toggle', action: 'add', className: 'listening' },
                { type: 'class', elementId: 'listening-indicator', action: 'remove', className: 'hidden' }
            );
            
            // Update button text safely
            if (domUtils.safeUpdateText('voice-toggle', 'Listening...')) {
                // If direct text update fails, try querySelector approach
                const buttonText = domUtils.safeQuerySelector('voice-toggle', '.button-text');
                if (buttonText) {
                    try {
                        buttonText.textContent = 'Listening...';
                        console.log('🔍 DEBUG: Button text updated via querySelector');
                    } catch (error) {
                        console.error('🚨 ERROR updating button text:', error);
                        this.logAppError('button_text_update_error', error);
                    }
                }
            }
        } else {
            operations.push(
                { type: 'class', elementId: 'voice-toggle', action: 'remove', className: 'listening' },
                { type: 'class', elementId: 'listening-indicator', action: 'add', className: 'hidden' }
            );
            
            // Update button text safely
            if (!domUtils.safeUpdateText('voice-toggle', 'Tap to Speak')) {
                // If direct text update fails, try querySelector approach
                const buttonText = domUtils.safeQuerySelector('voice-toggle', '.button-text');
                if (buttonText) {
                    try {
                        buttonText.textContent = 'Tap to Speak';
                        console.log('🔍 DEBUG: Button text updated via querySelector');
                    } catch (error) {
                        console.error('🚨 ERROR updating button text:', error);
                        this.logAppError('button_text_update_error', error);
                    }
                }
            }
        }
        
        // Perform batch update for class changes
        const results = domUtils.safeBatchUpdate(operations);
        
        if (results.failed > 0) {
            console.error('🚨 CRITICAL: Voice button update failed:', results.errors);
            this.logAppError('voice_button_batch_update_failed', {
                isListening,
                results,
                timestamp: Date.now()
            });
        } else {
            console.log('🔍 DEBUG: Voice button updated successfully');
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
        console.log('🔍 DEBUG: showLoading called with show:', show);
        
        // Use safe DOM utilities to prevent race conditions
        const action = show ? 'remove' : 'add';
        const success = domUtils.safeUpdateClass('loading-overlay', action, 'hidden');
        
        if (!success) {
            console.error('🚨 CRITICAL: Failed to update loading overlay!');
            this.logAppError('loading_overlay_update_failed', {
                show,
                action,
                timestamp: Date.now()
            });
        } else {
            console.log(`🔍 DEBUG: Loading overlay ${show ? 'shown' : 'hidden'} successfully`);
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