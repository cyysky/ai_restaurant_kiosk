// Debug test for menu display functionality
// This script will help validate our diagnosis of the menu display issue

console.log('🔍 MENU DISPLAY DEBUG TEST');
console.log('==========================');

// Test 1: Check if UI elements exist
function testUIElements() {
    console.log('\n📋 Test 1: UI Elements Check');
    console.log('-----------------------------');
    
    const elements = {
        'menu-categories': document.getElementById('menu-categories'),
        'menu-items': document.getElementById('menu-items'),
        'touch-panel': document.getElementById('touch-panel'),
        'voice-panel': document.getElementById('voice-panel')
    };
    
    for (const [id, element] of Object.entries(elements)) {
        console.log(`${id}: ${element ? '✅ Found' : '❌ Missing'}`);
        if (element) {
            console.log(`  - Classes: ${element.className}`);
            console.log(`  - Display: ${getComputedStyle(element).display}`);
            console.log(`  - Visibility: ${getComputedStyle(element).visibility}`);
        }
    }
}

// Test 2: Check current app state
function testAppState() {
    console.log('\n📋 Test 2: App State Check');
    console.log('---------------------------');
    
    if (window.kioskApp) {
        console.log(`Current mode: ${window.kioskApp.currentMode}`);
        console.log(`Current view: ${window.kioskApp.currentView}`);
        console.log(`Is listening: ${window.kioskApp.isListening}`);
        console.log(`Is processing: ${window.kioskApp.isProcessing}`);
        console.log(`Menu data loaded: ${!!window.kioskApp.menuData}`);
        
        if (window.kioskApp.menuData) {
            console.log(`Menu categories: ${Object.keys(window.kioskApp.menuData)}`);
        }
    } else {
        console.log('❌ KioskApp not found on window object');
    }
}

// Test 3: Check event listeners
function testEventListeners() {
    console.log('\n📋 Test 3: Event Listeners Check');
    console.log('----------------------------------');
    
    if (window.electronAPI) {
        console.log('✅ ElectronAPI available');
        console.log(`onUIUpdate: ${typeof window.electronAPI.onUIUpdate}`);
        console.log(`onRawTranscript: ${typeof window.electronAPI.onRawTranscript}`);
        console.log(`onProcessedInteraction: ${typeof window.electronAPI.onProcessedInteraction}`);
        console.log(`handleSpeechInput: ${typeof window.electronAPI.handleSpeechInput}`);
    } else {
        console.log('❌ ElectronAPI not available');
    }
}

// Test 4: Simulate menu display
function testMenuDisplay() {
    console.log('\n📋 Test 4: Menu Display Simulation');
    console.log('-----------------------------------');
    
    if (window.kioskApp) {
        console.log('🔍 Attempting to show categories...');
        try {
            window.kioskApp.showCategories();
            console.log('✅ showCategories() called successfully');
            
            // Check if menu is now visible
            const categoriesElement = document.getElementById('menu-categories');
            if (categoriesElement) {
                const isVisible = !categoriesElement.classList.contains('hidden');
                console.log(`Categories visible: ${isVisible ? '✅ Yes' : '❌ No'}`);
            }
        } catch (error) {
            console.log('❌ Error calling showCategories():', error);
        }
    }
}

// Test 5: Simulate speech input processing
function testSpeechProcessing() {
    console.log('\n📋 Test 5: Speech Processing Simulation');
    console.log('----------------------------------------');
    
    if (window.kioskApp && window.electronAPI) {
        console.log('🔍 Simulating speech input: "I want some appetizer"');
        
        // Create a mock NLU response
        const mockResponse = {
            intent: 'browse_menu',
            entities: {},
            confidence: 0.95,
            response_text: "Here's our menu. Which category would you like to explore?"
        };
        
        try {
            console.log('🔍 Calling handleNLUResponse...');
            window.kioskApp.handleNLUResponse(mockResponse);
            console.log('✅ handleNLUResponse() completed');
        } catch (error) {
            console.log('❌ Error in handleNLUResponse():', error);
        }
    }
}

// Run all tests
function runAllTests() {
    testUIElements();
    testAppState();
    testEventListeners();
    testMenuDisplay();
    testSpeechProcessing();
    
    console.log('\n🎯 DIAGNOSIS SUMMARY');
    console.log('====================');
    console.log('1. Check console output above for any ❌ failures');
    console.log('2. Look for missing UI elements or incorrect states');
    console.log('3. Verify event listeners are properly set up');
    console.log('4. Confirm menu display logic is working');
    console.log('5. Test speech processing flow');
}

// Auto-run tests when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAllTests);
} else {
    runAllTests();
}

// Export for manual testing
window.debugMenuDisplay = {
    runAllTests,
    testUIElements,
    testAppState,
    testEventListeners,
    testMenuDisplay,
    testSpeechProcessing
};

console.log('\n💡 TIP: You can run individual tests by calling:');
console.log('   window.debugMenuDisplay.testUIElements()');
console.log('   window.debugMenuDisplay.testAppState()');
console.log('   etc.');