// DOM Element Access Diagnostic Test
// This script validates our hypothesis about DOM element access issues

console.log('🔍 STARTING DOM ELEMENT ACCESS DIAGNOSTIC TEST');

// Test 1: Check if all critical DOM elements exist at startup
function testDOMElementsExist() {
    console.log('\n🔍 TEST 1: Checking DOM element existence...');
    
    const criticalElements = [
        'voice-toggle',
        'listening-indicator', 
        'speech-text',
        'loading-overlay',
        'voice-mode-btn',
        'touch-mode-btn',
        'back-to-categories',
        'close-modal',
        'checkout-btn',
        'menu-categories',
        'menu-items',
        'touch-panel',
        'voice-panel'
    ];
    
    const results = {};
    let missingCount = 0;
    
    criticalElements.forEach(elementId => {
        const element = document.getElementById(elementId);
        const exists = !!element;
        results[elementId] = {
            exists,
            element: element,
            classList: element ? Array.from(element.classList) : null,
            parentNode: element ? element.parentNode?.tagName : null
        };
        
        if (!exists) {
            missingCount++;
            console.error(`🚨 MISSING: ${elementId}`);
        } else {
            console.log(`✅ FOUND: ${elementId}`);
        }
    });
    
    console.log(`\n📊 SUMMARY: ${criticalElements.length - missingCount}/${criticalElements.length} elements found`);
    
    if (missingCount > 0) {
        console.error(`🚨 ${missingCount} critical elements are missing!`);
        return false;
    }
    
    return true;
}

// Test 2: Simulate the speech processing workflow that causes errors
function testSpeechProcessingWorkflow() {
    console.log('\n🔍 TEST 2: Simulating speech processing workflow...');
    
    try {
        // Step 1: Check voice-toggle button access
        console.log('Step 1: Accessing voice-toggle button...');
        const voiceToggle = document.getElementById('voice-toggle');
        if (!voiceToggle) {
            throw new Error('voice-toggle element not found');
        }
        
        const buttonText = voiceToggle.querySelector('.button-text');
        if (!buttonText) {
            throw new Error('button-text element not found');
        }
        
        // Step 2: Check listening indicator access
        console.log('Step 2: Accessing listening-indicator...');
        const listeningIndicator = document.getElementById('listening-indicator');
        if (!listeningIndicator) {
            throw new Error('listening-indicator element not found');
        }
        
        // Step 3: Check speech-text element access
        console.log('Step 3: Accessing speech-text element...');
        const speechText = document.getElementById('speech-text');
        if (!speechText) {
            throw new Error('speech-text element not found');
        }
        
        // Step 4: Check loading overlay access
        console.log('Step 4: Accessing loading-overlay...');
        const loadingOverlay = document.getElementById('loading-overlay');
        if (!loadingOverlay) {
            throw new Error('loading-overlay element not found');
        }
        
        // Step 5: Simulate DOM manipulation that occurs during speech processing
        console.log('Step 5: Simulating DOM manipulation...');
        
        // Simulate updateVoiceButton(true)
        voiceToggle.classList.add('listening');
        buttonText.textContent = 'Listening...';
        listeningIndicator.classList.remove('hidden');
        
        // Simulate speech text update
        speechText.textContent = 'You said: "test speech input"';
        
        // Simulate loading overlay
        loadingOverlay.classList.remove('hidden');
        
        // Wait a moment then reverse
        setTimeout(() => {
            try {
                // Simulate updateVoiceButton(false)
                voiceToggle.classList.remove('listening');
                buttonText.textContent = 'Tap to Speak';
                listeningIndicator.classList.add('hidden');
                
                // Hide loading overlay
                loadingOverlay.classList.add('hidden');
                
                console.log('✅ Speech processing workflow simulation completed successfully');
            } catch (error) {
                console.error('🚨 ERROR during workflow cleanup:', error);
            }
        }, 100);
        
        return true;
        
    } catch (error) {
        console.error('🚨 ERROR in speech processing workflow:', error);
        return false;
    }
}

// Test 3: Check for race conditions by rapidly accessing elements
function testRaceConditions() {
    console.log('\n🔍 TEST 3: Testing for race conditions...');
    
    let errorCount = 0;
    const iterations = 50;
    
    for (let i = 0; i < iterations; i++) {
        try {
            // Rapidly access critical elements
            const voiceToggle = document.getElementById('voice-toggle');
            const speechText = document.getElementById('speech-text');
            const loadingOverlay = document.getElementById('loading-overlay');
            
            if (!voiceToggle || !speechText || !loadingOverlay) {
                errorCount++;
                console.error(`🚨 Race condition detected at iteration ${i}`);
            }
            
            // Simulate rapid DOM manipulation
            if (voiceToggle) {
                voiceToggle.classList.toggle('listening');
            }
            if (speechText) {
                speechText.textContent = `Test ${i}`;
            }
            if (loadingOverlay) {
                loadingOverlay.classList.toggle('hidden');
            }
            
        } catch (error) {
            errorCount++;
            console.error(`🚨 Exception at iteration ${i}:`, error);
        }
    }
    
    console.log(`📊 Race condition test: ${errorCount}/${iterations} errors detected`);
    return errorCount === 0;
}

// Test 4: Monitor DOM mutations during speech processing
function testDOMMutations() {
    console.log('\n🔍 TEST 4: Setting up DOM mutation observer...');
    
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.removedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        console.log('🔍 DOM ELEMENT REMOVED:', node.id || node.className || node.tagName);
                        
                        // Check if any critical elements were removed
                        const criticalIds = ['voice-toggle', 'speech-text', 'loading-overlay', 'listening-indicator'];
                        if (criticalIds.includes(node.id)) {
                            console.error('🚨 CRITICAL ELEMENT REMOVED:', node.id);
                        }
                    }
                });
                
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        console.log('🔍 DOM ELEMENT ADDED:', node.id || node.className || node.tagName);
                    }
                });
            }
            
            if (mutation.type === 'attributes') {
                console.log('🔍 DOM ATTRIBUTE CHANGED:', mutation.target.id || mutation.target.className, 'attribute:', mutation.attributeName);
            }
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'id']
    });
    
    console.log('✅ DOM mutation observer active');
    
    // Return observer so it can be disconnected later
    return observer;
}

// Test 5: Memory and performance monitoring
function testMemoryAndPerformance() {
    console.log('\n🔍 TEST 5: Memory and performance monitoring...');
    
    if (performance.memory) {
        const memory = performance.memory;
        console.log('📊 Memory usage:', {
            used: Math.round(memory.usedJSHeapSize / 1024 / 1024) + ' MB',
            total: Math.round(memory.totalJSHeapSize / 1024 / 1024) + ' MB',
            limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024) + ' MB'
        });
        
        if (memory.usedJSHeapSize > 50 * 1024 * 1024) {
            console.warn('⚠️ HIGH MEMORY USAGE detected');
        }
    }
    
    // Check for memory leaks by counting DOM elements
    const allElements = document.querySelectorAll('*');
    console.log('📊 Total DOM elements:', allElements.length);
    
    if (allElements.length > 1000) {
        console.warn('⚠️ HIGH DOM ELEMENT COUNT detected');
    }
}

// Main diagnostic function
function runDOMDiagnostics() {
    console.log('🔍 ========================================');
    console.log('🔍 DOM ELEMENT ACCESS DIAGNOSTIC REPORT');
    console.log('🔍 ========================================');
    
    const results = {
        elementsExist: false,
        workflowTest: false,
        raceConditions: false,
        observer: null
    };
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => runDOMDiagnostics(), 100);
        });
        return;
    }
    
    try {
        // Run all tests
        results.elementsExist = testDOMElementsExist();
        results.workflowTest = testSpeechProcessingWorkflow();
        results.raceConditions = testRaceConditions();
        results.observer = testDOMMutations();
        testMemoryAndPerformance();
        
        // Summary
        console.log('\n🔍 ========================================');
        console.log('🔍 DIAGNOSTIC SUMMARY');
        console.log('🔍 ========================================');
        console.log('✅ Elements exist:', results.elementsExist);
        console.log('✅ Workflow test:', results.workflowTest);
        console.log('✅ Race conditions:', results.raceConditions);
        console.log('✅ Mutation observer:', !!results.observer);
        
        if (!results.elementsExist) {
            console.error('🚨 DIAGNOSIS: Critical DOM elements are missing at startup');
        } else if (!results.workflowTest) {
            console.error('🚨 DIAGNOSIS: Speech processing workflow has DOM access issues');
        } else if (!results.raceConditions) {
            console.error('🚨 DIAGNOSIS: Race conditions detected in DOM access');
        } else {
            console.log('✅ DIAGNOSIS: DOM elements appear to be accessible');
        }
        
        // Store results globally for inspection
        window.domDiagnostics = results;
        
    } catch (error) {
        console.error('🚨 CRITICAL ERROR in DOM diagnostics:', error);
    }
}

// Auto-run diagnostics when script loads
if (typeof window !== 'undefined') {
    runDOMDiagnostics();
}

// Export for manual testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runDOMDiagnostics,
        testDOMElementsExist,
        testSpeechProcessingWorkflow,
        testRaceConditions,
        testDOMMutations,
        testMemoryAndPerformance
    };
}