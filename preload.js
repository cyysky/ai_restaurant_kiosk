const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Speech Recognition IPC - FIX: Extract data from event
  onStartPythonSpeechRecognition: (callback) => ipcRenderer.on('start-python-speech-recognition', (event, data) => callback(data)),
  onStartFallbackSpeechRecognition: (callback) => ipcRenderer.on('start-fallback-speech-recognition', (event, data) => callback(data)),
  onStopSpeechRecognition: (callback) => ipcRenderer.on('stop-speech-recognition', (event, data) => callback(data)),
  
  sendSpeechRecognitionResult: (data) => ipcRenderer.send('speech-recognition-result', data),
  sendSpeechRecognitionError: (error) => ipcRenderer.send('speech-recognition-error', error),
  sendSpeechRecognitionStatus: (status) => ipcRenderer.send('speech-recognition-status', status),
  
  // Speech Synthesis IPC - FIX: Extract data from event
  onSpeakTextPythonService: (callback) => ipcRenderer.on('speak-text-python-service', (event, data) => callback(data)),
  onSpeakTextFallback: (callback) => ipcRenderer.on('speak-text-fallback', (event, data) => callback(data)),
  onStopSpeech: (callback) => ipcRenderer.on('stop-speech', (event, data) => callback(data)),
  onSetFallbackVoice: (callback) => ipcRenderer.on('set-fallback-voice', (event, data) => callback(data)),
  
  sendSpeechSynthesisComplete: (data) => ipcRenderer.send('speech-synthesis-complete', data),
  sendSpeechSynthesisError: (error) => ipcRenderer.send('speech-synthesis-error', error),
  sendSpeechSynthesisStatus: (status) => ipcRenderer.send('speech-synthesis-status', status),
  
  // Voice management
  handleGetFallbackVoices: () => ipcRenderer.invoke('get-fallback-voices'),
  
  // System IPC
  handleSpeechInput: (audioData) => ipcRenderer.invoke('speech-input', audioData),
  handleTouchInput: (action, data) => ipcRenderer.invoke('touch-input', action, data),
  handleMenuRequest: (request) => ipcRenderer.invoke('menu-request', request),
  getSystemStatus: () => ipcRenderer.invoke('system-status'),
  updateConfig: (config) => ipcRenderer.invoke('update-config', config),
  
  // Speech service specific IPC
  startListening: () => ipcRenderer.invoke('speech-start-listening'),
  stopListening: () => ipcRenderer.invoke('speech-stop-listening'),
  speakText: (data) => ipcRenderer.invoke('speech-speak-text', data),
  stopSpeaking: () => ipcRenderer.invoke('speech-stop-speaking'),
  getVoices: () => ipcRenderer.invoke('speech-get-voices'),
  setVoice: (voiceId) => ipcRenderer.invoke('speech-set-voice', voiceId),
  getServiceHealth: () => ipcRenderer.invoke('speech-service-health'),
  
  // Event listeners for system events - FIX: Extract data from event
  onSystemReady: (callback) => ipcRenderer.on('system-ready', (event, ...args) => callback(...args)),
  onSystemError: (callback) => ipcRenderer.on('system-error', (event, data) => callback(data)),
  onMenuUpdated: (callback) => ipcRenderer.on('menu-updated', (event, data) => callback(data)),
  onOrderUpdated: (callback) => ipcRenderer.on('order-updated', (event, data) => callback(data)),
  onUIUpdate: (callback) => ipcRenderer.on('ui-update', (event, data) => {
    console.log('🔍 FIX: Preload received UI update:', { event: !!event, data });
    callback(data);
  }),
  onPythonServiceStatus: (callback) => ipcRenderer.on('python-service-status', (event, data) => callback(data)),
  onNotification: (callback) => ipcRenderer.on('notification', (event, data) => callback(data)),
  onRawTranscript: (callback) => ipcRenderer.on('raw-transcript', (event, data) => callback(data)),
  onProcessedInteraction: (callback) => ipcRenderer.on('processed-interaction', (event, data) => callback(data)),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  removeListener: (channel, callback) => ipcRenderer.removeListener(channel, callback)
});

// Log that preload script has loaded
console.log('Preload script loaded successfully');