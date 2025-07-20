// Jest setup file for global test configuration

// Extend Jest timeout for longer running tests, especially in CI
const testTimeout = process.env.CI ? 60000 : 30000;
jest.setTimeout(testTimeout);

// Setup global test utilities if needed
global.testUtils = {
  generateTestPath: (name) => `./test-data-${name}-${Date.now()}`,
  cleanupTestFiles: async () => {
    // Cleanup logic can be added here
  }
};

// Enhanced error handling for CI environments
const originalConsoleError = console.error;
beforeEach(() => {
  // Suppress expected error logs in CI to reduce noise
  if (process.env.CI) {
    jest.spyOn(console, 'error').mockImplementation((message) => {
      // Only suppress specific expected errors, let real errors through
      if (message && typeof message === 'string' && 
          (message.includes('Server error: API Error in insert: Missing required field') ||
           message.includes('Warning: Closing file descriptor'))) {
        return;
      }
      originalConsoleError(message);
    });
  }
});

afterEach(() => {
  // Restore console.error
  if (process.env.CI && console.error.mockRestore) {
    console.error.mockRestore();
  }
});

// Global error handler for unhandled promises in CI
if (process.env.CI) {
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
}