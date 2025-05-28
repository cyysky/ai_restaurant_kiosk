// Cart Button Functionality Test
// This test validates that all cart button fixes are working correctly

console.log('🔍 CART BUTTON FUNCTIONALITY TEST');
console.log('================================');

function testCartButtons() {
    console.log('\n🔍 Testing Cart Button Functionality...');
    
    // Test 1: Add items to cart for testing
    console.log('\n1. Adding test items to cart...');
    
    const testItems = [
        { id: 101, name: 'Test Burger', price: 12.99, description: 'Test burger for cart testing' },
        { id: 102, name: 'Test Fries', price: 4.99, description: 'Test fries for cart testing' },
        { id: 103, name: 'Test Drink', price: 2.99, description: 'Test drink for cart testing' }
    ];
    
    if (window.kioskApp && window.kioskApp.cartManager) {
        testItems.forEach(item => {
            window.kioskApp.cartManager.addItem(item, 2);
            console.log(`✅ Added ${item.name} x2 to cart`);
        });
        
        console.log(`📊 Cart now has ${window.kioskApp.cartManager.getItemCount()} items`);
        console.log(`💰 Cart total: $${window.kioskApp.cartManager.getTotal().toFixed(2)}`);
    } else {
        console.error('❌ Cart Manager not available');
        return;
    }
    
    // Test 2: Check if cart buttons are created
    setTimeout(() => {
        console.log('\n2. Checking cart button creation...');
        
        const cartButtons = document.querySelectorAll('.cart-qty-btn');
        console.log(`🔍 Found ${cartButtons.length} cart buttons`);
        
        if (cartButtons.length === 0) {
            console.error('❌ No cart buttons found');
            return;
        }
        
        // Test 3: Test each button type
        console.log('\n3. Testing button functionality...');
        
        const decreaseButtons = document.querySelectorAll('.cart-qty-btn[data-action="decrease"]');
        const increaseButtons = document.querySelectorAll('.cart-qty-btn[data-action="increase"]');
        const removeButtons = document.querySelectorAll('.cart-qty-btn[data-action="remove"]');
        
        console.log(`🔍 Decrease buttons: ${decreaseButtons.length}`);
        console.log(`🔍 Increase buttons: ${increaseButtons.length}`);
        console.log(`🔍 Remove buttons: ${removeButtons.length}`);
        
        // Test 4: Simulate button clicks
        console.log('\n4. Simulating button clicks...');
        
        if (increaseButtons.length > 0) {
            console.log('🔍 Testing increase button...');
            const initialCount = window.kioskApp.cartManager.getItemCount();
            
            increaseButtons[0].click();
            
            setTimeout(() => {
                const newCount = window.kioskApp.cartManager.getItemCount();
                if (newCount > initialCount) {
                    console.log('✅ Increase button working correctly');
                } else {
                    console.log('❌ Increase button not working');
                }
                
                // Test decrease button
                if (decreaseButtons.length > 0) {
                    console.log('🔍 Testing decrease button...');
                    const beforeDecrease = window.kioskApp.cartManager.getItemCount();
                    
                    decreaseButtons[0].click();
                    
                    setTimeout(() => {
                        const afterDecrease = window.kioskApp.cartManager.getItemCount();
                        if (afterDecrease < beforeDecrease) {
                            console.log('✅ Decrease button working correctly');
                        } else {
                            console.log('❌ Decrease button not working');
                        }
                        
                        // Test remove button
                        if (removeButtons.length > 0) {
                            console.log('🔍 Testing remove button...');
                            const beforeRemove = window.kioskApp.cartManager.getItems().length;
                            
                            removeButtons[0].click();
                            
                            setTimeout(() => {
                                const afterRemove = window.kioskApp.cartManager.getItems().length;
                                if (afterRemove < beforeRemove) {
                                    console.log('✅ Remove button working correctly');
                                } else {
                                    console.log('❌ Remove button not working');
                                }
                                
                                console.log('\n🎉 CART BUTTON TEST COMPLETED');
                                console.log(`📊 Final cart state: ${window.kioskApp.cartManager.getItemCount()} items, $${window.kioskApp.cartManager.getTotal().toFixed(2)}`);
                                
                            }, 200);
                        }
                    }, 200);
                }
            }, 200);
        }
        
    }, 1000);
}

// Test 5: Event delegation verification
function testEventDelegation() {
    console.log('\n5. Testing event delegation...');
    
    // Check if document has click listener
    const hasDocumentListener = document.onclick !== null;
    console.log(`🔍 Document has click listener: ${hasDocumentListener}`);
    
    // Test manual event dispatch
    const cartButtons = document.querySelectorAll('.cart-qty-btn');
    if (cartButtons.length > 0) {
        const testButton = cartButtons[0];
        console.log('🔍 Testing manual event dispatch...');
        
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        
        testButton.dispatchEvent(clickEvent);
        console.log('✅ Manual event dispatch completed');
    }
}

// Run tests
setTimeout(() => {
    testCartButtons();
    setTimeout(testEventDelegation, 3000);
}, 2000);

// Export for manual testing
window.cartButtonTest = {
    testCartButtons,
    testEventDelegation
};

console.log('\n💡 You can also run tests manually:');
console.log('   window.cartButtonTest.testCartButtons()');
console.log('   window.cartButtonTest.testEventDelegation()');