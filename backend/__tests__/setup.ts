// Test setup for backend tests

// Mock Encore.js modules for testing
jest.mock('encore.dev/api', () => ({
  api: jest.fn((config, handler) => handler),
  APIError: class APIError extends Error {
    constructor(message: string, code: string, status: number, details?: any) {
      super(message);
      this.name = 'APIError';
      this.code = code;
      this.status = status;
      this.details = details;
    }
  },
}));

jest.mock('encore.dev/storage/sqldb', () => ({
  SQLDatabase: {
    named: jest.fn(() => ({
      query: jest.fn(),
      exec: jest.fn(),
      transaction: jest.fn(),
    })),
  },
}));

jest.mock('encore.dev/log', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('~encore/auth', () => ({
  getAuthData: jest.fn(() => ({
    userID: 'test-user-id',
    email: 'test@example.com',
  })),
}));

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.ENCORE_ENV = 'test';

// Global test utilities
global.testUtils = {
  mockDatabase: {
    query: jest.fn(),
    exec: jest.fn(),
    transaction: jest.fn(),
  },
  mockAuth: {
    userID: 'test-user-id',
    email: 'test@example.com',
  },
  mockLog: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Simple test to prevent "no tests" error
describe('Test Setup', () => {
  it('should load test setup successfully', () => {
    expect(true).toBe(true);
  });
});