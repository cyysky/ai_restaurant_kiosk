// Debug Test Script for Electron Renderer Process Crash Investigation
// Run this in the browser console to test the debugging setup

console.log('🔍 Starting debug test...');

// Test 1: Check if SpeechManager debugging is working
if (window.kioskApp && window.kioskApp.speechManager) {
    console.log('✅ SpeechManager found');
    console.log('🔍 SpeechManager debug info:', window.kioskApp.speechManager.getDebugInfo());
} else {
    console.log('❌ SpeechManager not found');
}

// Test 2: Check memory usage
if (performance.memory) {
    const memoryMB = performance.memory.usedJSHeapSize / 1024 / 1024;
    console.log('🔍 Current memory usage:', memoryMB.toFixed(2), 'MB');
    
    if (memoryMB > 50) {
        console.warn('⚠️ High memory usage detected!');
    }
} else {
    console.log('❌ Memory API not available');
}

// Test 3: Check for active audio contexts
const audioContexts = [];
try {
    // This is a hack to detect AudioContexts, but it's not reliable
    console.log('🔍 Checking for AudioContext instances...');
    if (window.kioskApp && window.kioskApp.speechManager && window.kioskApp.speechManager.audioContext) {
        console.log('✅ Found AudioContext, state:', window.kioskApp.speechManager.audioContext.state);
    }
} catch (e) {
    console.log('❌ Error checking AudioContext:', e);
}

// Test 4: Trigger a controlled error to test error handling
console.log('🔍 Testing error handling...');
setTimeout(() => {
    try {
        // This should be caught by our error handlers
        throw new Error('Test error for debugging');
    } catch (e) {
        console.log('✅ Test error caught locally:', e.message);
    }
}, 1000);

// Test 5: Test unhandled promise rejection (should be caught by global handler)
setTimeout(() => {
    Promise.reject(new Error('Test unhandled promise rejection'));
}, 2000);

console.log('🔍 Debug test completed. Check console for results.');

// Export a function to get current debug state
window.getDebugState = function() {
    return {
        speechManager: window.kioskApp?.speechManager?.getDebugInfo(),
        appErrors: window.kioskApp?.errorHistory,
        memoryUsage: performance.memory ? {
            used: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
            total: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + ' MB'
        } : 'unavailable'
    };
};

console.log('🔍 Use getDebugState() to get current debug information');