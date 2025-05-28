#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class TestRunner {
  constructor() {
    this.testTypes = {
      unit: 'tests/unit/**/*.test.js',
      integration: 'tests/integration/**/*.test.js',
      all: 'tests/**/*.test.js'
    };
    
    this.options = {
      coverage: false,
      watch: false,
      verbose: false,
      testType: 'all',
      updateSnapshots: false,
      bail: false,
      silent: false
    };
  }

  parseArgs() {
    const args = process.argv.slice(2);
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '--coverage':
        case '-c':
          this.options.coverage = true;
          break;
        case '--watch':
        case '-w':
          this.options.watch = true;
          break;
        case '--verbose':
        case '-v':
          this.options.verbose = true;
          break;
        case '--unit':
        case '-u':
          this.options.testType = 'unit';
          break;
        case '--integration':
        case '-i':
          this.options.testType = 'integration';
          break;
        case '--update-snapshots':
        case '-U':
          this.options.updateSnapshots = true;
          break;
        case '--bail':
        case '-b':
          this.options.bail = true;
          break;
        case '--silent':
        case '-s':
          this.options.silent = true;
          break;
        case '--help':
        case '-h':
          this.showHelp();
          process.exit(0);
          break;
        default:
          if (arg.startsWith('--')) {
            console.warn(`Unknown option: ${arg}`);
          }
          break;
      }
    }
  }

  showHelp() {
    console.log(`
🧪 Electron App Test Runner

Usage: node tests/run-tests.js [options]

Options:
  -c, --coverage         Generate coverage report
  -w, --watch           Watch mode for continuous testing
  -v, --verbose         Verbose output
  -u, --unit            Run only unit tests
  -i, --integration     Run only integration tests
  -U, --update-snapshots Update test snapshots
  -b, --bail            Stop on first test failure
  -s, --silent          Minimal output
  -h, --help            Show this help message

Examples:
  node tests/run-tests.js --unit --coverage
  node tests/run-tests.js --integration --verbose
  node tests/run-tests.js --watch
    `);
  }

  async checkPrerequisites() {
    console.log('🔍 Checking prerequisites...');
    
    // Check if Jest is installed
    try {
      require('jest');
      console.log('✅ Jest is available');
    } catch (error) {
      console.error('❌ Jest is not installed. Run: npm install --save-dev jest');
      process.exit(1);
    }

    // Check if test files exist
    const testPattern = this.testTypes[this.options.testType];
    const glob = require('glob');
    
    try {
      const testFiles = glob.sync(testPattern);
      if (testFiles.length === 0) {
        console.warn(`⚠️ No test files found matching pattern: ${testPattern}`);
      } else {
        console.log(`✅ Found ${testFiles.length} test files`);
      }
    } catch (error) {
      console.warn('⚠️ Could not check test files:', error.message);
    }

    // Check if configuration files exist
    const configFiles = ['jest.config.js', 'tests/setup.js'];
    for (const configFile of configFiles) {
      if (fs.existsSync(configFile)) {
        console.log(`✅ ${configFile} exists`);
      } else {
        console.warn(`⚠️ ${configFile} not found`);
      }
    }
  }

  buildJestArgs() {
    const args = [];
    
    // Test pattern
    if (this.options.testType !== 'all') {
      args.push('--testPathPattern', this.testTypes[this.options.testType]);
    }
    
    // Coverage
    if (this.options.coverage) {
      args.push('--coverage');
    }
    
    // Watch mode
    if (this.options.watch) {
      args.push('--watch');
    }
    
    // Verbose
    if (this.options.verbose) {
      args.push('--verbose');
    }
    
    // Update snapshots
    if (this.options.updateSnapshots) {
      args.push('--updateSnapshot');
    }
    
    // Bail on first failure
    if (this.options.bail) {
      args.push('--bail');
    }
    
    // Silent mode
    if (this.options.silent) {
      args.push('--silent');
    }
    
    return args;
  }

  async runTests() {
    const jestArgs = this.buildJestArgs();
    
    console.log('🚀 Starting tests...');
    console.log(`📋 Test type: ${this.options.testType}`);
    console.log(`⚙️ Jest args: ${jestArgs.join(' ')}`);
    
    // Use npx to run jest instead of direct path
    const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const args = ['jest', ...jestArgs];
    
    return new Promise((resolve, reject) => {
      const jest = spawn(command, args, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..'),
        env: {
          ...process.env,
          NODE_ENV: 'test'
        },
        shell: process.platform === 'win32'
      });

      jest.on('close', (code) => {
        if (code === 0) {
          console.log('\n✅ All tests completed successfully!');
          resolve(code);
        } else {
          console.log(`\n❌ Tests failed with exit code ${code}`);
          reject(new Error(`Tests failed with exit code ${code}`));
        }
      });

      jest.on('error', (error) => {
        console.error('❌ Failed to start Jest:', error);
        reject(error);
      });
    });
  }

  async generateReport() {
    if (!this.options.coverage) return;
    
    console.log('\n📊 Generating test report...');
    
    try {
      // Check if coverage files exist
      const coverageFiles = [
        'coverage/lcov-report/index.html',
        'coverage/test-summary.json'
      ];
      
      for (const file of coverageFiles) {
        if (fs.existsSync(file)) {
          console.log(`✅ Generated: ${file}`);
        }
      }
      
      // Display coverage summary if available
      const summaryPath = 'coverage/test-summary.json';
      if (fs.existsSync(summaryPath)) {
        const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
        
        console.log('\n📈 Coverage Summary:');
        if (summary.coverage) {
          console.log(`   Lines: ${summary.coverage.lines.pct}%`);
          console.log(`   Functions: ${summary.coverage.functions.pct}%`);
          console.log(`   Branches: ${summary.coverage.branches.pct}%`);
          console.log(`   Statements: ${summary.coverage.statements.pct}%`);
        }
      }
      
    } catch (error) {
      console.warn('⚠️ Could not generate report:', error.message);
    }
  }

  async run() {
    try {
      this.parseArgs();
      await this.checkPrerequisites();
      await this.runTests();
      await this.generateReport();
      
      process.exit(0);
    } catch (error) {
      console.error('❌ Test runner failed:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new TestRunner();
  runner.run();
}

module.exports = TestRunner;