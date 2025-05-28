// Mock electron modules before any imports
jest.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: jest.fn()
  },
  ipcRenderer: {
    on: jest.fn(),
    send: jest.fn(),
    invoke: jest.fn(),
    removeAllListeners: jest.fn(),
    removeListener: jest.fn()
  }
}));

const { contextBridge, ipcRenderer } = require('electron');

describe('Preload Script', () => {
  let electronAPI;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the module cache to ensure fresh execution
    delete require.cache[require.resolve('../../preload.js')];
    
    // Ensure the mock is properly set up
    const { contextBridge } = require('electron');
    contextBridge.exposeInMainWorld.mockClear();
    
    // Execute the preload script
    require('../../preload.js');
    
    // Extract the electronAPI from the mock call
    if (contextBridge.exposeInMainWorld.mock.calls.length > 0) {
      electronAPI = contextBridge.exposeInMainWorld.mock.calls[0][1];
    }
  });

  test('should expose electronAPI to main world', () => {
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith('electronAPI', expect.any(Object));
  });

  test('should expose all required API methods', () => {
    expect(electronAPI).toBeDefined();

    // Speech Recognition IPC
    expect(electronAPI.onStartPythonSpeechRecognition).toBeInstanceOf(Function);
    expect(electronAPI.onStartFallbackSpeechRecognition).toBeInstanceOf(Function);
    expect(electronAPI.onStopSpeechRecognition).toBeInstanceOf(Function);
    expect(electronAPI.sendSpeechRecognitionResult).toBeInstanceOf(Function);
    expect(electronAPI.sendSpeechRecognitionError).toBeInstanceOf(Function);
    expect(electronAPI.sendSpeechRecognitionStatus).toBeInstanceOf(Function);

    // Speech Synthesis IPC
    expect(electronAPI.onSpeakTextPythonService).toBeInstanceOf(Function);
    expect(electronAPI.onSpeakTextFallback).toBeInstanceOf(Function);
    expect(electronAPI.onStopSpeech).toBeInstanceOf(Function);
    expect(electronAPI.onSetFallbackVoice).toBeInstanceOf(Function);
    expect(electronAPI.sendSpeechSynthesisComplete).toBeInstanceOf(Function);
    expect(electronAPI.sendSpeechSynthesisError).toBeInstanceOf(Function);
    expect(electronAPI.sendSpeechSynthesisStatus).toBeInstanceOf(Function);

    // Voice management
    expect(electronAPI.handleGetFallbackVoices).toBeInstanceOf(Function);

    // System IPC
    expect(electronAPI.handleSpeechInput).toBeInstanceOf(Function);
    expect(electronAPI.handleTouchInput).toBeInstanceOf(Function);
    expect(electronAPI.handleMenuRequest).toBeInstanceOf(Function);
    expect(electronAPI.getSystemStatus).toBeInstanceOf(Function);
    expect(electronAPI.updateConfig).toBeInstanceOf(Function);

    // Speech service specific IPC
    expect(electronAPI.startListening).toBeInstanceOf(Function);
    expect(electronAPI.stopListening).toBeInstanceOf(Function);
    expect(electronAPI.speakText).toBeInstanceOf(Function);
    expect(electronAPI.stopSpeaking).toBeInstanceOf(Function);
    expect(electronAPI.getVoices).toBeInstanceOf(Function);
    expect(electronAPI.setVoice).toBeInstanceOf(Function);
    expect(electronAPI.getServiceHealth).toBeInstanceOf(Function);

    // Event listeners
    expect(electronAPI.onSystemReady).toBeInstanceOf(Function);
    expect(electronAPI.onSystemError).toBeInstanceOf(Function);
    expect(electronAPI.onMenuUpdated).toBeInstanceOf(Function);
    expect(electronAPI.onOrderUpdated).toBeInstanceOf(Function);
    expect(electronAPI.onUIUpdate).toBeInstanceOf(Function);
    expect(electronAPI.onPythonServiceStatus).toBeInstanceOf(Function);
    expect(electronAPI.onNotification).toBeInstanceOf(Function);
    expect(electronAPI.onRawTranscript).toBeInstanceOf(Function);
    expect(electronAPI.onProcessedInteraction).toBeInstanceOf(Function);

    // Utility methods
    expect(electronAPI.removeAllListeners).toBeInstanceOf(Function);
    expect(electronAPI.removeListener).toBeInstanceOf(Function);
  });

  describe('Event Listeners', () => {

    test('should set up speech recognition event listeners correctly', () => {
      const mockCallback = jest.fn();
      
      electronAPI.onStartPythonSpeechRecognition(mockCallback);
      
      expect(ipcRenderer.on).toHaveBeenCalledWith('start-python-speech-recognition', expect.any(Function));
      
      // Test the callback wrapper
      const [, callbackWrapper] = ipcRenderer.on.mock.calls.find(call => 
        call[0] === 'start-python-speech-recognition'
      );
      
      const testData = { test: 'data' };
      callbackWrapper({}, testData);
      
      expect(mockCallback).toHaveBeenCalledWith(testData);
    });

    test('should set up UI update listener with logging', () => {
      const mockCallback = jest.fn();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      electronAPI.onUIUpdate(mockCallback);
      
      expect(ipcRenderer.on).toHaveBeenCalledWith('ui-update', expect.any(Function));
      
      // Test the callback wrapper
      const [, callbackWrapper] = ipcRenderer.on.mock.calls.find(call => 
        call[0] === 'ui-update'
      );
      
      const testData = { type: 'test', data: {} };
      callbackWrapper({}, testData);
      
      expect(consoleSpy).toHaveBeenCalledWith('🔍 FIX: Preload received UI update:', { event: true, data: testData });
      expect(mockCallback).toHaveBeenCalledWith(testData);
      
      consoleSpy.mockRestore();
    });

    test('should set up system event listeners correctly', () => {
      const mockCallback = jest.fn();
      
      electronAPI.onSystemReady(mockCallback);
      electronAPI.onSystemError(mockCallback);
      electronAPI.onMenuUpdated(mockCallback);
      
      expect(ipcRenderer.on).toHaveBeenCalledWith('system-ready', expect.any(Function));
      expect(ipcRenderer.on).toHaveBeenCalledWith('system-error', expect.any(Function));
      expect(ipcRenderer.on).toHaveBeenCalledWith('menu-updated', expect.any(Function));
    });
  });

  describe('IPC Invoke Methods', () => {

    test('should invoke speech input handler', () => {
      const audioData = { text: 'test', confidence: 0.9 };
      
      electronAPI.handleSpeechInput(audioData);
      
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('speech-input', audioData);
    });

    test('should invoke touch input handler', () => {
      const action = 'select_item';
      const data = { itemId: 123 };
      
      electronAPI.handleTouchInput(action, data);
      
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('touch-input', action, data);
    });

    test('should invoke menu request handler', () => {
      const request = { action: 'get_menu' };
      
      electronAPI.handleMenuRequest(request);
      
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('menu-request', request);
    });

    test('should invoke system status handler', () => {
      electronAPI.getSystemStatus();
      
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('system-status');
    });

    test('should invoke config update handler', () => {
      const config = { llm: { model: 'new-model' } };
      
      electronAPI.updateConfig(config);
      
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('update-config', config);
    });

    test('should invoke speech service methods', () => {
      electronAPI.startListening();
      electronAPI.stopListening();
      electronAPI.speakText({ text: 'hello' });
      electronAPI.stopSpeaking();
      electronAPI.getVoices();
      electronAPI.setVoice('voice-id');
      electronAPI.getServiceHealth();
      
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('speech-start-listening');
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('speech-stop-listening');
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('speech-speak-text', { text: 'hello' });
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('speech-stop-speaking');
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('speech-get-voices');
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('speech-set-voice', 'voice-id');
      expect(ipcRenderer.invoke).toHaveBeenCalledWith('speech-service-health');
    });
  });

  describe('IPC Send Methods', () => {

    test('should send speech recognition results', () => {
      const data = { text: 'recognized text', confidence: 0.95 };
      
      electronAPI.sendSpeechRecognitionResult(data);
      
      expect(ipcRenderer.send).toHaveBeenCalledWith('speech-recognition-result', data);
    });

    test('should send speech recognition errors', () => {
      const error = { message: 'Recognition failed' };
      
      electronAPI.sendSpeechRecognitionError(error);
      
      expect(ipcRenderer.send).toHaveBeenCalledWith('speech-recognition-error', error);
    });

    test('should send speech synthesis completion', () => {
      const data = { success: true };
      
      electronAPI.sendSpeechSynthesisComplete(data);
      
      expect(ipcRenderer.send).toHaveBeenCalledWith('speech-synthesis-complete', data);
    });

    test('should send speech synthesis errors', () => {
      const error = { message: 'Synthesis failed' };
      
      electronAPI.sendSpeechSynthesisError(error);
      
      expect(ipcRenderer.send).toHaveBeenCalledWith('speech-synthesis-error', error);
    });
  });

  describe('Utility Methods', () => {

    test('should remove all listeners for a channel', () => {
      const channel = 'test-channel';
      
      electronAPI.removeAllListeners(channel);
      
      expect(ipcRenderer.removeAllListeners).toHaveBeenCalledWith(channel);
    });

    test('should remove specific listener', () => {
      const channel = 'test-channel';
      const callback = jest.fn();
      
      electronAPI.removeListener(channel, callback);
      
      expect(ipcRenderer.removeListener).toHaveBeenCalledWith(channel, callback);
    });
  });

  test('should load successfully and expose electronAPI', () => {
    // This test verifies successful loading by checking that the script's main functionality
    // is properly exposed, which is a better indicator than console.log in the test environment
    
    // The beforeEach already loads the module and sets up electronAPI
    // So we just need to verify that electronAPI is properly defined and functional
    
    // Verify the exposed API has the expected structure (this confirms successful loading)
    expect(electronAPI).toBeDefined();
    expect(electronAPI).toHaveProperty('handleSpeechInput');
    expect(electronAPI).toHaveProperty('handleTouchInput');
    expect(electronAPI).toHaveProperty('onSystemReady');
    expect(electronAPI).toHaveProperty('removeAllListeners');
    
    // Verify that the API methods are actually functions
    expect(typeof electronAPI.handleSpeechInput).toBe('function');
    expect(typeof electronAPI.handleTouchInput).toBe('function');
    expect(typeof electronAPI.onSystemReady).toBe('function');
    expect(typeof electronAPI.removeAllListeners).toBe('function');
    
    // If we get here, the preload script loaded successfully and exposed all required APIs
  });
});