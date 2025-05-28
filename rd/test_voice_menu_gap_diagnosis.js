// Test script to diagnose the voice menu gap issue
console.log('🔍 VOICE MENU GAP DIAGNOSIS TEST STARTING...');

// Wait for the app to be fully loaded
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

// Main diagnosis function
async function diagnoseVoiceMenuGap() {
    console.log('🔍 === VOICE MENU GAP DIAGNOSIS ===');
    
    try {
        await waitForApp();
        console.log('✅ App loaded, starting diagnosis...');
        
        // Step 1: Ensure we're in voice mode
        if (window.kioskApp.currentMode !== 'voice') {
            console.log('🔍 Switching to voice mode...');
            window.kioskApp.setMode('voice');
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Step 2: Simulate speech recognition
        console.log('🔍 Simulating speech recognition...');
        const speechText = document.getElementById('speech-text');
        if (speechText) {
            speechText.textContent = 'Heard: "Can you show me the chicken?"';
            console.log('✅ Speech text updated');
        }
        
        // Step 3: Trigger menu display
        console.log('🔍 Triggering menu display...');
        window.kioskApp.showMenuItems('mains');
        
        // Step 4: Wait for UI update and measure
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Step 5: Measure the gap
        const measurements = measureLayoutGap();
        console.log('🔍 LAYOUT MEASUREMENTS:', measurements);
        
        // Step 6: Identify the root cause
        const diagnosis = analyzeMeasurements(measurements);
        console.log('🔍 DIAGNOSIS RESULTS:', diagnosis);
        
        // Step 7: Provide recommendations
        const recommendations = generateRecommendations(diagnosis);
        console.log('🔍 RECOMMENDATIONS:', recommendations);
        
        return {
            measurements,
            diagnosis,
            recommendations
        };
        
    } catch (error) {
        console.error('🚨 Error during diagnosis:', error);
        return { error: error.message };
    }
}

// Function to measure layout gap
function measureLayoutGap() {
    const speechText = document.getElementById('speech-text');
    const menuItems = document.getElementById('menu-items');
    const voicePanel = document.getElementById('voice-panel');
    const touchPanel = document.getElementById('touch-panel');
    const voiceFeedback = document.getElementById('voice-feedback');
    
    const measurements = {
        speechText: null,
        menuItems: null,
        voicePanel: null,
        touchPanel: null,
        voiceFeedback: null,
        gap: null,
        viewportHeight: window.innerHeight
    };
    
    if (speechText) {
        const rect = speechText.getBoundingClientRect();
        measurements.speechText = {
            top: rect.top,
            bottom: rect.bottom,
            height: rect.height,
            visible: !speechText.classList.contains('hidden')
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
    
    if (voicePanel) {
        const rect = voicePanel.getBoundingClientRect();
        const styles = window.getComputedStyle(voicePanel);
        measurements.voicePanel = {
            top: rect.top,
            bottom: rect.bottom,
            height: rect.height,
            display: styles.display,
            padding: styles.padding
        };
    }
    
    if (touchPanel) {
        const rect = touchPanel.getBoundingClientRect();
        const styles = window.getComputedStyle(touchPanel);
        measurements.touchPanel = {
            top: rect.top,
            bottom: rect.bottom,
            height: rect.height,
            display: styles.display,
            position: styles.position
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

// Function to analyze measurements and identify issues
function analyzeMeasurements(measurements) {
    const issues = [];
    const rootCauses = [];
    
    // Check if gap is too large
    if (measurements.gap > 150) {
        issues.push(`Large gap detected: ${measurements.gap}px (${measurements.gapPercentage}% of viewport)`);
        
        // Analyze potential causes
        if (measurements.voiceFeedback && measurements.voiceFeedback.height > 100) {
            rootCauses.push('Voice feedback area has excessive height');
        }
        
        if (measurements.voicePanel && measurements.touchPanel) {
            if (measurements.voicePanel.display !== 'none' && measurements.touchPanel.display !== 'none') {
                rootCauses.push('Both voice and touch panels are visible simultaneously');
            }
        }
        
        // Check for excessive spacing in voice feedback
        if (measurements.voiceFeedback) {
            const marginTop = parseInt(measurements.voiceFeedback.marginTop) || 0;
            const minHeight = parseInt(measurements.voiceFeedback.minHeight) || 0;
            
            if (marginTop > 30) {
                rootCauses.push(`Voice feedback has large margin-top: ${marginTop}px`);
            }
            
            if (minHeight > 80) {
                rootCauses.push(`Voice feedback has large min-height: ${minHeight}px`);
            }
        }
    }
    
    return {
        hasIssues: issues.length > 0,
        issues,
        rootCauses,
        severity: measurements.gap > 200 ? 'high' : measurements.gap > 100 ? 'medium' : 'low'
    };
}

// Function to generate fix recommendations
function generateRecommendations(diagnosis) {
    const recommendations = [];
    
    if (diagnosis.hasIssues) {
        diagnosis.rootCauses.forEach(cause => {
            if (cause.includes('Voice feedback area has excessive height')) {
                recommendations.push({
                    issue: cause,
                    fix: 'Reduce voice-feedback min-height from 100px to 60px',
                    cssTarget: '.voice-feedback',
                    cssChange: 'min-height: 60px;'
                });
            }
            
            if (cause.includes('margin-top')) {
                recommendations.push({
                    issue: cause,
                    fix: 'Reduce voice-feedback margin-top from 2rem to 1rem',
                    cssTarget: '.voice-feedback',
                    cssChange: 'margin-top: 1rem;'
                });
            }
            
            if (cause.includes('Both voice and touch panels are visible')) {
                recommendations.push({
                    issue: cause,
                    fix: 'Position menu items closer to speech text in voice mode',
                    jsTarget: 'app.js showMenuItems function',
                    jsChange: 'Add CSS to position touch-panel relatively when in voice mode'
                });
            }
        });
        
        // General recommendation for voice mode layout
        recommendations.push({
            issue: 'Menu items appear too far from recognized speech',
            fix: 'Create voice-specific menu positioning',
            cssTarget: 'voice mode specific styles',
            cssChange: 'Position menu items immediately below speech text in voice mode'
        });
    }
    
    return recommendations;
}

// Auto-run diagnosis
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(diagnoseVoiceMenuGap, 2000);
    });
} else {
    setTimeout(diagnoseVoiceMenuGap, 2000);
}

// Expose for manual testing
window.diagnoseVoiceMenuGap = diagnoseVoiceMenuGap;

console.log('🔍 Voice menu gap diagnosis test loaded. Will auto-run in 2 seconds or call window.diagnoseVoiceMenuGap()');