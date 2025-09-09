module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/setupTests.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      useESM: true,
    }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  testMatch: [
    '<rootDir>/__tests__/**/*.(ts|tsx)',
    '<rootDir>/**/*.(test|spec).(ts|tsx)',
  ],
  collectCoverageFrom: [
    '**/*.(ts|tsx)',
    '!**/*.d.ts',
    '!setupTests.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
  // Add browser environment mocks
  setupFiles: ['<rootDir>/__tests__/setup-browser.ts'],
  // Fix for jest.mock in ESM
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$|@testing-library|@tanstack))'
  ],
  // Add test timeout
  testTimeout: 10000,
};
