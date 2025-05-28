// Test script to validate the chicken menu display fix
console.log('🔍 Testing chicken menu display fix...');

// Simulate the backend UI update that should trigger menu display
const mockUIUpdate = {
    type: 'show-category',
    data: {
        category: 'chicken',
        items: {
            name: 'Chicken Items',
            description: 'Items matching "chicken"',
            icon: '🐔',
            items: [
                {
                    id: 6,
                    name: "Chicken Alfredo Pasta",
                    description: "Tender chicken breast over fettuccine pasta in creamy alfredo sauce",
                    price: 16.99,
                    calories: 680,
                    prepTime: 14,
                    dietary: [],
                    allergens: ["gluten", "dairy"],
                    popularity: 0.82,
                    available: true,
                    image: "chicken_alfredo.jpg",
                    relevance: 85
                },
                {
                    id: 2,
                    name: "Chicken Wings",
                    description: "Spicy buffalo wings served with ranch dipping sauce and celery sticks",
                    price: 12.99,
                    calories: 580,
                    prepTime: 12,
                    dietary: [],
                    allergens: ["dairy"],
                    popularity: 0.92,
                    available: true,
                    image: "chicken_wings.jpg",
                    relevance: 60
                }
            ]
        }
    }
};

// Wait for the app to be initialized
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        console.log('🔍 App initialized, testing chicken menu fix...');
        
        if (window.kioskApp) {
            console.log('🔍 KioskApp found, testing handleUIUpdate...');
            
            // Test the UI update handler directly
            try {
                window.kioskApp.handleUIUpdate(mockUIUpdate);
                console.log('✅ UI update handled successfully');
                
                // Check if menu items are displayed
                setTimeout(() => {
                    const itemsGrid = document.getElementById('items-grid');
                    const menuItems = document.getElementById('menu-items');
                    const currentCategory = document.getElementById('current-category');
                    
                    console.log('🔍 Items grid element:', itemsGrid);
                    console.log('🔍 Menu items container:', menuItems);
                    console.log('🔍 Current category element:', currentCategory);
                    console.log('🔍 Items grid children count:', itemsGrid ? itemsGrid.children.length : 'N/A');
                    console.log('🔍 Menu items visible:', menuItems ? !menuItems.classList.contains('hidden') : 'N/A');
                    console.log('🔍 Current category text:', currentCategory ? currentCategory.textContent : 'N/A');
                    
                    if (itemsGrid && itemsGrid.children.length > 0) {
                        console.log('✅ SUCCESS: Menu items are displayed!');
                        console.log('🔍 Item cards found:', itemsGrid.children.length);
                        
                        // Log details of each item card
                        Array.from(itemsGrid.children).forEach((card, index) => {
                            const itemName = card.querySelector('.item-name')?.textContent;
                            const itemPrice = card.querySelector('.item-price')?.textContent;
                            console.log(`🔍 Item ${index + 1}: ${itemName} - ${itemPrice}`);
                        });
                    } else {
                        console.error('❌ FAILURE: Menu items are not displayed');
                        console.error('🔍 Items grid HTML:', itemsGrid ? itemsGrid.innerHTML : 'N/A');
                    }
                }, 1000);
                
            } catch (error) {
                console.error('❌ Error testing UI update:', error);
            }
        } else {
            console.error('❌ KioskApp not found');
        }
    }, 2000);
});