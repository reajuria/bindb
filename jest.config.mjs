export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'CommonJS',
          target: 'ES2022',
        },
      },
    ],
  },
  testMatch: [
    '**/test/**/*.test.ts',
    '**/test-e2e/**/*.test.ts',
    '**/benchmarks/**/*.bench.ts',
  ],
  collectCoverageFrom: [
    'engine/**/*.ts',
    'http/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: process.env.CI ? 60000 : 30000,
  verbose: true,
  maxWorkers: process.env.CI ? 1 : undefined,
  forceExit: true,
  detectOpenHandles: true,
  // Additional CI stability settings
  maxConcurrency: process.env.CI ? 1 : 5,
  workerIdleMemoryLimit: process.env.CI ? '512MB' : undefined,
};
