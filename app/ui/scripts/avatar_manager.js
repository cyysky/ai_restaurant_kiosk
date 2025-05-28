// Avatar Manager - Handles avatar animations and interactions
class AvatarManager {
    constructor(app) {
        this.app = app;
        this.currentEmotion = 'neutral';
        this.isListening = false;
        this.isThinking = false;
        this.isTalking = false;
        this.speechQueue = [];
        this.isProcessingSpeech = false;
        this.animationTimeouts = [];
    }

    async init() {
        console.log('Initializing Avatar Manager...');
        
        try {
            this.setupAvatarElements();
            this.setEmotion('neutral');
            this.startBreathingAnimation();
            
            console.log('Avatar Manager initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Avatar Manager:', error);
            throw error;
        }
    }

    setupAvatarElements() {
        this.avatarContainer = document.getElementById('avatar-container');
        this.avatarDisplay = document.getElementById('avatar-display');
        this.avatarFace = document.querySelector('.avatar-face');
        this.avatarMouth = document.querySelector('.avatar-mouth');
        this.speechBubble = document.getElementById('avatar-speech-bubble');
        this.speechText = document.getElementById('avatar-text');
        
        // Create additional elements for enhanced animations
        this.createStatusIndicators();
        this.createVoiceVisualization();
    }

    createStatusIndicators() {
        // Create status dots
        const statusContainer = document.createElement('div');
        statusContainer.className = 'avatar-status';
        
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.className = 'status-dot';
            dot.dataset.index = i;
            statusContainer.appendChild(dot);
        }
        
        this.avatarDisplay.appendChild(statusContainer);
        this.statusDots = statusContainer.querySelectorAll('.status-dot');
    }

    createVoiceVisualization() {
        // Create voice wave visualization
        const voiceWave = document.createElement('div');
        voiceWave.className = 'avatar-voice-wave';
        
        for (let i = 0; i < 5; i++) {
            const bar = document.createElement('div');
            bar.className = 'voice-bar';
            voiceWave.appendChild(bar);
        }
        
        this.avatarDisplay.appendChild(voiceWave);
        this.voiceWave = voiceWave;
    }

    setEmotion(emotion) {
        console.log('Setting avatar emotion:', emotion);
        
        // Remove previous emotion classes
        this.avatarFace.className = 'avatar-face';
        
        // Add new emotion class
        this.avatarFace.classList.add(emotion);
        this.currentEmotion = emotion;
        
        // Update status indicator
        this.updateStatusIndicator('emotion', emotion);
        
        // Trigger emotion-specific animations
        this.triggerEmotionAnimation(emotion);
    }

    triggerEmotionAnimation(emotion) {
        const placeholder = document.querySelector('.avatar-placeholder');
        
        // Remove previous animation classes
        placeholder.classList.remove('feedback-positive', 'feedback-negative', 'feedback-neutral');
        
        // Add emotion-specific feedback
        switch (emotion) {
            case 'happy':
                placeholder.classList.add('feedback-positive');
                break;
            case 'sad':
            case 'confused':
                placeholder.classList.add('feedback-negative');
                break;
            default:
                placeholder.classList.add('feedback-neutral');
        }
        
        // Remove animation class after animation completes
        setTimeout(() => {
            placeholder.classList.remove('feedback-positive', 'feedback-negative', 'feedback-neutral');
        }, 600);
    }

    setListening(isListening) {
        console.log('Setting avatar listening state:', isListening);
        
        this.isListening = isListening;
        const placeholder = document.querySelector('.avatar-placeholder');
        
        if (isListening) {
            placeholder.classList.add('listening');
            this.voiceWave.classList.add('active');
            this.updateStatusIndicator('listening', true);
            this.showSpeechBubble("I'm listening...");
        } else {
            placeholder.classList.remove('listening');
            this.voiceWave.classList.remove('active');
            this.updateStatusIndicator('listening', false);
            this.hideSpeechBubble();
        }
    }

    setThinking(isThinking) {
        console.log('Setting avatar thinking state:', isThinking);
        
        this.isThinking = isThinking;
        const placeholder = document.querySelector('.avatar-placeholder');
        
        if (isThinking) {
            placeholder.classList.add('thinking');
            this.updateStatusIndicator('processing', true);
            this.showSpeechBubble("Let me think...");
        } else {
            placeholder.classList.remove('thinking');
            this.updateStatusIndicator('processing', false);
        }
    }

    setTalking(isTalking) {
        this.isTalking = isTalking;
        const placeholder = document.querySelector('.avatar-placeholder');
        
        if (isTalking) {
            placeholder.classList.add('talking');
            this.avatarFace.classList.add('talking');
        } else {
            placeholder.classList.remove('talking');
            this.avatarFace.classList.remove('talking');
        }
    }

    async speak(text, options = {}) {
        if (!text) return;
        
        console.log('Avatar speaking:', text);
        
        // Add to speech queue
        this.speechQueue.push({ text, options });
        
        // Process queue if not already processing
        if (!this.isProcessingSpeech) {
            await this.processSpeechQueue();
        }
    }

    async processSpeechQueue() {
        this.isProcessingSpeech = true;
        
        while (this.speechQueue.length > 0) {
            const { text, options } = this.speechQueue.shift();
            await this.speakImmediate(text, options);
        }
        
        this.isProcessingSpeech = false;
    }

    async speakImmediate(text, options = {}) {
        try {
            // Show speech bubble
            this.showSpeechBubble(text);
            
            // Set talking animation
            this.setTalking(true);
            
            // Use speech manager for actual TTS
            if (this.app.speechManager) {
                await this.app.speechManager.speak(text, options);
            } else {
                // Fallback: simulate speech duration
                const duration = text.length * 50; // 50ms per character
                await new Promise(resolve => setTimeout(resolve, duration));
            }
            
        } catch (error) {
            console.error('Avatar speech error:', error);
        } finally {
            // Stop talking animation
            this.setTalking(false);
            
            // Hide speech bubble after a delay
            setTimeout(() => {
                this.hideSpeechBubble();
            }, 2000);
        }
    }

    showSpeechBubble(text) {
        this.speechText.textContent = text;
        this.speechBubble.classList.remove('hidden');
        this.speechBubble.classList.add('visible');
        
        // Add typing effect
        this.speechBubble.classList.add('typing');
        setTimeout(() => {
            this.speechBubble.classList.remove('typing');
        }, 500);
    }

    hideSpeechBubble() {
        this.speechBubble.classList.remove('visible');
        setTimeout(() => {
            this.speechBubble.classList.add('hidden');
        }, 300);
    }

    showGesture(gestureType) {
        console.log('Showing avatar gesture:', gestureType);
        
        // Create gesture element
        const gesture = document.createElement('div');
        gesture.className = `avatar-gesture ${gestureType}`;
        
        // Set gesture content
        switch (gestureType) {
            case 'wave':
                gesture.textContent = '👋';
                break;
            case 'thumbs-up':
                gesture.textContent = '👍';
                break;
            case 'point':
                gesture.textContent = '👉';
                break;
            case 'heart':
                gesture.textContent = '❤️';
                break;
            default:
                gesture.textContent = '✨';
        }
        
        // Add to avatar display
        this.avatarDisplay.appendChild(gesture);
        
        // Remove after animation
        setTimeout(() => {
            if (gesture.parentNode) {
                gesture.parentNode.removeChild(gesture);
            }
        }, 1200);
    }

    updateStatusIndicator(type, state) {
        if (!this.statusDots) return;
        
        switch (type) {
            case 'listening':
                this.statusDots[0].classList.toggle('active', state);
                break;
            case 'processing':
                this.statusDots[1].classList.toggle('processing', state);
                break;
            case 'emotion':
                // Update based on emotion
                this.statusDots[2].classList.remove('active', 'processing', 'error');
                if (state === 'happy') {
                    this.statusDots[2].classList.add('active');
                } else if (state === 'confused' || state === 'sad') {
                    this.statusDots[2].classList.add('error');
                }
                break;
        }
    }

    startBreathingAnimation() {
        const placeholder = document.querySelector('.avatar-placeholder');
        placeholder.classList.add('avatar-breathing');
    }

    stopBreathingAnimation() {
        const placeholder = document.querySelector('.avatar-placeholder');
        placeholder.classList.remove('avatar-breathing');
    }

    // Attention management
    setAttentionLevel(level) {
        const placeholder = document.querySelector('.avatar-placeholder');
        
        // Remove previous attention classes
        placeholder.classList.remove('avatar-attention-high', 'avatar-attention-low');
        
        switch (level) {
            case 'high':
                placeholder.classList.add('avatar-attention-high');
                break;
            case 'low':
                placeholder.classList.add('avatar-attention-low');
                break;
            default:
                // Normal attention - no special class
                break;
        }
    }

    // Loading state
    setLoading(isLoading) {
        const placeholder = document.querySelector('.avatar-placeholder');
        
        if (isLoading) {
            placeholder.classList.add('avatar-loading');
        } else {
            placeholder.classList.remove('avatar-loading');
        }
    }

    // Contextual responses
    respondToContext(context) {
        switch (context) {
            case 'order_complete':
                this.setEmotion('happy');
                this.showGesture('thumbs-up');
                this.speak("Your order is complete! Thank you!");
                break;
            case 'error':
                this.setEmotion('confused');
                this.speak("I'm sorry, something went wrong. Let me help you.");
                break;
            case 'welcome':
                this.setEmotion('happy');
                this.showGesture('wave');
                this.speak("Welcome! I'm here to help you order.");
                break;
            case 'goodbye':
                this.setEmotion('happy');
                this.showGesture('wave');
                this.speak("Thank you for visiting! Have a great day!");
                break;
        }
    }

    // Interactive responses
    reactToUserAction(action) {
        switch (action) {
            case 'item_added':
                this.setEmotion('happy');
                this.showGesture('thumbs-up');
                break;
            case 'cart_cleared':
                this.setEmotion('neutral');
                break;
            case 'checkout_started':
                this.setEmotion('helpful');
                break;
            case 'voice_activated':
                this.setEmotion('helpful');
                this.setAttentionLevel('high');
                break;
            case 'touch_activated':
                this.setEmotion('neutral');
                this.setAttentionLevel('normal');
                break;
        }
    }

    // Idle behavior
    startIdleBehavior() {
        // Implement subtle idle animations
        const idleInterval = setInterval(() => {
            if (!this.isListening && !this.isThinking && !this.isTalking) {
                // Random subtle movements
                const actions = ['blink', 'slight_head_turn', 'micro_expression'];
                const randomAction = actions[Math.floor(Math.random() * actions.length)];
                this.performIdleAction(randomAction);
            }
        }, 5000); // Every 5 seconds
        
        this.idleInterval = idleInterval;
    }

    performIdleAction(action) {
        const placeholder = document.querySelector('.avatar-placeholder');
        
        switch (action) {
            case 'blink':
                // Trigger blink animation (already in CSS)
                break;
            case 'slight_head_turn':
                placeholder.style.transform = 'rotate(2deg)';
                setTimeout(() => {
                    placeholder.style.transform = '';
                }, 1000);
                break;
            case 'micro_expression':
                this.setEmotion('helpful');
                setTimeout(() => {
                    this.setEmotion('neutral');
                }, 2000);
                break;
        }
    }

    stopIdleBehavior() {
        if (this.idleInterval) {
            clearInterval(this.idleInterval);
            this.idleInterval = null;
        }
    }

    // Cleanup
    destroy() {
        // Clear all timeouts
        this.animationTimeouts.forEach(timeout => clearTimeout(timeout));
        this.animationTimeouts = [];
        
        // Stop idle behavior
        this.stopIdleBehavior();
        
        // Clear speech queue
        this.speechQueue = [];
        
        // Stop any ongoing speech
        if (this.app.speechManager) {
            this.app.speechManager.stopSpeaking();
        }
        
        console.log('Avatar Manager destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AvatarManager;
}