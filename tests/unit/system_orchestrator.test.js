const SystemOrchestrator = require('../../app/orchestrator/system_orchestrator');
const EventEmitter = require('events');

// Mock all the component modules
jest.mock('../../app/nlu/nlu_engine');
jest.mock('../../app/dialog_manager/dialog_manager');
jest.mock('../../app/menu_engine/menu_engine');
jest.mock('../../app/data_store/data_store');
jest.mock('../../app/speech_input/speech_input');
jest.mock('../../app/speech_output/speech_output');

describe('SystemOrchestrator', () => {
  let orchestrator;
  let mockComponents;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock components
    mockComponents = {
      dataStore: createMockComponent('DataStore'),
      nluEngine: createMockComponent('NLUEngine'),
      dialogManager: createMockComponent('DialogManager'),
      menuEngine: createMockComponent('MenuEngine'),
      speechInput: createMockComponent('SpeechInput'),
      speechOutput: createMockComponent('SpeechOutput')
    };

    // Add specific methods for components
    mockComponents.nluEngine.processText = jest.fn(() => Promise.resolve({
      intent: 'test_intent',
      entities: [],
      confidence: 0.9
    }));

    mockComponents.dialogManager.processIntent = jest.fn(() => Promise.resolve({
      text: 'Test response',
      actions: []
    }));

    mockComponents.menuEngine.getCategory = jest.fn(() => Promise.resolve({
      name: 'Test Category',
      items: []
    }));

    mockComponents.menuEngine.addToCart = jest.fn(() => Promise.resolve({
      cart: { items: [], total: 0 }
    }));

    mockComponents.speechOutput.speak = jest.fn(() => Promise.resolve());

    // Mock the require calls
    require('../../app/data_store/data_store').mockImplementation(() => mockComponents.dataStore);
    require('../../app/nlu/nlu_engine').mockImplementation(() => mockComponents.nluEngine);
    require('../../app/dialog_manager/dialog_manager').mockImplementation(() => mockComponents.dialogManager);
    require('../../app/menu_engine/menu_engine').mockImplementation(() => mockComponents.menuEngine);
    require('../../app/speech_input/speech_input').mockImplementation(() => mockComponents.speechInput);
    require('../../app/speech_output/speech_output').mockImplementation(() => mockComponents.speechOutput);

    orchestrator = new SystemOrchestrator();
  });

  describe('Constructor', () => {
    test('should initialize with correct default values', () => {
      expect(orchestrator.components).toEqual({});
      expect(orchestrator.isInitialized).toBe(false);
      expect(orchestrator.systemStatus).toBe('offline');
      expect(orchestrator.config).toBeNull();
      expect(orchestrator.pythonServiceStatus).toEqual({
        stt: 'unknown',
        tts: 'unknown',
        overall: 'unknown'
      });
    });

    test('should extend EventEmitter', () => {
      expect(orchestrator).toBeInstanceOf(EventEmitter);
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      // Mock loadConfiguration
      orchestrator.loadConfiguration = jest.fn(() => Promise.resolve());
      orchestrator.initializeComponents = jest.fn(() => Promise.resolve());
      orchestrator.setupCommunication = jest.fn();
      orchestrator.startSystemMonitoring = jest.fn();
    });

    test('should initialize successfully', async () => {
      await orchestrator.initialize();

      expect(orchestrator.loadConfiguration).toHaveBeenCalled();
      expect(orchestrator.initializeComponents).toHaveBeenCalled();
      expect(orchestrator.setupCommunication).toHaveBeenCalled();
      expect(orchestrator.startSystemMonitoring).toHaveBeenCalled();
      expect(orchestrator.isInitialized).toBe(true);
      expect(orchestrator.systemStatus).toBe('online');
    });

    test('should emit system-ready event on successful initialization', async () => {
      const emitSpy = jest.spyOn(orchestrator, 'emit');
      
      await orchestrator.initialize();

      expect(emitSpy).toHaveBeenCalledWith('system-ready');
    });

    test('should handle initialization errors', async () => {
      const error = new Error('Initialization failed');
      orchestrator.loadConfiguration.mockRejectedValue(error);

      await expect(orchestrator.initialize()).rejects.toThrow('Initialization failed');
      expect(orchestrator.systemStatus).toBe('error');
    });
  });

  describe('loadConfiguration', () => {
    beforeEach(() => {
      const fs = require('fs').promises;
      fs.readFile.mockImplementation((filePath) => {
        if (filePath.includes('llm_config.json')) {
          return Promise.resolve(JSON.stringify({ model: 'test-model' }));
        }
        if (filePath.includes('prompt_config.json')) {
          return Promise.resolve(JSON.stringify({ systemPrompt: 'test prompt' }));
        }
        if (filePath.includes('nlu_config.json')) {
          return Promise.resolve(JSON.stringify({ threshold: 0.7 }));
        }
        if (filePath.includes('speech_service_config.json')) {
          return Promise.resolve(JSON.stringify({ baseUrl: 'http://localhost:8000' }));
        }
        return Promise.reject(new Error('File not found'));
      });
    });

    test('should load all configuration files successfully', async () => {
      await orchestrator.loadConfiguration();

      expect(orchestrator.config).toEqual({
        llm: { model: 'test-model' },
        prompts: { systemPrompt: 'test prompt' },
        nlu: { threshold: 0.7 },
        speech: { baseUrl: 'http://localhost:8000' }
      });
    });

    test('should use default configuration on file read errors', async () => {
      const fs = require('fs').promises;
      fs.readFile.mockRejectedValue(new Error('File not found'));

      await orchestrator.loadConfiguration();

      expect(orchestrator.config).toBeDefined();
      expect(orchestrator.config.llm).toBeDefined();
      expect(orchestrator.config.speech).toBeDefined();
    });
  });

  describe('handleSpeechInput', () => {
    beforeEach(async () => {
      orchestrator.config = createMockConfig();
      orchestrator.components = mockComponents;
      orchestrator.isInitialized = true;
    });

    test('should process speech input successfully', async () => {
      const audioData = {
        text: 'Show me the menu',
        confidence: 0.9,
        timestamp: Date.now(),
        source: 'frontend'
      };

      const result = await orchestrator.handleSpeechInput(audioData);

      expect(mockComponents.nluEngine.processText).toHaveBeenCalledWith('Show me the menu');
      expect(mockComponents.dialogManager.processIntent).toHaveBeenCalled();
      expect(mockComponents.speechOutput.speak).toHaveBeenCalledWith('Test response');
      expect(result).toEqual({
        intent: 'test_intent',
        entities: [],
        confidence: 0.9,
        response_text: 'Test response'
      });
    });

    test('should emit raw-transcript event', async () => {
      const emitSpy = jest.spyOn(orchestrator, 'emit');
      const audioData = {
        text: 'Test input',
        confidence: 0.8,
        source: 'frontend'
      };

      await orchestrator.handleSpeechInput(audioData);

      expect(emitSpy).toHaveBeenCalledWith('raw-transcript', {
        text: 'Test input',
        confidence: 0.8,
        source: 'frontend'
      });
    });

    test('should emit processed-interaction event', async () => {
      const emitSpy = jest.spyOn(orchestrator, 'emit');
      const audioData = {
        text: 'Test input',
        confidence: 0.8,
        source: 'frontend'
      };

      await orchestrator.handleSpeechInput(audioData);

      expect(emitSpy).toHaveBeenCalledWith('processed-interaction', {
        input: 'Test input',
        intent: 'test_intent',
        entities: [],
        response: 'Test response',
        actions: []
      });
    });

    test('should handle errors gracefully', async () => {
      const error = new Error('Processing failed');
      mockComponents.nluEngine.processText.mockRejectedValue(error);
      
      const audioData = {
        text: 'Test input',
        confidence: 0.8,
        source: 'frontend'
      };

      const result = await orchestrator.handleSpeechInput(audioData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Processing failed');
      expect(result.intent).toBe('error');
    });

    test('should throw error for missing text', async () => {
      const audioData = {
        confidence: 0.8,
        source: 'frontend'
      };

      const result = await orchestrator.handleSpeechInput(audioData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No text provided in speech input');
    });
  });

  describe('handleTouchInput', () => {
    beforeEach(() => {
      orchestrator.components = mockComponents;
    });

    test('should handle select_category action', async () => {
      const result = await orchestrator.handleTouchInput('select_category', { category: 'mains' });

      expect(mockComponents.menuEngine.getCategory).toHaveBeenCalledWith('mains');
      expect(result.success).toBe(true);
    });

    test('should handle add_to_cart action', async () => {
      const itemData = { item: { name: 'Test Item' }, quantity: 2 };
      
      const result = await orchestrator.handleTouchInput('add_to_cart', itemData);

      expect(mockComponents.menuEngine.addToCart).toHaveBeenCalledWith(itemData.item, itemData.quantity);
      expect(mockComponents.speechOutput.speak).toHaveBeenCalledWith('Added 2 Test Item to your order.');
      expect(result.success).toBe(true);
    });

    test('should handle unknown actions', async () => {
      const result = await orchestrator.handleTouchInput('unknown_action', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown touch action: unknown_action');
    });

    test('should handle errors in touch processing', async () => {
      mockComponents.menuEngine.getCategory.mockRejectedValue(new Error('Menu error'));

      const result = await orchestrator.handleTouchInput('select_category', { category: 'invalid' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Menu error');
    });
  });

  describe('executeActions', () => {
    beforeEach(() => {
      orchestrator.components = mockComponents;
      jest.spyOn(orchestrator, 'emit');
    });

    test('should execute show_menu action with categories view', async () => {
      const actions = [{
        type: 'show_menu',
        data: { view: 'categories' }
      }];

      await orchestrator.executeActions(actions);

      expect(orchestrator.emit).toHaveBeenCalledWith('ui-update', {
        type: 'show-categories',
        data: {}
      });
    });

    test('should execute show_menu action with items view', async () => {
      const actions = [{
        type: 'show_menu',
        data: { view: 'items', category: 'mains' }
      }];

      await orchestrator.executeActions(actions);

      expect(mockComponents.menuEngine.getCategory).toHaveBeenCalledWith('mains');
      expect(orchestrator.emit).toHaveBeenCalledWith('ui-update', {
        type: 'show-category',
        data: { category: 'mains', items: { name: 'Test Category', items: [] } }
      });
    });

    test('should execute add_item action', async () => {
      const actions = [{
        type: 'add_item',
        data: { item: { name: 'Test Item' }, quantity: 1 }
      }];

      await orchestrator.executeActions(actions);

      // The actual implementation calls: addToCart(action.data.item || action.data, action.data.quantity || 1)
      // So it should be called with: ({ name: 'Test Item' }, 1)
      expect(mockComponents.menuEngine.addToCart).toHaveBeenCalledWith({ name: 'Test Item' }, 1);
    });

    test('should handle unknown action types', async () => {
      const actions = [{
        type: 'unknown_action',
        data: {}
      }];

      await orchestrator.executeActions(actions);

      expect(orchestrator.emit).toHaveBeenCalledWith('action-execution-error', {
        action: 'unknown_action',
        error: 'Unknown action type'
      });
    });

    test('should handle action execution errors', async () => {
      mockComponents.menuEngine.getCategory.mockRejectedValue(new Error('Category error'));
      
      const actions = [{
        type: 'show_menu',
        data: { view: 'items', category: 'invalid' }
      }];

      await orchestrator.executeActions(actions);

      expect(orchestrator.emit).toHaveBeenCalledWith('action-execution-error', {
        action: 'show_menu',
        error: 'Category error'
      });
    });
  });

  describe('getSystemStatus', () => {
    beforeEach(() => {
      orchestrator.components = mockComponents;
      orchestrator.isInitialized = true;
      orchestrator.systemStatus = 'online';
    });

    test('should return comprehensive system status', async () => {
      const status = await orchestrator.getSystemStatus();

      expect(status).toEqual({
        system: 'online',
        components: {
          dataStore: { status: 'ready' },
          nluEngine: { status: 'ready' },
          dialogManager: { status: 'ready' },
          menuEngine: { status: 'ready' },
          speechInput: { status: 'ready' },
          speechOutput: { status: 'ready' }
        },
        pythonService: {
          stt: 'unknown',
          tts: 'unknown',
          overall: 'unknown'
        },
        initialized: true,
        timestamp: expect.any(Number)
      });
    });

    test('should handle components without getStatus method', async () => {
      mockComponents.dataStore.getStatus = undefined;

      const status = await orchestrator.getSystemStatus();

      expect(status.components.dataStore).toBe('status_not_available');
    });

    test('should handle component status errors', async () => {
      mockComponents.nluEngine.getStatus.mockRejectedValue(new Error('Status error'));

      const status = await orchestrator.getSystemStatus();

      expect(status.components.nluEngine).toEqual({
        status: 'error',
        error: 'Status error'
      });
    });
  });

  describe('updatePythonServiceStatus', () => {
    beforeEach(() => {
      jest.spyOn(orchestrator, 'emit');
    });

    test('should update STT service status', () => {
      orchestrator.updatePythonServiceStatus('stt', 'healthy');

      expect(orchestrator.pythonServiceStatus.stt).toBe('healthy');
      expect(orchestrator.pythonServiceStatus.overall).toBe('healthy');
      expect(orchestrator.emit).toHaveBeenCalledWith('python-service-status', orchestrator.pythonServiceStatus);
    });

    test('should update TTS service status', () => {
      orchestrator.updatePythonServiceStatus('tts', 'down');

      expect(orchestrator.pythonServiceStatus.tts).toBe('down');
      expect(orchestrator.pythonServiceStatus.overall).toBe('degraded');
    });

    test('should set overall status to down when both services are down', () => {
      orchestrator.updatePythonServiceStatus('stt', 'down');
      orchestrator.updatePythonServiceStatus('tts', 'down');

      expect(orchestrator.pythonServiceStatus.overall).toBe('down');
    });

    test('should emit notification on service down', () => {
      orchestrator.updatePythonServiceStatus('stt', 'down');

      expect(orchestrator.emit).toHaveBeenCalledWith('notification', {
        type: 'warning',
        message: 'The STT service is currently unavailable. Functionality may be limited.'
      });
    });
  });

  describe('shutdown', () => {
    beforeEach(() => {
      orchestrator.components = mockComponents;
      orchestrator.isInitialized = true;
      orchestrator.serviceCheckInterval = setInterval(() => {}, 1000);
    });

    test('should shutdown all components successfully', async () => {
      await orchestrator.shutdown();

      Object.values(mockComponents).forEach(component => {
        expect(component.shutdown).toHaveBeenCalled();
      });
      expect(orchestrator.isInitialized).toBe(false);
      expect(orchestrator.systemStatus).toBe('offline');
    });

    test('should clear service check interval', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      await orchestrator.shutdown();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    test('should emit system-shutdown event', async () => {
      const emitSpy = jest.spyOn(orchestrator, 'emit');
      
      await orchestrator.shutdown();

      expect(emitSpy).toHaveBeenCalledWith('system-shutdown');
    });

    test('should handle component shutdown errors gracefully', async () => {
      mockComponents.dataStore.shutdown.mockRejectedValue(new Error('Shutdown error'));

      await expect(orchestrator.shutdown()).resolves.not.toThrow();
      expect(orchestrator.isInitialized).toBe(false);
    });
  });
});