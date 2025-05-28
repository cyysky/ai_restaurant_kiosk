const fs = require('fs').promises;
const path = require('path');

module.exports = async () => {
  console.log('🚀 Setting up test environment...');
  
  // Create test directories if they don't exist
  const testDirs = [
    'coverage',
    'tests/temp',
    'tests/fixtures'
  ];
  
  for (const dir of testDirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }
  
  // Create test configuration files
  await createTestConfigs();
  
  // Set up test database
  await setupTestDatabase();
  
  console.log('✅ Test environment setup complete');
};

async function createTestConfigs() {
  const configDir = 'tests/fixtures/config';
  await fs.mkdir(configDir, { recursive: true });
  
  // Create test LLM config
  const llmConfig = {
    baseURL: 'http://localhost:11434/v1',
    model: 'test-model',
    apiKey: 'test-key',
    timeout: 30000
  };
  
  await fs.writeFile(
    path.join(configDir, 'llm_config.json'),
    JSON.stringify(llmConfig, null, 2)
  );
  
  // Create test prompt config
  const promptConfig = {
    systemPrompt: 'You are a helpful test assistant.',
    templates: {
      greeting: 'Hello! How can I help you today?',
      error: 'I apologize, but I encountered an error.'
    }
  };
  
  await fs.writeFile(
    path.join(configDir, 'prompt_config.json'),
    JSON.stringify(promptConfig, null, 2)
  );
  
  // Create test NLU config
  const nluConfig = {
    confidenceThreshold: 0.7,
    maxRetries: 3,
    timeout: 10000
  };
  
  await fs.writeFile(
    path.join(configDir, 'nlu_config.json'),
    JSON.stringify(nluConfig, null, 2)
  );
  
  // Create test speech service config
  const speechConfig = {
    service: {
      baseUrl: 'http://127.0.0.1:8000',
      endpoints: {
        health: '/api/v1/health',
        transcribe: '/api/v1/speech/transcribe',
        synthesize: '/api/v1/speech/synthesize',
        voices: '/api/v1/speech/voices'
      }
    },
    monitoring: {
      healthCheckInterval: 30000,
      retryAttempts: 3,
      retryDelay: 1000
    }
  };
  
  await fs.writeFile(
    path.join(configDir, 'speech_service_config.json'),
    JSON.stringify(speechConfig, null, 2)
  );
}

async function setupTestDatabase() {
  const testDbPath = 'tests/fixtures/test.db';
  
  // Create a simple test database file
  try {
    await fs.writeFile(testDbPath, '');
    console.log('📄 Test database file created');
  } catch (error) {
    console.warn('⚠️ Could not create test database file:', error.message);
  }
}