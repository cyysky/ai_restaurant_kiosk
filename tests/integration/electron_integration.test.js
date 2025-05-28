const path = require('path');
const fs = require('fs');

// Check if Spectron is available
let Application;
let spectronAvailable = false;

try {
  const spectron = require('spectron');
  Application = spectron.Application;
  spectronAvailable = true;
} catch (error) {
  console.log('Spectron not available, skipping integration tests');
}

// Integration tests for the full Electron application
const describeOrSkip = spectronAvailable ? describe : describe.skip;

describeOrSkip('Electron Application Integration', () => {
  let app;
  
  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    
    // Create a test app instance
    app = new Application({
      path: require('electron'),
      args: [path.join(__dirname, '../../main.js'), '--dev'],
      env: {
        NODE_ENV: 'test',
        ELECTRON_IS_DEV: '1'
      },
      startTimeout: 30000,
      waitTimeout: 30000
    });
  }, 30000);

  afterAll(async () => {
    if (app && app.isRunning()) {
      await app.stop();
    }
  });

  describe('Application Startup', () => {
    test('should start the application successfully', async () => {
      await app.start();
      
      expect(app.isRunning()).toBe(true);
      
      const windowCount = await app.client.getWindowCount();
      expect(windowCount).toBe(1);
    }, 30000);

    test('should load the main window', async () => {
      const title = await app.client.getTitle();
      expect(title).toBeDefined();
      
      const isVisible = await app.browserWindow.isVisible();
      expect(isVisible).toBe(true);
    });

    test('should have correct window dimensions in dev mode', async () => {
      const bounds = await app.browserWindow.getBounds();
      expect(bounds.width).toBe(1200);
      expect(bounds.height).toBe(800);
    });

    test('should load the UI HTML file', async () => {
      const url = await app.client.getUrl();
      expect(url).toContain('index.html');
    });
  });

  describe('System Components', () => {
    test('should initialize system orchestrator', async () => {
      // Wait for system to be ready
      await app.client.waitUntil(async () => {
        const logs = await app.client.getRenderProcessLogs();
        return logs.some(log => log.message.includes('System Orchestrator initialized'));
      }, 10000);
      
      const logs = await app.client.getRenderProcessLogs();
      const initLog = logs.find(log => log.message.includes('System Orchestrator initialized'));
      expect(initLog).toBeDefined();
    });

    test('should have electronAPI available in renderer', async () => {
      const result = await app.client.execute(() => {
        return typeof window.electronAPI !== 'undefined';
      });
      
      expect(result.value).toBe(true);
    });

    test('should have all required API methods', async () => {
      const result = await app.client.execute(() => {
        const api = window.electronAPI;
        return {
          hasHandleSpeechInput: typeof api.handleSpeechInput === 'function',
          hasHandleTouchInput: typeof api.handleTouchInput === 'function',
          hasHandleMenuRequest: typeof api.handleMenuRequest === 'function',
          hasGetSystemStatus: typeof api.getSystemStatus === 'function',
          hasOnSystemReady: typeof api.onSystemReady === 'function',
          hasOnUIUpdate: typeof api.onUIUpdate === 'function'
        };
      });
      
      expect(result.value.hasHandleSpeechInput).toBe(true);
      expect(result.value.hasHandleTouchInput).toBe(true);
      expect(result.value.hasHandleMenuRequest).toBe(true);
      expect(result.value.hasGetSystemStatus).toBe(true);
      expect(result.value.hasOnSystemReady).toBe(true);
      expect(result.value.hasOnUIUpdate).toBe(true);
    });
  });

  describe('IPC Communication', () => {
    test('should handle system status requests', async () => {
      const result = await app.client.execute(async () => {
        try {
          const status = await window.electronAPI.getSystemStatus();
          return { success: true, status };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });
      
      expect(result.value.success).toBe(true);
      expect(result.value.status).toBeDefined();
      expect(result.value.status.system).toBeDefined();
    });

    test('should handle menu requests', async () => {
      const result = await app.client.execute(async () => {
        try {
          const menuResponse = await window.electronAPI.handleMenuRequest({ action: 'get_menu' });
          return { success: true, response: menuResponse };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });
      
      expect(result.value.success).toBe(true);
      expect(result.value.response).toBeDefined();
    });

    test('should handle speech input simulation', async () => {
      const result = await app.client.execute(async () => {
        try {
          const speechResponse = await window.electronAPI.handleSpeechInput({
            text: 'Show me the menu',
            confidence: 0.9,
            timestamp: Date.now(),
            source: 'test'
          });
          return { success: true, response: speechResponse };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });
      
      expect(result.value.success).toBe(true);
      expect(result.value.response).toBeDefined();
      expect(result.value.response.success).toBe(true);
    });
  });

  describe('UI Elements', () => {
    test('should load main UI elements', async () => {
      // Wait for UI to load
      await app.client.waitForExist('body', 5000);
      
      const bodyExists = await app.client.isExisting('body');
      expect(bodyExists).toBe(true);
    });

    test('should have no console errors on startup', async () => {
      const logs = await app.client.getRenderProcessLogs();
      const errors = logs.filter(log => log.level === 'SEVERE');
      
      // Filter out known non-critical errors
      const criticalErrors = errors.filter(error => 
        !error.message.includes('DevTools') &&
        !error.message.includes('Extension')
      );
      
      expect(criticalErrors).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid menu requests gracefully', async () => {
      const result = await app.client.execute(async () => {
        try {
          const response = await window.electronAPI.handleMenuRequest({ action: 'invalid_action' });
          return { success: true, response };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });
      
      // Should not throw, but return error response
      expect(result.value.success).toBe(true);
      expect(result.value.response.success).toBe(false);
    });

    test('should handle malformed speech input', async () => {
      const result = await app.client.execute(async () => {
        try {
          const response = await window.electronAPI.handleSpeechInput({
            // Missing required text field
            confidence: 0.9
          });
          return { success: true, response };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });
      
      expect(result.value.success).toBe(true);
      expect(result.value.response.success).toBe(false);
    });
  });

  describe('Configuration', () => {
    test('should handle configuration updates', async () => {
      const result = await app.client.execute(async () => {
        try {
          const response = await window.electronAPI.updateConfig({
            llm: { model: 'test-model' }
          });
          return { success: true, response };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });
      
      expect(result.value.success).toBe(true);
      expect(result.value.response).toBeDefined();
    });
  });

  describe('Event System', () => {
    test('should receive system events', async () => {
      const result = await app.client.execute(() => {
        return new Promise((resolve) => {
          let eventReceived = false;
          
          // Set up event listener
          window.electronAPI.onSystemReady(() => {
            eventReceived = true;
          });
          
          // Check if event was already fired or wait for it
          setTimeout(() => {
            resolve({ eventReceived });
          }, 1000);
        });
      });
      
      // System should be ready by now
      expect(result.value.eventReceived).toBe(true);
    });
  });

  describe('Memory and Performance', () => {
    test('should not have excessive memory usage', async () => {
      const processMetrics = await app.mainProcess.getProcessMemoryInfo();
      
      // Memory usage should be reasonable (less than 500MB)
      expect(processMetrics.workingSetSize).toBeLessThan(500 * 1024 * 1024);
    });

    test('should respond to interactions within reasonable time', async () => {
      const startTime = Date.now();
      
      await app.client.execute(async () => {
        await window.electronAPI.getSystemStatus();
      });
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });
  });
});
