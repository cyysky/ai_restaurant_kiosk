/**
 * Simple test script to check Python service health and TTS parameters
 * Run this with: node test_python_service.js
 */

const fetch = require('node-fetch');

async function testPythonService() {
    const baseUrl = 'http://127.0.0.1:8000';
    
    console.log('🔍 Testing Python Speech Service...\n');
    
    // Test 1: Health Check
    console.log('1. Testing health endpoint...');
    try {
        const healthResponse = await fetch(`${baseUrl}/api/v1/health`);
        console.log(`   Status: ${healthResponse.status} ${healthResponse.statusText}`);
        
        if (healthResponse.ok) {
            const healthData = await healthResponse.json();
            console.log('   Health data:', JSON.stringify(healthData, null, 2));
        } else {
            const errorText = await healthResponse.text();
            console.log('   Error response:', errorText);
        }
    } catch (error) {
        console.log('   ❌ Health check failed:', error.message);
        console.log('   💡 Make sure the Python service is running: python python_service/main.py');
        return;
    }
    
    // Test 2: Get Available Voices
    console.log('\n2. Testing voices endpoint...');
    try {
        const voicesResponse = await fetch(`${baseUrl}/api/v1/speech/voices`);
        console.log(`   Status: ${voicesResponse.status} ${voicesResponse.statusText}`);
        
        if (voicesResponse.ok) {
            const voicesData = await voicesResponse.json();
            console.log('   Available voices:', JSON.stringify(voicesData, null, 2));
        } else {
            const errorText = await voicesResponse.text();
            console.log('   Error response:', errorText);
        }
    } catch (error) {
        console.log('   ❌ Voices check failed:', error.message);
    }
    
    // Test 3: TTS Synthesis with different parameter combinations
    console.log('\n3. Testing TTS synthesis...');
    
    const testCases = [
        {
            name: 'Basic request',
            params: {
                text: 'Hello, this is a test.',
                voice: 'af_heart',
                speed: 1.0,
                pitch: 1.0
            }
        },
        {
            name: 'Without pitch parameter',
            params: {
                text: 'Hello, this is a test.',
                voice: 'af_heart',
                speed: 1.0
            }
        },
        {
            name: 'Minimal request',
            params: {
                text: 'Hello, this is a test.'
            }
        },
        {
            name: 'Invalid voice',
            params: {
                text: 'Hello, this is a test.',
                voice: 'invalid_voice',
                speed: 1.0,
                pitch: 1.0
            }
        },
        {
            name: 'Invalid speed',
            params: {
                text: 'Hello, this is a test.',
                voice: 'af_heart',
                speed: 5.0,  // Outside valid range
                pitch: 1.0
            }
        }
    ];
    
    for (const testCase of testCases) {
        console.log(`\n   Testing: ${testCase.name}`);
        console.log(`   Parameters:`, JSON.stringify(testCase.params, null, 2));
        
        try {
            const ttsResponse = await fetch(`${baseUrl}/api/v1/speech/synthesize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(testCase.params)
            });
            
            console.log(`   Status: ${ttsResponse.status} ${ttsResponse.statusText}`);
            console.log(`   Content-Type: ${ttsResponse.headers.get('content-type')}`);
            
            if (ttsResponse.ok) {
                const audioBlob = await ttsResponse.blob();
                console.log(`   ✅ Success! Audio blob size: ${audioBlob.size} bytes`);
            } else {
                const errorText = await ttsResponse.text();
                console.log(`   ❌ Error response: ${errorText}`);
                
                // Try to parse as JSON for more details
                try {
                    const errorJson = JSON.parse(errorText);
                    console.log(`   Error details:`, JSON.stringify(errorJson, null, 2));
                } catch (e) {
                    // Not JSON, already logged as text
                }
            }
        } catch (error) {
            console.log(`   ❌ Request failed: ${error.message}`);
        }
    }
    
    console.log('\n🔍 Python service test completed!');
}

// Run the test
testPythonService().catch(error => {
    console.error('Test script failed:', error);
    process.exit(1);
});