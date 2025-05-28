// Touch Manager - Handles touch interactions and menu navigation
class TouchManager {
    constructor(app) {
        this.app = app;
        this.menuData = null;
        this.currentCategory = null;
        this.selectedItem = null;
        this.touchStartTime = 0;
        this.touchStartPos = { x: 0, y: 0 };
        this.isInitialized = false;
        this.longPressTimer = null;
    }

    async init() {
        console.log('Initializing Touch Manager...');
        
        try {
            this.setupEventListeners();
            this.setupGestureHandlers();
            this.isInitialized = true;
            
            console.log('Touch Manager initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Touch Manager:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // Category button clicks
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = e.currentTarget.dataset.category;
                this.handleCategorySelect(category);
            });
            
            // Add touch feedback
            this.addTouchFeedback(btn);
        });

        // Modal quantity controls
        document.getElementById('decrease-qty').addEventListener('click', () => {
            this.adjustQuantity(-1);
        });
        
        document.getElementById('increase-qty').addEventListener('click', () => {
            this.adjustQuantity(1);
        });
        
        document.getElementById('add-to-cart').addEventListener('click', () => {
            this.addSelectedItemToCart();
        });

        // Cart item controls - Enhanced event delegation with debugging
        document.addEventListener('click', (e) => {
            console.log('🔍 Document click detected:', e.target);
            
            if (e.target.classList.contains('cart-qty-btn')) {
                console.log('🔍 Cart button clicked:', e.target);
                
                const action = e.target.dataset.action;
                const itemId = e.target.getAttribute('data-item-id'); // Use getAttribute for hyphenated attributes
                
                console.log('🔍 Button action:', action);
                console.log('🔍 Button itemId:', itemId);
                
                if (action && itemId) {
                    console.log('🔍 Calling handleCartQuantityChange with:', itemId, action);
                    this.handleCartQuantityChange(itemId, action);
                } else {
                    console.error('❌ Missing action or itemId:', { action, itemId });
                }
            }
        });
    }

    setupGestureHandlers() {
        // Swipe gestures for navigation
        const interactionSection = document.querySelector('.interaction-section');
        
        interactionSection.addEventListener('touchstart', (e) => {
            this.touchStartTime = Date.now();
            this.touchStartPos = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
        });
        
        interactionSection.addEventListener('touchend', (e) => {
            const touchEndTime = Date.now();
            const touchEndPos = {
                x: e.changedTouches[0].clientX,
                y: e.changedTouches[0].clientY
            };
            
            this.handleSwipeGesture(touchEndTime, touchEndPos);
        });

        // Long press for item details
        document.addEventListener('touchstart', (e) => {
            if (e.target.closest('.item-card')) {
                this.startLongPress(e.target.closest('.item-card'));
            }
        });
        
        document.addEventListener('touchend', () => {
            this.cancelLongPress();
        });
    }

    addTouchFeedback(element) {
        element.addEventListener('touchstart', () => {
            element.classList.add('touch-active');
        });
        
        element.addEventListener('touchend', () => {
            setTimeout(() => {
                element.classList.remove('touch-active');
            }, 150);
        });
        
        element.addEventListener('touchcancel', () => {
            element.classList.remove('touch-active');
        });
    }

    handleCategorySelect(category) {
        console.log('Category selected:', category);
        
        this.currentCategory = category;
        this.app.showMenuItems(category);
        
        // Provide haptic feedback
        this.triggerHapticFeedback('light');
        
        // Update avatar
        this.app.avatarManager.speak(`Showing ${category}. What looks good to you?`);
        this.app.avatarManager.setEmotion('helpful');
    }

    setMenuData(menuData) {
        this.menuData = menuData;
        this.renderCategories();
    }

    renderCategories() {
        if (!this.menuData) return;
        
        const categoryGrid = document.querySelector('.category-grid');
        if (!categoryGrid) return;
        
        // Categories are already in HTML, just ensure they're visible
        const categories = Object.keys(this.menuData);
        
        document.querySelectorAll('.category-btn').forEach(btn => {
            const category = btn.dataset.category;
            if (categories.includes(category)) {
                btn.style.display = 'flex';
            } else {
                btn.style.display = 'none';
            }
        });
    }

    showCategories() {
        this.currentCategory = null;
        document.getElementById('menu-categories').classList.remove('hidden');
        document.getElementById('menu-items').classList.add('hidden');
    }

    showMenuItems(category) {
        if (!this.menuData || !this.menuData[category]) {
            console.error('No menu data for category:', category);
            return;
        }
        
        this.currentCategory = category;
        const items = this.menuData[category];
        
        // Update UI
        document.getElementById('menu-categories').classList.add('hidden');
        document.getElementById('menu-items').classList.remove('hidden');
        document.getElementById('current-category').textContent = 
            category.charAt(0).toUpperCase() + category.slice(1);
        
        // Render items
        this.renderMenuItems(items);
    }

    renderMenuItems(items) {
        const itemsGrid = document.getElementById('items-grid');
        itemsGrid.innerHTML = '';
        
        items.forEach(item => {
            const itemCard = this.createItemCard(item);
            itemsGrid.appendChild(itemCard);
        });
    }

    createItemCard(item) {
        const card = document.createElement('div');
        card.className = 'item-card touch-feedback';
        card.dataset.itemId = item.id;
        
        card.innerHTML = `
            <div class="item-image">
                <div class="image-placeholder">🍽️</div>
            </div>
            <div class="item-name">${item.name}</div>
            <div class="item-description">${item.description}</div>
            <div class="item-price">$${item.price.toFixed(2)}</div>
        `;
        
        // Add click handler
        card.addEventListener('click', () => {
            this.showItemModal(item);
        });
        
        // Add touch feedback
        this.addTouchFeedback(card);
        
        return card;
    }

    showItemModal(item) {
        this.selectedItem = item;
        
        // Update modal content
        document.getElementById('modal-item-name').textContent = item.name;
        document.getElementById('modal-item-description').textContent = item.description;
        document.getElementById('modal-item-price').textContent = `$${item.price.toFixed(2)}`;
        document.getElementById('item-quantity').textContent = '1';
        
        // Show modal
        document.getElementById('item-modal').classList.remove('hidden');
        
        // Trigger haptic feedback
        this.triggerHapticFeedback('medium');
        
        // Update avatar
        this.app.avatarManager.speak(`${item.name} - ${item.description}. How many would you like?`);
    }

    adjustQuantity(delta) {
        const quantityElement = document.getElementById('item-quantity');
        let quantity = parseInt(quantityElement.textContent);
        
        quantity = Math.max(1, quantity + delta);
        quantityElement.textContent = quantity;
        
        // Trigger haptic feedback
        this.triggerHapticFeedback('light');
    }

    addSelectedItemToCart() {
        if (!this.selectedItem) return;
        
        const quantity = parseInt(document.getElementById('item-quantity').textContent);
        
        // Add to cart
        this.app.cartManager.addItem(this.selectedItem, quantity);
        
        // Close modal
        this.app.closeModal();
        
        // Trigger haptic feedback
        this.triggerHapticFeedback('heavy');
        
        // Update avatar
        this.app.avatarManager.speak(`Added ${quantity} ${this.selectedItem.name} to your cart!`);
        this.app.avatarManager.setEmotion('happy');
        
        this.selectedItem = null;
    }

    handleCartQuantityChange(itemId, action) {
        console.log('🔍 handleCartQuantityChange called with:', { itemId, action });
        
        // Convert itemId to number if it's a string (for consistency)
        const numericItemId = parseInt(itemId);
        console.log('🔍 Converted itemId to:', numericItemId);
        
        const item = this.app.cartManager.getItemById(numericItemId);
        console.log('🔍 Found item:', item);
        
        if (!item) {
            console.error('❌ Item not found in cart:', numericItemId);
            return;
        }
        
        console.log('🔍 Processing action:', action);
        
        if (action === 'increase') {
            console.log('🔍 Increasing quantity from', item.quantity, 'to', item.quantity + 1);
            this.app.cartManager.updateQuantity(numericItemId, item.quantity + 1);
        } else if (action === 'decrease') {
            if (item.quantity > 1) {
                console.log('🔍 Decreasing quantity from', item.quantity, 'to', item.quantity - 1);
                this.app.cartManager.updateQuantity(numericItemId, item.quantity - 1);
            } else {
                console.log('🔍 Removing item (quantity would be 0)');
                this.app.cartManager.removeItem(numericItemId);
            }
        } else if (action === 'remove') {
            console.log('🔍 Removing item completely');
            this.app.cartManager.removeItem(numericItemId);
        } else {
            console.error('❌ Unknown action:', action);
            return;
        }
        
        // Trigger haptic feedback
        this.triggerHapticFeedback('light');
        
        console.log('✅ Cart quantity change completed');
    }

    handleSwipeGesture(endTime, endPos) {
        const duration = endTime - this.touchStartTime;
        const deltaX = endPos.x - this.touchStartPos.x;
        const deltaY = endPos.y - this.touchStartPos.y;
        
        // Check if it's a valid swipe (fast enough and long enough)
        if (duration > 300 || Math.abs(deltaX) < 50) return;
        
        // Horizontal swipe
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            if (deltaX > 0) {
                // Swipe right - go back
                this.handleSwipeRight();
            } else {
                // Swipe left - go forward
                this.handleSwipeLeft();
            }
        }
    }

    handleSwipeRight() {
        // Go back to previous view
        if (this.app.currentView === 'items') {
            this.app.showCategories();
            this.triggerHapticFeedback('medium');
        }
    }

    handleSwipeLeft() {
        // Could be used for navigation forward or other actions
        console.log('Swipe left detected');
    }

    startLongPress(element) {
        this.longPressTimer = setTimeout(() => {
            this.handleLongPress(element);
        }, 500); // 500ms for long press
    }

    cancelLongPress() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }

    handleLongPress(element) {
        // Handle long press actions (e.g., show item details)
        if (element.classList.contains('item-card')) {
            const itemId = element.dataset.itemId;
            const item = this.findItemById(itemId);
            if (item) {
                this.showItemModal(item);
                this.triggerHapticFeedback('heavy');
            }
        }
    }

    findItemById(itemId) {
        if (!this.menuData) return null;
        
        for (const category in this.menuData) {
            const item = this.menuData[category].find(item => item.id == itemId);
            if (item) return item;
        }
        
        return null;
    }

    triggerHapticFeedback(type) {
        // Simulate haptic feedback with visual/audio cues
        if (navigator.vibrate) {
            switch (type) {
                case 'light':
                    navigator.vibrate(10);
                    break;
                case 'medium':
                    navigator.vibrate(20);
                    break;
                case 'heavy':
                    navigator.vibrate([30, 10, 30]);
                    break;
            }
        }
        
        // Visual feedback
        const body = document.body;
        body.classList.add(`haptic-${type}`);
        setTimeout(() => {
            body.classList.remove(`haptic-${type}`);
        }, 300);
    }

    // Accessibility helpers
    announceForScreenReader(text) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = text;
        
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }

    // Touch-specific UI updates
    updateTouchUI() {
        // Add touch-specific classes and adjustments
        document.body.classList.add('touch-interface');
        
        // Ensure all interactive elements meet touch target size requirements
        const interactiveElements = document.querySelectorAll('button, .item-card, .category-btn');
        interactiveElements.forEach(element => {
            element.classList.add('touch-optimized');
        });
    }

    // Handle orientation changes
    handleOrientationChange() {
        setTimeout(() => {
            // Recalculate layouts after orientation change
            this.updateTouchUI();
        }, 100);
    }

    // Cleanup
    destroy() {
        this.cancelLongPress();
        
        // Remove event listeners
        document.removeEventListener('touchstart', this.handleTouchStart);
        document.removeEventListener('touchend', this.handleTouchEnd);
        
        console.log('Touch Manager destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TouchManager;
}