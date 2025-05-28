# Testing Documentation

This document provides comprehensive information about the testing setup for the AI Kiosk Electron application.

## 📋 Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Test Types](#test-types)
- [Configuration](#configuration)
- [Writing Tests](#writing-tests)
- [Coverage Reports](#coverage-reports)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

## 🔍 Overview

The testing suite is built using **Jest** as the primary testing framework, with additional tools for Electron-specific testing. The tests are organized into unit tests, integration tests, and end-to-end tests.

### Key Features

- ✅ Comprehensive unit tests for all major components
- 🔗 Integration tests for component interactions
- 🖥️ Electron-specific testing with Spectron
- 📊 Code coverage reporting
- 🚀 Automated test running and reporting
- 🔄 Watch mode for development
- 📈 Performance monitoring

## 🏗️ Test Structure

```
tests/
├── unit/                     # Unit tests
│   ├── main.test.js         # Main process tests
│   ├── preload.test.js      # Preload script tests
│   ├── system_orchestrator.test.js
│   └── menu_engine.test.js
├── integration/             # Integration tests
│   └── electron_integration.test.js
├── fixtures/                # Test data and configurations
├── setup.js                # Global test setup
├── global-setup.js         # Jest global setup
├── global-teardown.js      # Jest global teardown
├── test-results-processor.js
├── run-tests.js            # Custom test runner
└── README.md               # This file
```

## 🚀 Running Tests

### Quick Start

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Watch mode for development
npm run test:watch

# CI mode (coverage + bail on failure)
npm run test:ci
```

### Custom Test Runner

The custom test runner provides additional options:

```bash
# Using the custom runner directly
node tests/run-tests.js [options]

# Available options:
--coverage, -c         Generate coverage report
--watch, -w           Watch mode for continuous testing
--verbose, -v         Verbose output
--unit, -u            Run only unit tests
--integration, -i     Run only integration tests
--update-snapshots, -U Update test snapshots
--bail, -b            Stop on first test failure
--silent, -s          Minimal output
--help, -h            Show help message
```

### Examples

```bash
# Run unit tests with coverage
node tests/run-tests.js --unit --coverage

# Run integration tests with verbose output
node tests/run-tests.js --integration --verbose

# Development mode with watch
node tests/run-tests.js --watch --unit
```

## 🧪 Test Types

### Unit Tests

Unit tests focus on testing individual components in isolation:

- **Main Process Tests** (`main.test.js`): Tests for the main Electron process
- **System Orchestrator Tests** (`system_orchestrator.test.js`): Core system coordination
- **Menu Engine Tests** (`menu_engine.test.js`): Menu and cart functionality
- **Preload Tests** (`preload.test.js`): IPC bridge functionality

### Integration Tests

Integration tests verify component interactions:

- **Electron Integration** (`electron_integration.test.js`): Full application testing
- **IPC Communication**: Tests for inter-process communication
- **System Workflow**: End-to-end user scenarios

### Test Coverage Areas

- ✅ Application lifecycle (startup, shutdown)
- ✅ IPC communication (main ↔ renderer)
- ✅ System orchestration and component coordination
- ✅ Menu management and cart operations
- ✅ Speech input/output handling
- ✅ Error handling and recovery
- ✅ Configuration management
- ✅ Event system and notifications

## ⚙️ Configuration

### Jest Configuration (`jest.config.js`)

The Jest configuration includes:

- **Test Environment**: Node.js environment for Electron testing
- **Coverage**: Line, function, branch, and statement coverage
- **Mocking**: Automatic mocking of Electron modules
- **Timeouts**: Extended timeouts for Electron operations
- **Reporters**: Custom HTML and JSON reporting

### Test Setup (`tests/setup.js`)

Global test setup includes:

- Electron module mocking
- File system operation mocking
- Network request mocking
- Test utilities and helpers
- Console output management

## ✍️ Writing Tests

### Basic Test Structure

```javascript
const ComponentToTest = require('../../path/to/component');

describe('ComponentToTest', () => {
  let component;

  beforeEach(() => {
    jest.clearAllMocks();
    component = new ComponentToTest();
  });

  describe('method', () => {
    test('should do something', async () => {
      // Arrange
      const input = 'test input';
      
      // Act
      const result = await component.method(input);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });
});
```

### Mocking Guidelines

```javascript
// Mock external dependencies
jest.mock('external-module');

// Mock Electron modules (already done in setup.js)
const { ipcMain } = require('electron');

// Create component mocks
const mockComponent = createMockComponent('ComponentName');
```

### Testing Async Operations

```javascript
test('should handle async operations', async () => {
  const promise = component.asyncMethod();
  
  // Test intermediate state if needed
  expect(component.isProcessing).toBe(true);
  
  const result = await promise;
  
  expect(result).toBeDefined();
  expect(component.isProcessing).toBe(false);
});
```

### Testing Events

```javascript
test('should emit events', (done) => {
  component.on('test-event', (data) => {
    expect(data).toEqual({ test: true });
    done();
  });
  
  component.triggerEvent();
});
```

## 📊 Coverage Reports

### Coverage Thresholds

The project maintains the following coverage thresholds:

- **Lines**: 70%
- **Functions**: 70%
- **Branches**: 70%
- **Statements**: 70%

### Coverage Reports Location

After running tests with coverage:

```
coverage/
├── lcov-report/index.html    # Interactive HTML report
├── lcov.info                 # LCOV format for CI tools
├── test-summary.json         # JSON summary
├── test-detailed.json        # Detailed test results
└── badges.json              # Badge data for README
```

### Viewing Coverage

```bash
# Generate and open coverage report
npm run test:coverage
open coverage/lcov-report/index.html
```

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:ci
      - uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

### Test Scripts for CI

```bash
# CI-optimized test run
npm run test:ci

# This runs:
# - All tests with coverage
# - Bail on first failure
# - Silent output for cleaner logs
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Electron Module Not Found

```bash
Error: Cannot find module 'electron'
```

**Solution**: Ensure Electron is installed as a dev dependency:
```bash
npm install --save-dev electron
```

#### 2. Test Timeouts

```bash
Timeout - Async callback was not invoked within the 5000ms timeout
```

**Solution**: Increase timeout in Jest config or specific tests:
```javascript
jest.setTimeout(30000); // 30 seconds
```

#### 3. Memory Issues

```bash
JavaScript heap out of memory
```

**Solution**: Increase Node.js memory limit:
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm test
```

#### 4. Spectron Issues

```bash
Error: Application not found
```

**Solution**: Ensure Spectron version matches Electron version:
```bash
npm install --save-dev spectron@latest
```

### Debug Mode

Run tests with debug output:

```bash
DEBUG=* npm test
```

### Verbose Logging

Enable verbose Jest output:

```bash
npm test -- --verbose
```

## 📝 Best Practices

### Test Organization

1. **Group related tests** using `describe` blocks
2. **Use descriptive test names** that explain the expected behavior
3. **Follow AAA pattern**: Arrange, Act, Assert
4. **Keep tests independent** - each test should be able to run in isolation

### Mocking Strategy

1. **Mock external dependencies** to isolate units under test
2. **Use real implementations** for integration tests when possible
3. **Mock time-dependent operations** for consistent results
4. **Verify mock interactions** when testing side effects

### Performance

1. **Use `beforeEach`** for test setup to ensure clean state
2. **Clean up resources** in `afterEach` when needed
3. **Avoid unnecessary async operations** in tests
4. **Use test-specific timeouts** for long-running operations

### Maintenance

1. **Update tests** when changing implementation
2. **Remove obsolete tests** when features are removed
3. **Refactor test utilities** to reduce duplication
4. **Monitor coverage trends** to identify untested areas

## 🆘 Getting Help

If you encounter issues with the testing setup:

1. Check this documentation first
2. Look at existing test files for examples
3. Check the Jest documentation: https://jestjs.io/
4. Check the Spectron documentation: https://www.electronjs.org/spectron
5. Create an issue in the project repository

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Electron Testing Guide](https://www.electronjs.org/docs/latest/tutorial/automated-testing)
- [Spectron Documentation](https://github.com/electron-userland/spectron)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)