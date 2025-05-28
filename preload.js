const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Speech Recognition IPC
  onStartPythonSpeechRecognition: (callback) => ipcRenderer.on('start-python-speech-recognition', callback),
  onStartFallbackSpeechRecognition: (callback) => ipcRenderer.on('start-fallback-speech-recognition', callback),
  onStopSpeechRecognition: (callback) => ipcRenderer.on('stop-speech-recognition', callback),
  
  sendSpeechRecognitionResult: (data) => ipcRenderer.send('speech-recognition-result', data),
  sendSpeechRecognitionError: (error) => ipcRenderer.send('speech-recognition-error', error),
  sendSpeechRecognitionStatus: (status) => ipcRenderer.send('speech-recognition-status', status),
  
  // Speech Synthesis IPC
  onSpeakTextPythonService: (callback) => ipcRenderer.on('speak-text-python-service', callback),
  onSpeakTextFallback: (callback) => ipcRenderer.on('speak-text-fallback', callback),
  onStopSpeech: (callback) => ipcRenderer.on('stop-speech', callback),
  onSetFallbackVoice: (callback) => ipcRenderer.on('set-fallback-voice', callback),
  
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
  
  // Event listeners for system events
  onSystemReady: (callback) => ipcRenderer.on('system-ready', callback),
  onSystemError: (callback) => ipcRenderer.on('system-error', callback),
  onMenuUpdated: (callback) => ipcRenderer.on('menu-updated', callback),
  onOrderUpdated: (callback) => ipcRenderer.on('order-updated', callback),
  onUIUpdate: (callback) => ipcRenderer.on('ui-update', callback),
  onPythonServiceStatus: (callback) => ipcRenderer.on('python-service-status', callback),
  onNotification: (callback) => ipcRenderer.on('notification', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  removeListener: (channel, callback) => ipcRenderer.removeListener(channel, callback)
});

// Log that preload script has loaded
console.log('Preload script loaded successfully');