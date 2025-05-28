const { spawn } = require('child_process');
const fetch = require('node-fetch');
const path = require('path');

class IntegrationTester {
    constructor() {
        this.pythonProcess = null;
        this.serviceUrl = 'http://127.0.0.1:8000';
    }

    async startPythonService() {
        console.log('Starting Python speech service...');
        
        const pythonServicePath = path.join(__dirname, 'python_service');
        
        // Try to start the Python service
        this.pythonProcess = spawn('python', ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8000'], {
            cwd: pythonServicePath,
            stdio: 'pipe'
        });

        this.pythonProcess.stdout.on('data', (data) => {
            console.log(`Python service: ${data}`);
        });

        this.pythonProcess.stderr.on('data', (data) => {
            console.error(`Python service error: ${data}`);
        });

        // Wait for service to start
        await this.waitForService();
    }

    async waitForService(maxAttempts = 30) {
        console.log('Waiting for Python service to be ready...');
        
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const response = await fetch(`${this.serviceUrl}/api/v1/health`);
                if (response.ok) {
                    const health = await response.json();
                    console.log('Python service is ready:', health);
                    return true;
                }
            } catch (error) {
                // Service not ready yet
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            console.log(`Attempt ${i + 1}/${maxAttempts}...`);
        }
        
        throw new Error('Python service failed to start within timeout');
    }

    async testSTT() {
        console.log('\nTesting Speech-to-Text...');
        
        try {
            // Create a simple test audio file (this would normally be actual audio)
            const formData = new FormData();
            const testBlob = new Blob(['test audio data'], { type: 'audio/wav' });
            formData.append('audio', testBlob, 'test.wav');
            formData.append('language', 'auto');

            const response = await fetch(`${this.serviceUrl}/api/v1/speech/transcribe`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                console.log('STT test result:', result);
                return true;
            } else {
                console.error('STT test failed:', response.status, response.statusText);
                return false;
            }
        } catch (error) {
            console.error('STT test error:', error);
            return false;
        }
    }

    async testTTS() {
        console.log('\nTesting Text-to-Speech...');
        
        try {
            const response = await fetch(`${this.serviceUrl}/api/v1/speech/synthesize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: 'Hello, this is a test of the text-to-speech system.',
                    voice: 'af_heart',
                    speed: 1.0
                })
            });

            if (response.ok) {
                const audioBlob = await response.blob();
                console.log('TTS test successful, audio size:', audioBlob.size, 'bytes');
                return true;
            } else {
                console.error('TTS test failed:', response.status, response.statusText);
                return false;
            }
        } catch (error) {
            console.error('TTS test error:', error);
            return false;
        }
    }

    async testVoices() {
        console.log('\nTesting voice list...');
        
        try {
            const response = await fetch(`${this.serviceUrl}/api/v1/speech/voices`);
            
            if (response.ok) {
                const voices = await response.json();
                console.log('Available voices:', voices);
                return true;
            } else {
                console.error('Voices test failed:', response.status, response.statusText);
                return false;
            }
        } catch (error) {
            console.error('Voices test error:', error);
            return false;
        }
    }

    async runTests() {
        try {
            await this.startPythonService();
            
            const sttResult = await this.testSTT();
            const ttsResult = await this.testTTS();
            const voicesResult = await this.testVoices();
            
            console.log('\n=== Test Results ===');
            console.log('STT Test:', sttResult ? 'PASS' : 'FAIL');
            console.log('TTS Test:', ttsResult ? 'PASS' : 'FAIL');
            console.log('Voices Test:', voicesResult ? 'PASS' : 'FAIL');
            
            const allPassed = sttResult && ttsResult && voicesResult;
            console.log('Overall:', allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED');
            
            return allPassed;
            
        } catch (error) {
            console.error('Test execution failed:', error);
            return false;
        } finally {
            this.cleanup();
        }
    }

    cleanup() {
        if (this.pythonProcess) {
            console.log('\nStopping Python service...');
            this.pythonProcess.kill();
        }
    }
}

// Run tests if this script is executed directly
if (require.main === module) {
    const tester = new IntegrationTester();
    
    tester.runTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Test runner error:', error);
        process.exit(1);
    });
    
    // Handle cleanup on exit
    process.on('SIGINT', () => {
        tester.cleanup();
        process.exit(0);
    });
}

module.exports = IntegrationTester;