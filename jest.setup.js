// Jest setup file for global test configuration

// Extend Jest timeout for longer running tests
jest.setTimeout(30000);

// Setup global test utilities if needed
global.testUtils = {
  generateTestPath: (name) => `./test-data-${name}-${Date.now()}`,
  cleanupTestFiles: async () => {
    // Cleanup logic can be added here
  }
};

// Mock console methods for cleaner test output if needed
const originalConsoleError = console.error;
beforeEach(() => {
  // Optionally suppress certain console outputs during tests
});

afterEach(() => {
  console.error = originalConsoleError;
});