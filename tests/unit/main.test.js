const { KioskApplication } = require('../../main');
const { BrowserWindow, app, ipcMain } = require('electron');

describe('KioskApplication', () => {
  let kioskApp;
  let mockOrchestrator;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock SystemOrchestrator
    mockOrchestrator = {
      initialize: jest.fn(() => Promise.resolve()),
      shutdown: jest.fn(() => Promise.resolve()),
      setMainWindow: jest.fn(),
      handleSpeechInput: jest.fn(() => Promise.resolve({ success: true })),
      handleTouchInput: jest.fn(() => Promise.resolve({ success: true })),
      handleMenuRequest: jest.fn(() => Promise.resolve({ success: true })),
      getSystemStatus: jest.fn(() => Promise.resolve({ status: 'ready' })),
      updateConfiguration: jest.fn(() => Promise.resolve({ success: true })),
      on: jest.fn()
    };

    // Mock the SystemOrchestrator module
    jest.doMock('../../app/orchestrator/system_orchestrator', () => {
      return jest.fn().mockImplementation(() => mockOrchestrator);
    });

    kioskApp = new KioskApplication();
  });

  afterEach(() => {
    jest.dontMock('../../app/orchestrator/system_orchestrator');
  });

  describe('Constructor', () => {
    test('should initialize with correct default values', () => {
      expect(kioskApp.mainWindow).toBeNull();
      expect(kioskApp.orchestrator).toBeNull();
      expect(kioskApp.isDev).toBe(false);
      expect(kioskApp.isRemoteDebuggingEnabled).toBe(false);
      expect(kioskApp.isLoggingEnabled).toBe(false);
    });

    test('should detect development mode from command line args', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'main.js', '--dev'];
      
      const devApp = new KioskApplication();
      expect(devApp.isDev).toBe(true);
      
      process.argv = originalArgv;
    });

    test('should detect remote debugging from command line args', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'main.js', '--remote-debugging-port=9222'];
      
      const debugApp = new KioskApplication();
      expect(debugApp.isRemoteDebuggingEnabled).toBe(true);
      
      process.argv = originalArgv;
    });

    test('should detect logging from command line args', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'main.js', '--enable-logging'];
      
      const loggingApp = new KioskApplication();
      expect(loggingApp.isLoggingEnabled).toBe(true);
      
      process.argv = originalArgv;
    });
  });

  describe('initialize', () => {
    test('should initialize orchestrator and setup IPC handlers', async () => {
      await kioskApp.initialize();

      expect(kioskApp.orchestrator).toBeDefined();
      expect(mockOrchestrator.initialize).toHaveBeenCalled();
      expect(ipcMain.handle).toHaveBeenCalledWith('speech-input', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('touch-input', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('menu-request', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('system-status', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('update-config', expect.any(Function));
    });

    test('should handle initialization errors', async () => {
      mockOrchestrator.initialize.mockRejectedValue(new Error('Init failed'));

      await expect(kioskApp.initialize()).rejects.toThrow('Init failed');
    });
  });

  describe('createWindow', () => {
    beforeEach(async () => {
      await kioskApp.initialize();
    });

    test('should create browser window with correct development settings', () => {
      kioskApp.isDev = true;
      kioskApp.createWindow();

      expect(BrowserWindow).toHaveBeenCalledWith({
        width: 1200,
        height: 800,
        fullscreen: false,
        kiosk: false,
        frame: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          enableRemoteModule: false,
          preload: expect.stringContaining('preload.js')
        },
        show: false
      });
    });

    test('should create browser window with correct production settings', () => {
      kioskApp.isDev = false;
      kioskApp.createWindow();

      expect(BrowserWindow).toHaveBeenCalledWith({
        width: 1920,
        height: 1080,
        fullscreen: true,
        kiosk: true,
        frame: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          enableRemoteModule: false,
          preload: expect.stringContaining('preload.js')
        },
        show: false
      });
    });

    test('should load the correct HTML file', () => {
      kioskApp.createWindow();
      expect(kioskApp.mainWindow.loadFile).toHaveBeenCalledWith('app/ui/index.html');
    });

    test('should set main window reference in orchestrator when ready', () => {
      kioskApp.createWindow();
      
      // Simulate the 'ready-to-show' event
      const readyCallback = kioskApp.mainWindow.once.mock.calls.find(
        call => call[0] === 'ready-to-show'
      )[1];
      
      readyCallback();
      
      expect(kioskApp.mainWindow.show).toHaveBeenCalled();
      expect(mockOrchestrator.setMainWindow).toHaveBeenCalledWith(kioskApp.mainWindow);
    });

    test('should open dev tools in development mode', () => {
      kioskApp.isDev = true;
      kioskApp.createWindow();
      
      // Simulate the 'ready-to-show' event
      const readyCallback = kioskApp.mainWindow.once.mock.calls.find(
        call => call[0] === 'ready-to-show'
      )[1];
      
      readyCallback();
      
      expect(kioskApp.mainWindow.webContents.openDevTools).toHaveBeenCalled();
    });

    test('should not open dev tools in production mode', () => {
      kioskApp.isDev = false;
      kioskApp.createWindow();
      
      // Simulate the 'ready-to-show' event
      const readyCallback = kioskApp.mainWindow.once.mock.calls.find(
        call => call[0] === 'ready-to-show'
      )[1];
      
      readyCallback();
      
      expect(kioskApp.mainWindow.webContents.openDevTools).not.toHaveBeenCalled();
    });
  });

  describe('IPC Handlers', () => {
    beforeEach(async () => {
      await kioskApp.initialize();
    });

    test('should handle speech input correctly', async () => {
      const speechData = { text: 'Hello', confidence: 0.9 };
      const expectedResponse = { success: true, intent: 'greeting' };
      
      mockOrchestrator.handleSpeechInput.mockResolvedValue(expectedResponse);

      // Get the speech-input handler
      const speechHandler = ipcMain.handle.mock.calls.find(
        call => call[0] === 'speech-input'
      )[1];

      const result = await speechHandler(null, speechData);

      expect(mockOrchestrator.handleSpeechInput).toHaveBeenCalledWith({
        text: 'Hello',
        confidence: 0.9,
        timestamp: expect.any(Number),
        source: 'frontend'
      });
      expect(result).toEqual({
        success: true,
        intent: expectedResponse.intent,
        entities: expectedResponse.entities,
        response_text: expectedResponse.response_text,
        confidence: expectedResponse.confidence
      });
    });

    test('should handle touch input correctly', async () => {
      const action = 'select_item';
      const data = { itemId: 123 };
      const expectedResponse = { success: true };
      
      mockOrchestrator.handleTouchInput.mockResolvedValue(expectedResponse);

      // Get the touch-input handler
      const touchHandler = ipcMain.handle.mock.calls.find(
        call => call[0] === 'touch-input'
      )[1];

      const result = await touchHandler(null, action, data);

      expect(mockOrchestrator.handleTouchInput).toHaveBeenCalledWith(action, data);
      expect(result).toBe(expectedResponse);
    });

    test('should handle menu requests correctly', async () => {
      const request = { action: 'get_menu' };
      const expectedResponse = { success: true, data: {} };
      
      mockOrchestrator.handleMenuRequest.mockResolvedValue(expectedResponse);

      // Get the menu-request handler
      const menuHandler = ipcMain.handle.mock.calls.find(
        call => call[0] === 'menu-request'
      )[1];

      const result = await menuHandler(null, request);

      expect(mockOrchestrator.handleMenuRequest).toHaveBeenCalledWith(request);
      expect(result).toBe(expectedResponse);
    });

    test('should handle system status requests correctly', async () => {
      const expectedStatus = { status: 'ready', components: {} };
      
      mockOrchestrator.getSystemStatus.mockResolvedValue(expectedStatus);

      // Get the system-status handler
      const statusHandler = ipcMain.handle.mock.calls.find(
        call => call[0] === 'system-status'
      )[1];

      const result = await statusHandler(null);

      expect(mockOrchestrator.getSystemStatus).toHaveBeenCalled();
      expect(result).toBe(expectedStatus);
    });

    test('should handle configuration updates correctly', async () => {
      const config = { llm: { model: 'new-model' } };
      const expectedResponse = { success: true };
      
      mockOrchestrator.updateConfiguration.mockResolvedValue(expectedResponse);

      // Get the update-config handler
      const configHandler = ipcMain.handle.mock.calls.find(
        call => call[0] === 'update-config'
      )[1];

      const result = await configHandler(null, config);

      expect(mockOrchestrator.updateConfiguration).toHaveBeenCalledWith(config);
      expect(result).toBe(expectedResponse);
    });
  });

  describe('Event Forwarding', () => {
    beforeEach(async () => {
      await kioskApp.initialize();
      kioskApp.createWindow();
    });

    test('should forward system-ready event to renderer', () => {
      // Get the system-ready event handler
      const systemReadyHandler = mockOrchestrator.on.mock.calls.find(
        call => call[0] === 'system-ready'
      )[1];

      systemReadyHandler();

      expect(kioskApp.mainWindow.webContents.send).toHaveBeenCalledWith('system-ready');
    });

    test('should forward system-error event to renderer', () => {
      const error = { message: 'Test error' };
      
      // Get the system-error event handler
      const systemErrorHandler = mockOrchestrator.on.mock.calls.find(
        call => call[0] === 'system-error'
      )[1];

      systemErrorHandler(error);

      expect(kioskApp.mainWindow.webContents.send).toHaveBeenCalledWith('system-error', error);
    });

    test('should forward ui-update event to renderer with clean data', () => {
      const update = { type: 'test-update', data: { test: true } };
      
      // Get the ui-update event handler
      const uiUpdateHandler = mockOrchestrator.on.mock.calls.find(
        call => call[0] === 'ui-update'
      )[1];

      uiUpdateHandler(update);

      expect(kioskApp.mainWindow.webContents.send).toHaveBeenCalledWith('ui-update', {
        type: 'test-update',
        data: { test: true }
      });
    });
  });

  describe('Logging and Debugging', () => {
    test('should log debugging status when enabled', () => {
      const originalConsole = console.log;
      console.log = jest.fn();

      const debugApp = new KioskApplication();
      debugApp.isRemoteDebuggingEnabled = true;
      debugApp.isLoggingEnabled = true;
      debugApp.isDev = true;

      debugApp.logDebuggingStatus();

      expect(console.log).toHaveBeenCalledWith('🐛 Remote debugging enabled on port 9222');
      expect(console.log).toHaveBeenCalledWith('📝 Enhanced logging enabled');
      expect(console.log).toHaveBeenCalledWith('🔧 Development mode enabled');

      console.log = originalConsole;
    });
  });
});