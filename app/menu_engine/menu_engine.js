const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;

class MenuEngine extends EventEmitter {
    constructor(dataStore) {
        super();
        this.dataStore = dataStore;
        this.menuData = null;
        this.cart = {
            items: [],
            total: 0,
            itemCount: 0,
            sessionId: null
        };
        this.isInitialized = false;
    }

    async initialize() {
        console.log('Initializing Menu Engine...');
        
        try {
            // Load menu data
            await this.loadMenuData();
            
            // Initialize cart
            this.initializeCart();
            
            this.isInitialized = true;
            console.log('Menu Engine initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Menu Engine:', error);
            throw error;
        }
    }

    async loadMenuData() {
        try {
            const menuPath = path.join(__dirname, '../../data/menu/menu.json');
            const menuContent = await fs.readFile(menuPath, 'utf8');
            this.menuData = JSON.parse(menuContent);
            
            console.log('Menu data loaded successfully');
            
        } catch (error) {
            console.error('Failed to load menu data:', error);
            // Use fallback menu data
            this.menuData = this.getFallbackMenuData();
        }
    }

    getFallbackMenuData() {
        return {
            categories: {
                appetizers: {
                    name: "Appetizers",
                    items: [
                        { id: 1, name: "Caesar Salad", price: 8.99, description: "Fresh romaine lettuce with parmesan cheese" },
                        { id: 2, name: "Chicken Wings", price: 12.99, description: "Spicy buffalo wings with ranch sauce" }
                    ]
                },
                mains: {
                    name: "Main Courses",
                    items: [
                        { id: 3, name: "Grilled Salmon", price: 18.99, description: "Fresh Atlantic salmon with herbs" },
                        { id: 4, name: "Classic Burger", price: 14.99, description: "Juicy beef patty with fries" }
                    ]
                },
                beverages: {
                    name: "Beverages",
                    items: [
                        { id: 5, name: "Coca Cola", price: 2.99, description: "Classic refreshing cola" },
                        { id: 6, name: "Orange Juice", price: 4.99, description: "Freshly squeezed orange juice" }
                    ]
                },
                desserts: {
                    name: "Desserts",
                    items: [
                        { id: 7, name: "Chocolate Cake", price: 6.99, description: "Rich chocolate cake with ice cream" },
                        { id: 8, name: "Apple Pie", price: 5.99, description: "Homemade apple pie with cinnamon" }
                    ]
                }
            }
        };
    }

    initializeCart() {
        this.cart = {
            items: [],
            total: 0,
            itemCount: 0,
            sessionId: this.generateSessionId(),
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
    }

    generateSessionId() {
        return `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Menu retrieval methods
    async getFullMenu() {
        if (!this.menuData) {
            await this.loadMenuData();
        }
        
        return {
            categories: this.menuData.categories,
            specials: this.menuData.specials,
            restaurant: this.menuData.restaurant
        };
    }

    async getCategory(categoryName) {
        if (!this.menuData || !this.menuData.categories[categoryName]) {
            throw new Error(`Category '${categoryName}' not found`);
        }
        
        return this.menuData.categories[categoryName];
    }

    async getItemDetails(itemId) {
        const item = this.findItemById(itemId);
        if (!item) {
            throw new Error(`Item with ID '${itemId}' not found`);
        }
        
        return item;
    }

    findItemById(itemId) {
        if (!this.menuData) return null;
        
        for (const categoryName in this.menuData.categories) {
            const category = this.menuData.categories[categoryName];
            const item = category.items.find(item => item.id == itemId);
            if (item) {
                return { ...item, category: categoryName };
            }
        }
        
        return null;
    }

    findItemByName(itemName) {
        if (!this.menuData) return null;
        
        const normalizedName = itemName.toLowerCase();
        
        for (const categoryName in this.menuData.categories) {
            const category = this.menuData.categories[categoryName];
            const item = category.items.find(item => 
                item.name.toLowerCase().includes(normalizedName) ||
                normalizedName.includes(item.name.toLowerCase())
            );
            if (item) {
                return { ...item, category: categoryName };
            }
        }
        
        return null;
    }

    async searchItems(query) {
        if (!this.menuData) {
            await this.loadMenuData();
        }
        
        const results = [];
        const normalizedQuery = query.toLowerCase();
        
        for (const categoryName in this.menuData.categories) {
            const category = this.menuData.categories[categoryName];
            
            for (const item of category.items) {
                // Search in name and description
                if (item.name.toLowerCase().includes(normalizedQuery) ||
                    item.description.toLowerCase().includes(normalizedQuery)) {
                    results.push({
                        ...item,
                        category: categoryName,
                        relevance: this.calculateRelevance(item, normalizedQuery)
                    });
                }
            }
        }
        
        // Sort by relevance
        results.sort((a, b) => b.relevance - a.relevance);
        
        return results;
    }

    calculateRelevance(item, query) {
        let score = 0;
        
        // Exact name match gets highest score
        if (item.name.toLowerCase() === query) {
            score += 100;
        } else if (item.name.toLowerCase().includes(query)) {
            score += 50;
        }
        
        // Description match gets lower score
        if (item.description.toLowerCase().includes(query)) {
            score += 25;
        }
        
        // Popular items get bonus
        if (item.popularity && item.popularity > 0.8) {
            score += 10;
        }
        
        return score;
    }

    // Cart management methods
    async addToCart(item, quantity = 1) {
        try {
            // Find the item if only name is provided
            let menuItem = item;
            if (typeof item === 'string') {
                menuItem = this.findItemByName(item);
                if (!menuItem) {
                    throw new Error(`Item '${item}' not found in menu`);
                }
            } else if (item.id) {
                menuItem = this.findItemById(item.id);
                if (!menuItem) {
                    throw new Error(`Item with ID '${item.id}' not found`);
                }
            }
            
            // Check if item already exists in cart
            const existingItemIndex = this.cart.items.findIndex(cartItem => cartItem.id === menuItem.id);
            
            if (existingItemIndex >= 0) {
                // Update quantity of existing item
                this.cart.items[existingItemIndex].quantity += quantity;
            } else {
                // Add new item to cart
                this.cart.items.push({
                    id: menuItem.id,
                    name: menuItem.name,
                    price: menuItem.price,
                    description: menuItem.description,
                    category: menuItem.category,
                    quantity: quantity,
                    addedAt: Date.now()
                });
            }
            
            this.updateCartTotals();
            this.emit('order-updated', this.cart);
            
            return {
                success: true,
                cart: this.getCartSummary(),
                message: `Added ${quantity} ${menuItem.name} to cart`
            };
            
        } catch (error) {
            console.error('Failed to add item to cart:', error);
            throw error;
        }
    }

    async removeFromCart(itemId) {
        try {
            const itemIndex = this.cart.items.findIndex(item => item.id == itemId);
            
            if (itemIndex === -1) {
                throw new Error(`Item with ID '${itemId}' not found in cart`);
            }
            
            const removedItem = this.cart.items.splice(itemIndex, 1)[0];
            
            this.updateCartTotals();
            this.emit('order-updated', this.cart);
            
            return {
                success: true,
                cart: this.getCartSummary(),
                message: `Removed ${removedItem.name} from cart`
            };
            
        } catch (error) {
            console.error('Failed to remove item from cart:', error);
            throw error;
        }
    }

    async updateCartItemQuantity(itemId, newQuantity) {
        try {
            if (newQuantity <= 0) {
                return await this.removeFromCart(itemId);
            }
            
            const item = this.cart.items.find(item => item.id == itemId);
            
            if (!item) {
                throw new Error(`Item with ID '${itemId}' not found in cart`);
            }
            
            item.quantity = newQuantity;
            item.updatedAt = Date.now();
            
            this.updateCartTotals();
            this.emit('order-updated', this.cart);
            
            return {
                success: true,
                cart: this.getCartSummary(),
                message: `Updated ${item.name} quantity to ${newQuantity}`
            };
            
        } catch (error) {
            console.error('Failed to update cart item quantity:', error);
            throw error;
        }
    }

    updateCartTotals() {
        this.cart.total = this.cart.items.reduce((sum, item) => {
            return sum + (item.price * item.quantity);
        }, 0);
        
        this.cart.itemCount = this.cart.items.reduce((count, item) => {
            return count + item.quantity;
        }, 0);
        
        this.cart.updatedAt = Date.now();
    }

    getCartSummary() {
        return {
            items: [...this.cart.items],
            total: this.cart.total,
            itemCount: this.cart.itemCount,
            sessionId: this.cart.sessionId,
            updatedAt: this.cart.updatedAt
        };
    }

    clearCart() {
        this.cart.items = [];
        this.cart.total = 0;
        this.cart.itemCount = 0;
        this.cart.updatedAt = Date.now();
        
        this.emit('order-updated', this.cart);
        
        return {
            success: true,
            message: 'Cart cleared successfully'
        };
    }

    // Order processing
    async processCheckout(orderData = {}) {
        try {
            if (this.cart.items.length === 0) {
                throw new Error('Cannot checkout with empty cart');
            }
            
            const order = {
                orderId: this.generateOrderId(),
                items: [...this.cart.items],
                subtotal: this.cart.total,
                tax: this.calculateTax(this.cart.total),
                total: this.cart.total + this.calculateTax(this.cart.total),
                orderTime: new Date().toISOString(),
                status: 'pending',
                customerInfo: orderData.customerInfo || {},
                paymentMethod: orderData.paymentMethod || 'cash'
            };
            
            // Save order (would integrate with POS system in production)
            await this.saveOrder(order);
            
            // Clear cart after successful order
            this.clearCart();
            
            this.emit('order-completed', order);
            
            return {
                success: true,
                orderId: order.orderId,
                total: order.total,
                estimatedTime: this.calculateEstimatedTime(order.items)
            };
            
        } catch (error) {
            console.error('Checkout processing error:', error);
            throw error;
        }
    }

    generateOrderId() {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        return `ORD-${timestamp}-${random}`;
    }

    calculateTax(subtotal) {
        const taxRate = this.menuData?.ordering?.taxRate || 0.08;
        return subtotal * taxRate;
    }

    calculateEstimatedTime(items) {
        // Calculate based on prep times
        let maxPrepTime = 0;
        
        for (const cartItem of items) {
            const menuItem = this.findItemById(cartItem.id);
            if (menuItem && menuItem.prepTime) {
                maxPrepTime = Math.max(maxPrepTime, menuItem.prepTime);
            }
        }
        
        // Add base time and factor in quantity
        const baseTime = 5; // minutes
        const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
        const queueTime = Math.ceil(totalItems / 3) * 2; // 2 minutes per 3 items
        
        return baseTime + maxPrepTime + queueTime;
    }

    async saveOrder(order) {
        // In production, this would save to database or POS system
        console.log('Order saved:', order.orderId);
        
        // For now, just log the order
        if (this.dataStore && this.dataStore.saveOrder) {
            await this.dataStore.saveOrder(order);
        }
    }

    // Recommendations
    getRecommendations(context = {}) {
        if (!this.menuData) return [];
        
        const recommendations = [];
        
        // Popular items
        for (const categoryName in this.menuData.categories) {
            const category = this.menuData.categories[categoryName];
            const popularItems = category.items
                .filter(item => item.popularity && item.popularity > 0.8)
                .sort((a, b) => b.popularity - a.popularity)
                .slice(0, 2);
            
            recommendations.push(...popularItems.map(item => ({
                ...item,
                category: categoryName,
                reason: 'popular'
            })));
        }
        
        return recommendations.slice(0, 6);
    }

    // Status and diagnostics
    getStatus() {
        return {
            initialized: this.isInitialized,
            menuLoaded: !!this.menuData,
            cartItems: this.cart.itemCount,
            cartTotal: this.cart.total,
            sessionId: this.cart.sessionId
        };
    }

    // Configuration updates
    async updateConfiguration(newConfig) {
        // Reload menu data if needed
        if (newConfig.reloadMenu) {
            await this.loadMenuData();
        }
        
        console.log('Menu Engine configuration updated');
        return true;
    }

    // Cleanup
    async shutdown() {
        console.log('Shutting down Menu Engine...');
        
        // Save current cart state if needed
        if (this.cart.items.length > 0) {
            console.log('Cart has items, consider saving state');
        }
        
        this.isInitialized = false;
        console.log('Menu Engine shut down successfully');
    }
}

module.exports = MenuEngine;