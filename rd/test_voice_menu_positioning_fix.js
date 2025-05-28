// Test script to verify the voice menu positioning fix
console.log('🔍 VOICE MENU POSITIONING FIX TEST STARTING...');

// Function to test the positioning fix
async function testVoiceMenuPositioningFix() {
    console.log('🔍 === TESTING VOICE MENU POSITIONING FIX ===');
    
    try {
        // Wait for app to load
        await waitForApp();
        console.log('✅ App loaded, starting positioning fix test...');
        
        // Step 1: Switch to voice mode
        console.log('🔍 Step 1: Switching to voice mode...');
        window.kioskApp.setMode('voice');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Verify voice mode is active
        const hasVoiceModeClass = document.body.classList.contains('voice-mode');
        console.log('✅ Voice mode class applied:', hasVoiceModeClass);
        
        // Step 2: Simulate speech recognition
        console.log('🔍 Step 2: Simulating speech recognition...');
        const speechText = document.getElementById('speech-text');
        if (speechText) {
            speechText.textContent = 'Heard: "Can you show me the chicken?"';
            console.log('✅ Speech text updated');
        }
        
        // Step 3: Trigger menu display
        console.log('🔍 Step 3: Triggering menu display...');
        window.kioskApp.showMenuItems('mains');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Step 4: Measure the gap after fix
        const measurements = measureGapAfterFix();
        console.log('🔍 MEASUREMENTS AFTER FIX:', measurements);
        
        // Step 5: Verify the fix effectiveness
        const verification = verifyFixEffectiveness(measurements);
        console.log('🔍 FIX VERIFICATION:', verification);
        
        // Step 6: Test visual positioning
        const visualTest = testVisualPositioning();
        console.log('🔍 VISUAL POSITIONING TEST:', visualTest);
        
        return {
            measurements,
            verification,
            visualTest,
            success: verification.fixWorked
        };
        
    } catch (error) {
        console.error('🚨 Error during positioning fix test:', error);
        return { error: error.message, success: false };
    }
}

// Function to wait for app initialization
function waitForApp() {
    return new Promise((resolve) => {
        const checkApp = () => {
            if (window.kioskApp && window.kioskApp.isInitialized !== false) {
                resolve();
            } else {
                setTimeout(checkApp, 100);
            }
        };
        checkApp();
    });
}

// Function to measure gap after fix
function measureGapAfterFix() {
    const speechText = document.getElementById('speech-text');
    const menuItems = document.getElementById('menu-items');
    const touchPanel = document.getElementById('touch-panel');
    const voiceFeedback = document.getElementById('voice-feedback');
    
    const measurements = {
        speechText: null,
        menuItems: null,
        touchPanel: null,
        voiceFeedback: null,
        gap: null,
        viewportHeight: window.innerHeight,
        voiceModeActive: document.body.classList.contains('voice-mode')
    };
    
    if (speechText) {
        const rect = speechText.getBoundingClientRect();
        const styles = window.getComputedStyle(speechText);
        measurements.speechText = {
            top: rect.top,
            bottom: rect.bottom,
            height: rect.height,
            marginBottom: styles.marginBottom
        };
    }
    
    if (menuItems) {
        const rect = menuItems.getBoundingClientRect();
        measurements.menuItems = {
            top: rect.top,
            bottom: rect.bottom,
            height: rect.height,
            visible: !menuItems.classList.contains('hidden')
        };
    }
    
    if (touchPanel) {
        const rect = touchPanel.getBoundingClientRect();
        const styles = window.getComputedStyle(touchPanel);
        measurements.touchPanel = {
            top: rect.top,
            bottom: rect.bottom,
            height: rect.height,
            position: styles.position,
            topOffset: styles.top,
            marginBottom: styles.marginBottom
        };
    }
    
    if (voiceFeedback) {
        const rect = voiceFeedback.getBoundingClientRect();
        const styles = window.getComputedStyle(voiceFeedback);
        measurements.voiceFeedback = {
            top: rect.top,
            bottom: rect.bottom,
            height: rect.height,
            marginTop: styles.marginTop,
            minHeight: styles.minHeight
        };
    }
    
    // Calculate gap
    if (measurements.speechText && measurements.menuItems) {
        measurements.gap = measurements.menuItems.top - measurements.speechText.bottom;
        measurements.gapPercentage = (measurements.gap / measurements.viewportHeight * 100).toFixed(1);
    }
    
    return measurements;
}

// Function to verify fix effectiveness
function verifyFixEffectiveness(measurements) {
    const results = {
        fixWorked: false,
        improvements: [],
        remainingIssues: [],
        gapReduction: null
    };
    
    // Check if gap is now reasonable (less than 100px)
    if (measurements.gap < 100) {
        results.improvements.push(`Gap reduced to acceptable level: ${measurements.gap}px`);
        results.fixWorked = true;
    } else if (measurements.gap < 150) {
        results.improvements.push(`Gap significantly reduced: ${measurements.gap}px`);
        results.fixWorked = true;
    } else {
        results.remainingIssues.push(`Gap still too large: ${measurements.gap}px`);
    }
    
    // Check voice mode class application
    if (measurements.voiceModeActive) {
        results.improvements.push('Voice mode class successfully applied');
    } else {
        results.remainingIssues.push('Voice mode class not applied');
    }
    
    // Check voice feedback spacing
    if (measurements.voiceFeedback) {
        const marginTop = parseInt(measurements.voiceFeedback.marginTop) || 0;
        const minHeight = parseInt(measurements.voiceFeedback.minHeight) || 0;
        
        if (marginTop <= 16) { // 1rem = 16px
            results.improvements.push(`Voice feedback margin-top reduced: ${marginTop}px`);
        }
        
        if (minHeight <= 60) {
            results.improvements.push(`Voice feedback min-height reduced: ${minHeight}px`);
        }
    }
    
    // Check touch panel positioning
    if (measurements.touchPanel && measurements.touchPanel.position === 'relative') {
        results.improvements.push('Touch panel positioned relatively in voice mode');
    }
    
    return results;
}

// Function to test visual positioning
function testVisualPositioning() {
    const results = {
        speechTextVisible: false,
        menuItemsVisible: false,
        menuItemsPositionedCorrectly: false,
        visualGapAcceptable: false
    };
    
    const speechText = document.getElementById('speech-text');
    const menuItems = document.getElementById('menu-items');
    
    if (speechText) {
        const rect = speechText.getBoundingClientRect();
        results.speechTextVisible = rect.height > 0 && rect.width > 0;
    }
    
    if (menuItems) {
        const rect = menuItems.getBoundingClientRect();
        results.menuItemsVisible = !menuItems.classList.contains('hidden') && rect.height > 0;
        
        // Check if menu items are in the viewport
        results.menuItemsPositionedCorrectly = rect.top >= 0 && rect.top < window.innerHeight;
        
        // Check if visual gap is acceptable (menu items appear close to speech text)
        if (speechText) {
            const speechRect = speechText.getBoundingClientRect();
            const gap = rect.top - speechRect.bottom;
            results.visualGapAcceptable = gap < 100;
        }
    }
    
    return results;
}

// Function to demonstrate the fix
function demonstrateFix() {
    console.log('🔍 === DEMONSTRATING VOICE MENU POSITIONING FIX ===');
    
    // Show before and after comparison
    console.log('🔍 BEFORE FIX: Menu items appeared far below speech text');
    console.log('🔍 AFTER FIX: Menu items should appear close to speech text');
    
    // Run the test
    testVoiceMenuPositioningFix().then(results => {
        if (results.success) {
            console.log('✅ FIX SUCCESSFUL! Voice menu positioning improved.');
            console.log('📊 Results:', results);
        } else {
            console.log('❌ Fix needs adjustment. Results:', results);
        }
    });
}

// Auto-run test
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(demonstrateFix, 2000);
    });
} else {
    setTimeout(demonstrateFix, 2000);
}

// Expose for manual testing
window.testVoiceMenuFix = {
    test: testVoiceMenuPositioningFix,
    demonstrate: demonstrateFix,
    measure: measureGapAfterFix
};

console.log('🔍 Voice menu positioning fix test loaded. Will auto-run in 2 seconds or call window.testVoiceMenuFix.test()');