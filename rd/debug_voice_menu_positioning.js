// Debug script to diagnose voice menu positioning issues
console.log('🔍 VOICE MENU POSITIONING DEBUG SCRIPT LOADED');

// Function to log element dimensions and positions
function logElementInfo(elementId, description) {
    const element = document.getElementById(elementId);
    if (element) {
        const rect = element.getBoundingClientRect();
        const styles = window.getComputedStyle(element);
        console.log(`🔍 ${description} (${elementId}):`, {
            position: {
                top: rect.top,
                left: rect.left,
                bottom: rect.bottom,
                right: rect.right,
                width: rect.width,
                height: rect.height
            },
            styles: {
                display: styles.display,
                position: styles.position,
                padding: styles.padding,
                margin: styles.margin,
                height: styles.height,
                minHeight: styles.minHeight,
                maxHeight: styles.maxHeight
            },
            classes: Array.from(element.classList),
            visible: !element.classList.contains('hidden') && styles.display !== 'none'
        });
    } else {
        console.error(`🚨 Element not found: ${elementId}`);
    }
}

// Function to analyze voice mode layout
function analyzeVoiceModeLayout() {
    console.log('🔍 === VOICE MODE LAYOUT ANALYSIS ===');
    
    // Check main layout elements
    logElementInfo('app', 'Main App Container');
    logElementInfo('voice-panel', 'Voice Panel');
    logElementInfo('touch-panel', 'Touch Panel');
    logElementInfo('voice-feedback', 'Voice Feedback Area');
    logElementInfo('speech-text', 'Speech Text Element');
    logElementInfo('menu-categories', 'Menu Categories');
    logElementInfo('menu-items', 'Menu Items');
    
    // Check if we're in voice mode
    const voiceModeBtn = document.getElementById('voice-mode-btn');
    const touchModeBtn = document.getElementById('touch-mode-btn');
    
    console.log('🔍 Current Mode State:', {
        voiceModeActive: voiceModeBtn?.classList.contains('active'),
        touchModeActive: touchModeBtn?.classList.contains('active'),
        voicePanelDisplay: document.getElementById('voice-panel')?.style.display,
        touchPanelDisplay: document.getElementById('touch-panel')?.style.display
    });
    
    // Check main content grid layout
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        const styles = window.getComputedStyle(mainContent);
        console.log('🔍 Main Content Grid:', {
            gridTemplateColumns: styles.gridTemplateColumns,
            gridTemplateRows: styles.gridTemplateRows,
            gap: styles.gap,
            height: styles.height
        });
    }
}

// Function to simulate voice recognition and menu display
function simulateVoiceMenuDisplay() {
    console.log('🔍 === SIMULATING VOICE MENU DISPLAY ===');
    
    // Simulate speech text update
    const speechText = document.getElementById('speech-text');
    if (speechText) {
        speechText.textContent = 'Heard: "Can you show me the chicken?"';
        console.log('🔍 Speech text updated');
    }
    
    // Wait a moment then analyze layout
    setTimeout(() => {
        analyzeVoiceModeLayout();
        
        // Simulate showing menu items
        if (window.kioskApp) {
            console.log('🔍 Triggering menu display...');
            window.kioskApp.showMenuItems('mains');
            
            setTimeout(() => {
                console.log('🔍 === AFTER MENU DISPLAY ===');
                analyzeVoiceModeLayout();
                
                // Measure gap between speech text and menu items
                measureGapBetweenElements();
            }, 500);
        }
    }, 100);
}

// Function to measure gap between speech text and menu items
function measureGapBetweenElements() {
    const speechText = document.getElementById('speech-text');
    const menuItems = document.getElementById('menu-items');
    
    if (speechText && menuItems) {
        const speechRect = speechText.getBoundingClientRect();
        const menuRect = menuItems.getBoundingClientRect();
        
        const gap = menuRect.top - speechRect.bottom;
        
        console.log('🔍 GAP MEASUREMENT:', {
            speechTextBottom: speechRect.bottom,
            menuItemsTop: menuRect.top,
            gapSize: gap,
            gapInViewportHeight: `${(gap / window.innerHeight * 100).toFixed(1)}%`
        });
        
        if (gap > 200) {
            console.warn('⚠️ LARGE GAP DETECTED:', gap, 'pixels');
            
            // Find elements in between
            const elementsInBetween = [];
            const allElements = document.querySelectorAll('*');
            
            allElements.forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.top >= speechRect.bottom && rect.bottom <= menuRect.top && rect.height > 10) {
                    elementsInBetween.push({
                        element: el,
                        tagName: el.tagName,
                        id: el.id,
                        classes: Array.from(el.classList),
                        height: rect.height,
                        position: { top: rect.top, bottom: rect.bottom }
                    });
                }
            });
            
            console.log('🔍 ELEMENTS CAUSING GAP:', elementsInBetween);
        }
    }
}

// Function to test positioning fixes
function testPositioningFixes() {
    console.log('🔍 === TESTING POSITIONING FIXES ===');
    
    // Test 1: Reduce voice feedback area spacing
    const voiceFeedback = document.getElementById('voice-feedback');
    if (voiceFeedback) {
        console.log('🔍 Test 1: Reducing voice feedback spacing');
        voiceFeedback.style.marginTop = '1rem';
        voiceFeedback.style.minHeight = '60px';
        
        setTimeout(() => {
            measureGapBetweenElements();
        }, 100);
    }
    
    // Test 2: Position menu items closer to speech text
    setTimeout(() => {
        const touchPanel = document.getElementById('touch-panel');
        if (touchPanel && window.kioskApp && window.kioskApp.currentMode === 'voice') {
            console.log('🔍 Test 2: Adjusting touch panel position in voice mode');
            touchPanel.style.position = 'relative';
            touchPanel.style.top = '-100px';
            
            setTimeout(() => {
                measureGapBetweenElements();
            }, 100);
        }
    }, 200);
}

// Auto-run analysis when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(analyzeVoiceModeLayout, 1000);
    });
} else {
    setTimeout(analyzeVoiceModeLayout, 1000);
}

// Expose functions for manual testing
window.debugVoiceMenu = {
    analyzeLayout: analyzeVoiceModeLayout,
    simulateDisplay: simulateVoiceMenuDisplay,
    measureGap: measureGapBetweenElements,
    testFixes: testPositioningFixes
};

console.log('🔍 Debug functions available: window.debugVoiceMenu');