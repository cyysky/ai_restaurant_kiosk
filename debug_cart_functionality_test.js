// Debug Cart Functionality Test
// This test validates cart button event handlers and functionality

console.log('🔍 CART FUNCTIONALITY DEBUG TEST STARTING...');

function debugCartFunctionality() {
    console.log('🔍 === CART FUNCTIONALITY DEBUG TEST ===');
    
    // Test 1: Check if cart manager exists and is initialized
    console.log('🔍 Test 1: Cart Manager Initialization');
    if (window.kioskApp && window.kioskApp.cartManager) {
        console.log('✅ Cart Manager exists');
        console.log('🔍 Cart Manager initialized:', window.kioskApp.cartManager.isInitialized);
        console.log('🔍 Current cart items:', window.kioskApp.cartManager.getItems());
    } else {
        console.error('❌ Cart Manager not found');
        return;
    }
    
    // Test 2: Check cart UI elements
    console.log('\n🔍 Test 2: Cart UI Elements');
    const cartContainer = document.getElementById('cart-container');
    const cartItems = document.getElementById('cart-items');
    const cartCount = document.getElementById('cart-count');
    const cartTotal = document.getElementById('cart-total');
    
    console.log('🔍 Cart container:', !!cartContainer);
    console.log('🔍 Cart items container:', !!cartItems);
    console.log('🔍 Cart count element:', !!cartCount);
    console.log('🔍 Cart total element:', !!cartTotal);
    
    // Test 3: Add a test item to cart
    console.log('\n🔍 Test 3: Adding Test Item to Cart');
    const testItem = {
        id: 999,
        name: 'Test Item',
        price: 9.99,
        description: 'Test item for debugging'
    };
    
    try {
        window.kioskApp.cartManager.addItem(testItem, 2);
        console.log('✅ Test item added successfully');
        
        // Check if cart was updated
        const updatedItems = window.kioskApp.cartManager.getItems();
        console.log('🔍 Updated cart items:', updatedItems);
        console.log('🔍 Cart total:', window.kioskApp.cartManager.getTotal());
        
    } catch (error) {
        console.error('❌ Error adding test item:', error);
    }
    
    // Test 4: Check if cart buttons are created
    console.log('\n🔍 Test 4: Cart Button Creation');
    setTimeout(() => {
        const cartButtons = document.querySelectorAll('.cart-qty-btn');
        console.log('🔍 Cart quantity buttons found:', cartButtons.length);
        
        cartButtons.forEach((btn, index) => {
            console.log(`🔍 Button ${index + 1}:`, {
                action: btn.dataset.action,
                itemId: btn.dataset.itemId,
                className: btn.className,
                textContent: btn.textContent
            });
        });
        
        // Test 5: Check event listeners on cart buttons
        console.log('\n🔍 Test 5: Cart Button Event Listeners');
        if (cartButtons.length > 0) {
            console.log('🔍 Testing button click simulation...');
            
            // Try to find a remove button
            const removeBtn = Array.from(cartButtons).find(btn => btn.dataset.action === 'remove');
            if (removeBtn) {
                console.log('🔍 Found remove button, testing click...');
                
                // Check if touch manager has event listener
                if (window.kioskApp.touchManager) {
                    console.log('✅ Touch Manager exists');
                    
                    // Simulate click event
                    try {
                        const clickEvent = new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window
                        });
                        
                        console.log('🔍 Simulating click on remove button...');
                        removeBtn.dispatchEvent(clickEvent);
                        
                        // Check cart after click
                        setTimeout(() => {
                            const itemsAfterClick = window.kioskApp.cartManager.getItems();
                            console.log('🔍 Cart items after remove click:', itemsAfterClick);
                            
                            if (itemsAfterClick.length === 0) {
                                console.log('✅ Remove button working correctly');
                            } else {
                                console.log('❌ Remove button not working - items still in cart');
                            }
                        }, 100);
                        
                    } catch (error) {
                        console.error('❌ Error simulating click:', error);
                    }
                } else {
                    console.error('❌ Touch Manager not found');
                }
            } else {
                console.log('⚠️ No remove button found');
            }
        } else {
            console.log('❌ No cart buttons found');
        }
        
        // Test 6: Check event delegation
        console.log('\n🔍 Test 6: Event Delegation Check');
        const documentClickListeners = getEventListeners ? getEventListeners(document) : 'DevTools required';
        console.log('🔍 Document click listeners:', documentClickListeners);
        
        // Test 7: Manual event listener check
        console.log('\n🔍 Test 7: Manual Event Listener Verification');
        if (window.kioskApp.touchManager.setupEventListeners) {
            console.log('✅ Touch Manager setupEventListeners method exists');
        } else {
            console.log('❌ Touch Manager setupEventListeners method missing');
        }
        
    }, 500); // Wait for DOM updates
}

// Test 8: Check for JavaScript errors
console.log('\n🔍 Test 8: JavaScript Error Check');
const originalError = console.error;
const errors = [];

console.error = function(...args) {
    errors.push(args);
    originalError.apply(console, args);
};

// Run the debug test
setTimeout(() => {
    debugCartFunctionality();
    
    // Report any errors
    setTimeout(() => {
        console.log('\n🔍 JavaScript Errors During Test:');
        if (errors.length > 0) {
            errors.forEach((error, index) => {
                console.log(`❌ Error ${index + 1}:`, error);
            });
        } else {
            console.log('✅ No JavaScript errors detected');
        }
        
        console.log('\n🔍 === CART FUNCTIONALITY DEBUG TEST COMPLETE ===');
    }, 1000);
}, 1000);

// Additional diagnostic function
function diagnoseCartIssue() {
    console.log('\n🔍 === CART ISSUE DIAGNOSIS ===');
    
    // Check if the issue is with event binding timing
    console.log('🔍 Checking event binding timing...');
    
    const cartItemsContainer = document.getElementById('cart-items');
    if (cartItemsContainer) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    console.log('🔍 Cart items container changed:', mutation);
                    
                    // Check if new buttons were added
                    const newButtons = cartItemsContainer.querySelectorAll('.cart-qty-btn');
                    console.log('🔍 Cart buttons after mutation:', newButtons.length);
                    
                    // Check if they have event listeners
                    newButtons.forEach((btn, index) => {
                        console.log(`🔍 New button ${index + 1} properties:`, {
                            action: btn.dataset.action,
                            itemId: btn.dataset.itemId,
                            hasClickListener: btn.onclick !== null
                        });
                    });
                }
            });
        });
        
        observer.observe(cartItemsContainer, {
            childList: true,
            subtree: true
        });
        
        console.log('✅ Mutation observer set up for cart items container');
    }
}

// Run diagnosis
setTimeout(diagnoseCartIssue, 2000);