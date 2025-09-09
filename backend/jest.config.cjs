module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: [
    '<rootDir>/__tests__/**/*.(test|spec).(ts|js)',
    '<rootDir>/**/*.(test|spec).(ts|js)',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    '**/*.(ts|js)',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/__tests__/**',
    '!**/encore.gen/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  testTimeout: 30000,
  moduleNameMapper: {
    '^~encore/(.*)$': '<rootDir>/encore.gen/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  // Add ESM support
  extensionsToTreatAsEsm: ['.ts'],
  // Fix for jest.mock in ESM
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))'
  ],
};
