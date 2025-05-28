const fs = require('fs').promises;
const path = require('path');

module.exports = async () => {
  console.log('🧹 Cleaning up test environment...');
  
  // Clean up test files and directories
  await cleanupTestFiles();
  
  // Close any open handles
  await closeOpenHandles();
  
  console.log('✅ Test environment cleanup complete');
};

async function cleanupTestFiles() {
  const filesToCleanup = [
    'tests/temp',
    'tests/fixtures/test.db',
    'tests/fixtures/config'
  ];
  
  for (const filePath of filesToCleanup) {
    try {
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) {
        await fs.rmdir(filePath, { recursive: true });
      } else {
        await fs.unlink(filePath);
      }
      console.log(`🗑️ Cleaned up: ${filePath}`);
    } catch (error) {
      // File/directory might not exist or already cleaned up
      if (error.code !== 'ENOENT') {
        console.warn(`⚠️ Could not cleanup ${filePath}:`, error.message);
      }
    }
  }
}

async function closeOpenHandles() {
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  // Clear any remaining timers
  const timers = require('timers');
  if (timers.clearImmediate) {
    // Clear any immediate timers that might be hanging
  }
  
  // Give a moment for cleanup
  await new Promise(resolve => setTimeout(resolve, 100));
}