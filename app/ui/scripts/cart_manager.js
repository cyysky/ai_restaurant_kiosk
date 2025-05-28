// Cart Manager - Handles shopping cart functionality
class CartManager {
    constructor(app) {
        this.app = app;
        this.items = [];
        this.total = 0;
        this.isInitialized = false;
    }

    async init() {
        console.log('Initializing Cart Manager...');
        
        try {
            this.loadCartFromStorage();
            this.updateCartDisplay();
            this.isInitialized = true;
            
            console.log('Cart Manager initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Cart Manager:', error);
            throw error;
        }
    }

    addItem(item, quantity = 1) {
        console.log('Adding item to cart:', item.name, 'x', quantity);
        
        // Check if item already exists in cart
        const existingItem = this.items.find(cartItem => cartItem.id === item.id);
        
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            this.items.push({
                id: item.id,
                name: item.name,
                price: item.price,
                description: item.description,
                quantity: quantity
            });
        }
        
        this.calculateTotal();
        this.updateCartDisplay();
        this.saveCartToStorage();
        
        // Trigger cart update event
        this.triggerCartUpdate();
    }

    removeItem(itemId) {
        console.log('Removing item from cart:', itemId);
        
        this.items = this.items.filter(item => item.id !== itemId);
        
        this.calculateTotal();
        this.updateCartDisplay();
        this.saveCartToStorage();
        
        // Trigger cart update event
        this.triggerCartUpdate();
    }

    updateQuantity(itemId, newQuantity) {
        console.log('Updating item quantity:', itemId, 'to', newQuantity);
        
        const item = this.items.find(cartItem => cartItem.id === itemId);
        
        if (item) {
            if (newQuantity <= 0) {
                this.removeItem(itemId);
            } else {
                item.quantity = newQuantity;
                this.calculateTotal();
                this.updateCartDisplay();
                this.saveCartToStorage();
                
                // Trigger cart update event
                this.triggerCartUpdate();
            }
        }
    }

    getItems() {
        return [...this.items];
    }

    getItemById(itemId) {
        return this.items.find(item => item.id === itemId);
    }

    getTotal() {
        return this.total;
    }

    getItemCount() {
        return this.items.reduce((count, item) => count + item.quantity, 0);
    }

    clear() {
        console.log('Clearing cart');
        
        this.items = [];
        this.total = 0;
        
        this.updateCartDisplay();
        this.saveCartToStorage();
        
        // Trigger cart update event
        this.triggerCartUpdate();
    }

    calculateTotal() {
        this.total = this.items.reduce((sum, item) => {
            return sum + (item.price * item.quantity);
        }, 0);
    }

    updateCartDisplay() {
        this.updateCartCount();
        this.updateCartItems();
        this.updateCartTotal();
        this.updateCheckoutButton();
    }

    updateCartCount() {
        const cartCount = document.getElementById('cart-count');
        const itemCount = this.getItemCount();
        
        if (cartCount) {
            cartCount.textContent = itemCount;
            
            // Add animation for count changes
            cartCount.classList.add('cart-count-update');
            setTimeout(() => {
                cartCount.classList.remove('cart-count-update');
            }, 300);
        }
    }

    updateCartItems() {
        const cartItemsContainer = document.getElementById('cart-items');
        
        if (!cartItemsContainer) return;
        
        if (this.items.length === 0) {
            cartItemsContainer.innerHTML = '<p class="empty-cart">Your cart is empty</p>';
            return;
        }
        
        cartItemsContainer.innerHTML = '';
        
        this.items.forEach(item => {
            const cartItemElement = this.createCartItemElement(item);
            cartItemsContainer.appendChild(cartItemElement);
        });
    }

    createCartItemElement(item) {
        console.log('🔍 Creating cart item element for:', item);
        
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.dataset.itemId = item.id;
        
        cartItem.innerHTML = `
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">$${item.price.toFixed(2)} each</div>
            </div>
            <div class="cart-item-controls">
                <button class="cart-qty-btn" data-action="decrease" data-item-id="${item.id}">-</button>
                <span class="cart-item-quantity">${item.quantity}</span>
                <button class="cart-qty-btn" data-action="increase" data-item-id="${item.id}">+</button>
                <button class="cart-qty-btn remove-btn" data-action="remove" data-item-id="${item.id}">×</button>
            </div>
        `;
        
        // Add direct event listeners as backup to event delegation
        const buttons = cartItem.querySelectorAll('.cart-qty-btn');
        buttons.forEach(button => {
            console.log('🔍 Adding direct event listener to button:', button.dataset.action);
            
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const action = button.dataset.action;
                const itemId = button.getAttribute('data-item-id');
                
                console.log('🔍 Direct button click:', { action, itemId });
                
                // Call the touch manager's handler if available
                if (this.app && this.app.touchManager && this.app.touchManager.handleCartQuantityChange) {
                    console.log('🔍 Calling touch manager handler');
                    this.app.touchManager.handleCartQuantityChange(itemId, action);
                } else {
                    console.log('🔍 Touch manager not available, handling directly');
                    this.handleDirectCartAction(itemId, action);
                }
            });
            
            // Add visual feedback
            button.addEventListener('mousedown', () => {
                button.style.transform = 'scale(0.95)';
            });
            
            button.addEventListener('mouseup', () => {
                button.style.transform = 'scale(1)';
            });
            
            button.addEventListener('mouseleave', () => {
                button.style.transform = 'scale(1)';
            });
        });
        
        console.log('✅ Cart item element created with event listeners');
        return cartItem;
    }

    updateCartTotal() {
        const cartTotalElement = document.getElementById('cart-total');
        
        if (cartTotalElement) {
            cartTotalElement.textContent = this.total.toFixed(2);
            
            // Add animation for total changes
            cartTotalElement.classList.add('total-update');
            setTimeout(() => {
                cartTotalElement.classList.remove('total-update');
            }, 300);
        }
    }

    updateCheckoutButton() {
        const checkoutBtn = document.getElementById('checkout-btn');
        
        if (checkoutBtn) {
            if (this.items.length === 0) {
                checkoutBtn.disabled = true;
                checkoutBtn.textContent = 'Cart Empty';
            } else {
                checkoutBtn.disabled = false;
                checkoutBtn.textContent = `Checkout ($${this.total.toFixed(2)})`;
            }
        }
    }

    // Direct cart action handler (fallback when touch manager is not available)
    handleDirectCartAction(itemId, action) {
        console.log('🔍 handleDirectCartAction called with:', { itemId, action });
        
        const numericItemId = parseInt(itemId);
        const item = this.getItemById(numericItemId);
        
        if (!item) {
            console.error('❌ Item not found for direct action:', numericItemId);
            return;
        }
        
        console.log('🔍 Processing direct action:', action, 'for item:', item.name);
        
        if (action === 'increase') {
            this.updateQuantity(numericItemId, item.quantity + 1);
        } else if (action === 'decrease') {
            if (item.quantity > 1) {
                this.updateQuantity(numericItemId, item.quantity - 1);
            } else {
                this.removeItem(numericItemId);
            }
        } else if (action === 'remove') {
            this.removeItem(numericItemId);
        }
        
        console.log('✅ Direct cart action completed');
    }

    triggerCartUpdate() {
        // Dispatch custom event for cart updates
        const event = new CustomEvent('cartUpdated', {
            detail: {
                items: this.getItems(),
                total: this.getTotal(),
                itemCount: this.getItemCount()
            }
        });
        
        document.dispatchEvent(event);
    }

    saveCartToStorage() {
        try {
            const cartData = {
                items: this.items,
                total: this.total,
                timestamp: Date.now()
            };
            
            localStorage.setItem('kioskCart', JSON.stringify(cartData));
        } catch (error) {
            console.error('Failed to save cart to storage:', error);
        }
    }

    loadCartFromStorage() {
        try {
            const cartData = localStorage.getItem('kioskCart');
            
            if (cartData) {
                const parsed = JSON.parse(cartData);
                
                // Check if cart data is not too old (24 hours)
                const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
                if (Date.now() - parsed.timestamp < maxAge) {
                    this.items = parsed.items || [];
                    this.calculateTotal();
                    console.log('Cart loaded from storage');
                } else {
                    console.log('Cart data expired, starting fresh');
                    this.clear();
                }
            }
        } catch (error) {
            console.error('Failed to load cart from storage:', error);
            this.clear();
        }
    }

    // Get cart summary for voice feedback
    getCartSummary() {
        if (this.items.length === 0) {
            return "Your cart is empty.";
        }
        
        const itemCount = this.getItemCount();
        const itemText = itemCount === 1 ? 'item' : 'items';
        
        let summary = `You have ${itemCount} ${itemText} in your cart: `;
        
        const itemSummaries = this.items.map(item => {
            const quantityText = item.quantity > 1 ? `${item.quantity} ` : '';
            return `${quantityText}${item.name}`;
        });
        
        summary += itemSummaries.join(', ');
        summary += `. Total: $${this.total.toFixed(2)}.`;
        
        return summary;
    }

    // Apply discount
    applyDiscount(discountPercent) {
        const discountAmount = this.total * (discountPercent / 100);
        const discountedTotal = this.total - discountAmount;
        
        console.log(`Applied ${discountPercent}% discount. New total: $${discountedTotal.toFixed(2)}`);
        
        return {
            originalTotal: this.total,
            discountAmount: discountAmount,
            discountedTotal: discountedTotal,
            discountPercent: discountPercent
        };
    }

    // Validate cart before checkout
    validateCart() {
        const errors = [];
        
        if (this.items.length === 0) {
            errors.push('Cart is empty');
        }
        
        // Check for invalid quantities
        this.items.forEach(item => {
            if (item.quantity <= 0) {
                errors.push(`Invalid quantity for ${item.name}`);
            }
            if (item.price <= 0) {
                errors.push(`Invalid price for ${item.name}`);
            }
        });
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    // Get cart data for order processing
    getOrderData() {
        return {
            items: this.getItems(),
            total: this.getTotal(),
            itemCount: this.getItemCount(),
            timestamp: Date.now(),
            orderId: this.generateOrderId()
        };
    }

    generateOrderId() {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        return `ORDER-${timestamp}-${random}`;
    }

    // Handle special dietary requirements or modifications
    addItemModification(itemId, modification) {
        const item = this.getItemById(itemId);
        
        if (item) {
            if (!item.modifications) {
                item.modifications = [];
            }
            
            item.modifications.push(modification);
            this.saveCartToStorage();
            this.updateCartDisplay();
            
            console.log(`Added modification to ${item.name}:`, modification);
        }
    }

    removeItemModification(itemId, modificationIndex) {
        const item = this.getItemById(itemId);
        
        if (item && item.modifications && item.modifications[modificationIndex]) {
            item.modifications.splice(modificationIndex, 1);
            this.saveCartToStorage();
            this.updateCartDisplay();
            
            console.log(`Removed modification from ${item.name}`);
        }
    }

    // Export cart data
    exportCart() {
        return {
            items: this.items,
            total: this.total,
            itemCount: this.getItemCount(),
            exportTime: new Date().toISOString()
        };
    }

    // Import cart data
    importCart(cartData) {
        try {
            this.items = cartData.items || [];
            this.calculateTotal();
            this.updateCartDisplay();
            this.saveCartToStorage();
            
            console.log('Cart imported successfully');
            return true;
        } catch (error) {
            console.error('Failed to import cart:', error);
            return false;
        }
    }

    // Cleanup
    destroy() {
        this.saveCartToStorage();
        console.log('Cart Manager destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CartManager;
}