// Test setup and configuration
const path = require('path');

// Mock Electron modules for testing
jest.mock('electron', () => ({
  app: {
    whenReady: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    quit: jest.fn(),
    requestSingleInstanceLock: jest.fn(() => true)
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn(),
    once: jest.fn(),
    on: jest.fn(),
    show: jest.fn(),
    webContents: {
      openDevTools: jest.fn(),
      on: jest.fn(),
      send: jest.fn()
    },
    isMinimized: jest.fn(() => false),
    restore: jest.fn(),
    focus: jest.fn(),
    isDestroyed: jest.fn(() => false),
    reload: jest.fn()
  })),
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn()
  },
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

// Mock file system operations
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    access: jest.fn(),
    mkdir: jest.fn()
  }
}));

// Mock node-fetch for HTTP requests
jest.mock('node-fetch', () => jest.fn());

// Mock WebSocket
jest.mock('ws', () => ({
  WebSocket: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1
  }))
}));

// Mock sqlite3
jest.mock('sqlite3', () => ({
  Database: jest.fn().mockImplementation(() => ({
    run: jest.fn((sql, params, callback) => callback && callback(null)),
    get: jest.fn((sql, params, callback) => callback && callback(null, {})),
    all: jest.fn((sql, params, callback) => callback && callback(null, [])),
    close: jest.fn((callback) => callback && callback(null))
  }))
}));

// Set up test environment
process.env.NODE_ENV = 'test';

// Global test utilities
global.createMockComponent = (name) => ({
  initialize: jest.fn(() => Promise.resolve()),
  shutdown: jest.fn(() => Promise.resolve()),
  getStatus: jest.fn(() => ({ status: 'ready' })),
  on: jest.fn(),
  emit: jest.fn(),
  constructor: { name }
});

global.createMockConfig = () => ({
  llm: {
    baseURL: 'http://localhost:11434/v1',
    model: 'gemma3:4b',
    apiKey: 'test-key'
  },
  prompts: {
    systemPrompt: 'You are a helpful assistant.'
  },
  nlu: {
    confidenceThreshold: 0.7
  },
  speech: {
    service: {
      baseUrl: 'http://127.0.0.1:8000',
      endpoints: {
        health: '/api/v1/health'
      }
    },
    monitoring: {
      healthCheckInterval: 30000
    }
  }
});

// Console suppression for cleaner test output
const originalConsole = console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
};

// Restore console for debugging when needed
global.restoreConsole = () => {
  global.console = originalConsole;
};