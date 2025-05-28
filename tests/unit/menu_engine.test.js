const MenuEngine = require('../../app/menu_engine/menu_engine');
const EventEmitter = require('events');

describe('MenuEngine', () => {
  let menuEngine;
  let mockDataStore;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDataStore = {
      initialize: jest.fn(() => Promise.resolve()),
      saveOrder: jest.fn(() => Promise.resolve())
    };

    // Mock fs.readFile
    const fs = require('fs').promises;
    fs.readFile.mockResolvedValue(JSON.stringify({
      categories: {
        appetizers: {
          name: "Appetizers",
          description: "Start your meal right",
          items: [
            { id: 1, name: "Caesar Salad", price: 8.99, description: "Fresh romaine lettuce" },
            { id: 2, name: "Chicken Wings", price: 12.99, description: "Spicy buffalo wings" }
          ]
        },
        mains: {
          name: "Main Courses",
          description: "Hearty main dishes",
          items: [
            { id: 3, name: "Grilled Salmon", price: 18.99, description: "Fresh Atlantic salmon" },
            { id: 4, name: "Classic Burger", price: 14.99, description: "Juicy beef patty" }
          ]
        },
        beverages: {
          name: "Beverages",
          description: "Refreshing drinks",
          items: [
            { id: 5, name: "Coca Cola", price: 2.99, description: "Classic cola" },
            { id: 6, name: "Orange Juice", price: 4.99, description: "Fresh orange juice" }
          ]
        }
      },
      restaurant: {
        name: "Test Restaurant",
        address: "123 Test St"
      }
    }));

    menuEngine = new MenuEngine(mockDataStore);
  });

  describe('Constructor', () => {
    test('should initialize with correct default values', () => {
      expect(menuEngine.dataStore).toBe(mockDataStore);
      expect(menuEngine.menuData).toBeNull();
      expect(menuEngine.cart).toEqual({
        items: [],
        total: 0,
        itemCount: 0,
        sessionId: null
      });
      expect(menuEngine.isInitialized).toBe(false);
    });

    test('should extend EventEmitter', () => {
      expect(menuEngine).toBeInstanceOf(EventEmitter);
    });
  });

  describe('initialize', () => {
    test('should initialize successfully', async () => {
      await menuEngine.initialize();

      expect(menuEngine.isInitialized).toBe(true);
      expect(menuEngine.menuData).toBeDefined();
      expect(menuEngine.cart.sessionId).toBeDefined();
      expect(menuEngine.cart.createdAt).toBeDefined();
    });

    test('should handle menu loading errors with fallback', async () => {
      const fs = require('fs').promises;
      fs.readFile.mockRejectedValue(new Error('File not found'));

      await menuEngine.initialize();

      expect(menuEngine.isInitialized).toBe(true);
      expect(menuEngine.menuData).toBeDefined();
      expect(menuEngine.menuData.categories.appetizers).toBeDefined();
    });
  });

  describe('loadMenuData', () => {
    test('should load menu data from file successfully', async () => {
      await menuEngine.loadMenuData();

      expect(menuEngine.menuData).toBeDefined();
      expect(menuEngine.menuData.categories.appetizers).toBeDefined();
      expect(menuEngine.menuData.categories.mains).toBeDefined();
      expect(menuEngine.menuData.restaurant.name).toBe('Test Restaurant');
    });

    test('should use fallback data on file read error', async () => {
      const fs = require('fs').promises;
      fs.readFile.mockRejectedValue(new Error('File not found'));

      await menuEngine.loadMenuData();

      expect(menuEngine.menuData).toBeDefined();
      expect(menuEngine.menuData.categories).toBeDefined();
    });
  });

  describe('getFullMenu', () => {
    beforeEach(async () => {
      await menuEngine.initialize();
    });

    test('should return complete menu structure', async () => {
      const menu = await menuEngine.getFullMenu();

      expect(menu.categories).toBeDefined();
      expect(menu.restaurant).toBeDefined();
      expect(menu.categories.appetizers.items).toHaveLength(2);
      expect(menu.categories.mains.items).toHaveLength(2);
    });

    test('should load menu data if not already loaded', async () => {
      menuEngine.menuData = null;
      const loadMenuDataSpy = jest.spyOn(menuEngine, 'loadMenuData');

      await menuEngine.getFullMenu();

      expect(loadMenuDataSpy).toHaveBeenCalled();
    });
  });

  describe('getCategory', () => {
    beforeEach(async () => {
      await menuEngine.initialize();
    });

    test('should return category by exact name', async () => {
      const category = await menuEngine.getCategory('appetizers');

      expect(category.name).toBe('Appetizers');
      expect(category.items).toHaveLength(2);
      expect(category.items[0].name).toBe('Caesar Salad');
    });

    test('should return category by mapped name', async () => {
      const category = await menuEngine.getCategory('starters');

      expect(category.name).toBe('Appetizers');
      expect(category.items).toHaveLength(2);
    });

    test('should search for items when protein keyword used', async () => {
      const searchSpy = jest.spyOn(menuEngine, 'searchItems').mockResolvedValue([
        { id: 3, name: 'Grilled Salmon', price: 18.99, description: 'Fresh salmon' }
      ]);

      const result = await menuEngine.getCategory('chicken');

      expect(searchSpy).toHaveBeenCalledWith('chicken');
      expect(result.name).toBe('Chicken Items');
      expect(result.items).toHaveLength(1);
    });

    test('should throw error for non-existent category with no search results', async () => {
      jest.spyOn(menuEngine, 'searchItems').mockResolvedValue([]);

      await expect(menuEngine.getCategory('nonexistent')).rejects.toThrow(
        "Category 'nonexistent' not found and no matching items found"
      );
    });

    test('should throw error when menu data not loaded', async () => {
      menuEngine.menuData = null;

      await expect(menuEngine.getCategory('appetizers')).rejects.toThrow(
        'Menu data not loaded'
      );
    });
  });

  describe('searchItems', () => {
    beforeEach(async () => {
      await menuEngine.initialize();
    });

    test('should find items by name', async () => {
      const results = await menuEngine.searchItems('salmon');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Grilled Salmon');
      expect(results[0].category).toBe('mains');
    });

    test('should find items by description', async () => {
      const results = await menuEngine.searchItems('buffalo');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Chicken Wings');
    });

    test('should return empty array for no matches', async () => {
      const results = await menuEngine.searchItems('nonexistent');

      expect(results).toHaveLength(0);
    });

    test('should sort results by relevance', async () => {
      const results = await menuEngine.searchItems('fresh');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].relevance).toBeGreaterThanOrEqual(results[results.length - 1].relevance);
    });

    test('should handle plural/singular variations', async () => {
      const generateTermsSpy = jest.spyOn(menuEngine, 'generateSearchTerms');
      
      await menuEngine.searchItems('chickens');

      expect(generateTermsSpy).toHaveBeenCalledWith('chickens');
    });
  });

  describe('findItemById', () => {
    beforeEach(async () => {
      await menuEngine.initialize();
    });

    test('should find item by ID', () => {
      const item = menuEngine.findItemById(1);

      expect(item.name).toBe('Caesar Salad');
      expect(item.category).toBe('appetizers');
    });

    test('should return null for non-existent ID', () => {
      const item = menuEngine.findItemById(999);

      expect(item).toBeNull();
    });

    test('should return null when menu data not loaded', () => {
      menuEngine.menuData = null;
      const item = menuEngine.findItemById(1);

      expect(item).toBeNull();
    });
  });

  describe('findItemByName', () => {
    beforeEach(async () => {
      await menuEngine.initialize();
    });

    test('should find item by exact name', () => {
      const item = menuEngine.findItemByName('Caesar Salad');

      expect(item.id).toBe(1);
      expect(item.category).toBe('appetizers');
    });

    test('should find item by partial name', () => {
      const item = menuEngine.findItemByName('Caesar');

      expect(item.id).toBe(1);
      expect(item.name).toBe('Caesar Salad');
    });

    test('should be case insensitive', () => {
      const item = menuEngine.findItemByName('caesar salad');

      expect(item.id).toBe(1);
    });

    test('should return null for non-existent name', () => {
      const item = menuEngine.findItemByName('Nonexistent Item');

      expect(item).toBeNull();
    });
  });

  describe('Cart Management', () => {
    beforeEach(async () => {
      await menuEngine.initialize();
    });

    describe('addToCart', () => {
      test('should add new item to cart', async () => {
        const result = await menuEngine.addToCart({ id: 1, name: 'Caesar Salad', price: 8.99 }, 2);

        expect(result.success).toBe(true);
        expect(menuEngine.cart.items).toHaveLength(1);
        expect(menuEngine.cart.items[0].quantity).toBe(2);
        expect(menuEngine.cart.total).toBe(17.98);
        expect(menuEngine.cart.itemCount).toBe(2);
      });

      test('should update quantity for existing item', async () => {
        await menuEngine.addToCart({ id: 1, name: 'Caesar Salad', price: 8.99 }, 1);
        const result = await menuEngine.addToCart({ id: 1, name: 'Caesar Salad', price: 8.99 }, 2);

        expect(result.success).toBe(true);
        expect(menuEngine.cart.items).toHaveLength(1);
        expect(menuEngine.cart.items[0].quantity).toBe(3);
        expect(menuEngine.cart.total).toBe(26.97);
      });

      test('should find item by name string', async () => {
        const result = await menuEngine.addToCart('Caesar Salad', 1);

        expect(result.success).toBe(true);
        expect(menuEngine.cart.items[0].name).toBe('Caesar Salad');
      });

      test('should throw error for non-existent item name', async () => {
        await expect(menuEngine.addToCart('Nonexistent Item', 1)).rejects.toThrow(
          "Item 'Nonexistent Item' not found in menu"
        );
      });

      test('should throw error for non-existent item ID', async () => {
        await expect(menuEngine.addToCart({ id: 999 }, 1)).rejects.toThrow(
          "Item with ID '999' not found"
        );
      });

      test('should emit order-updated event', async () => {
        const emitSpy = jest.spyOn(menuEngine, 'emit');
        
        await menuEngine.addToCart({ id: 1, name: 'Caesar Salad', price: 8.99 }, 1);

        expect(emitSpy).toHaveBeenCalledWith('order-updated', menuEngine.cart);
      });
    });

    describe('removeFromCart', () => {
      beforeEach(async () => {
        await menuEngine.addToCart({ id: 1, name: 'Caesar Salad', price: 8.99 }, 2);
      });

      test('should remove item from cart', async () => {
        const result = await menuEngine.removeFromCart(1);

        expect(result.success).toBe(true);
        expect(menuEngine.cart.items).toHaveLength(0);
        expect(menuEngine.cart.total).toBe(0);
        expect(menuEngine.cart.itemCount).toBe(0);
      });

      test('should throw error for non-existent item', async () => {
        await expect(menuEngine.removeFromCart(999)).rejects.toThrow(
          "Item with ID '999' not found in cart"
        );
      });

      test('should emit order-updated event', async () => {
        const emitSpy = jest.spyOn(menuEngine, 'emit');
        
        await menuEngine.removeFromCart(1);

        expect(emitSpy).toHaveBeenCalledWith('order-updated', menuEngine.cart);
      });
    });

    describe('updateCartItemQuantity', () => {
      beforeEach(async () => {
        await menuEngine.addToCart({ id: 1, name: 'Caesar Salad', price: 8.99 }, 2);
      });

      test('should update item quantity', async () => {
        const result = await menuEngine.updateCartItemQuantity(1, 5);

        expect(result.success).toBe(true);
        expect(menuEngine.cart.items[0].quantity).toBe(5);
        expect(menuEngine.cart.total).toBe(44.95);
      });

      test('should remove item when quantity is 0', async () => {
        const result = await menuEngine.updateCartItemQuantity(1, 0);

        expect(result.success).toBe(true);
        expect(menuEngine.cart.items).toHaveLength(0);
      });

      test('should throw error for non-existent item', async () => {
        await expect(menuEngine.updateCartItemQuantity(999, 3)).rejects.toThrow(
          "Item with ID '999' not found in cart"
        );
      });
    });

    describe('clearCart', () => {
      beforeEach(async () => {
        await menuEngine.addToCart({ id: 1, name: 'Caesar Salad', price: 8.99 }, 2);
      });

      test('should clear all items from cart', () => {
        const result = menuEngine.clearCart();

        expect(result.success).toBe(true);
        expect(menuEngine.cart.items).toHaveLength(0);
        expect(menuEngine.cart.total).toBe(0);
        expect(menuEngine.cart.itemCount).toBe(0);
      });

      test('should emit order-updated event', () => {
        const emitSpy = jest.spyOn(menuEngine, 'emit');
        
        menuEngine.clearCart();

        expect(emitSpy).toHaveBeenCalledWith('order-updated', menuEngine.cart);
      });
    });

    describe('getCartSummary', () => {
      beforeEach(async () => {
        await menuEngine.addToCart({ id: 1, name: 'Caesar Salad', price: 8.99 }, 2);
      });

      test('should return cart summary', () => {
        const summary = menuEngine.getCartSummary();

        expect(summary.items).toHaveLength(1);
        expect(summary.total).toBe(17.98);
        expect(summary.itemCount).toBe(2);
        expect(summary.sessionId).toBeDefined();
        expect(summary.updatedAt).toBeDefined();
      });
    });
  });

  describe('Order Processing', () => {
    beforeEach(async () => {
      await menuEngine.initialize();
      await menuEngine.addToCart({ id: 1, name: 'Caesar Salad', price: 8.99 }, 2);
    });

    describe('processCheckout', () => {
      test('should process checkout successfully', async () => {
        const result = await menuEngine.processCheckout({
          customerInfo: { name: 'John Doe' },
          paymentMethod: 'card'
        });

        expect(result.success).toBe(true);
        expect(result.orderId).toBeDefined();
        expect(result.total).toBeGreaterThan(17.98); // includes tax
        expect(result.estimatedTime).toBeDefined();
        expect(menuEngine.cart.items).toHaveLength(0); // cart cleared
      });

      test('should throw error for empty cart', async () => {
        menuEngine.clearCart();

        await expect(menuEngine.processCheckout()).rejects.toThrow(
          'Cannot checkout with empty cart'
        );
      });

      test('should emit order-completed event', async () => {
        const emitSpy = jest.spyOn(menuEngine, 'emit');
        
        await menuEngine.processCheckout();

        expect(emitSpy).toHaveBeenCalledWith('order-completed', expect.any(Object));
      });

      test('should save order via dataStore', async () => {
        await menuEngine.processCheckout();

        expect(mockDataStore.saveOrder).toHaveBeenCalled();
      });
    });

    describe('calculateTax', () => {
      test('should calculate tax correctly', () => {
        const tax = menuEngine.calculateTax(100);

        expect(tax).toBe(8); // 8% default tax rate
      });
    });

    describe('calculateEstimatedTime', () => {
      test('should calculate estimated time based on items', () => {
        const items = [
          { id: 1, quantity: 2 },
          { id: 2, quantity: 1 }
        ];

        const time = menuEngine.calculateEstimatedTime(items);

        expect(time).toBeGreaterThan(5); // base time + queue time
      });
    });

    describe('generateOrderId', () => {
      test('should generate unique order ID', () => {
        const id1 = menuEngine.generateOrderId();
        const id2 = menuEngine.generateOrderId();

        expect(id1).toMatch(/^ORD-\d+-\d+$/);
        expect(id2).toMatch(/^ORD-\d+-\d+$/);
        expect(id1).not.toBe(id2);
      });
    });
  });

  describe('Recommendations', () => {
    beforeEach(async () => {
      await menuEngine.initialize();
      // Add popularity to some items
      menuEngine.menuData.categories.appetizers.items[0].popularity = 0.9;
      menuEngine.menuData.categories.mains.items[0].popularity = 0.85;
    });

    test('should return popular items as recommendations', () => {
      const recommendations = menuEngine.getRecommendations();

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].reason).toBe('popular');
      expect(recommendations[0].popularity).toBeGreaterThan(0.8);
    });

    test('should limit recommendations to 6 items', () => {
      const recommendations = menuEngine.getRecommendations();

      expect(recommendations.length).toBeLessThanOrEqual(6);
    });
  });

  describe('Status and Configuration', () => {
    beforeEach(async () => {
      await menuEngine.initialize();
    });

    test('should return correct status', () => {
      const status = menuEngine.getStatus();

      expect(status.initialized).toBe(true);
      expect(status.menuLoaded).toBe(true);
      expect(status.cartItems).toBe(0);
      expect(status.cartTotal).toBe(0);
      expect(status.sessionId).toBeDefined();
    });

    test('should update configuration', async () => {
      const result = await menuEngine.updateConfiguration({ reloadMenu: true });

      expect(result).toBe(true);
    });
  });

  describe('shutdown', () => {
    beforeEach(async () => {
      await menuEngine.initialize();
      await menuEngine.addToCart({ id: 1, name: 'Caesar Salad', price: 8.99 }, 1);
    });

    test('should shutdown gracefully', async () => {
      await menuEngine.shutdown();

      expect(menuEngine.isInitialized).toBe(false);
    });

    test('should log warning for non-empty cart', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      await menuEngine.shutdown();

      expect(consoleSpy).toHaveBeenCalledWith('Cart has items, consider saving state');
    });
  });
});