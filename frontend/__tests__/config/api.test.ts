import { API_CONFIG, IMAGE_UPLOAD_CONFIG, ERROR_MESSAGES } from '../../src/config/api';

describe('API Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('API_CONFIG', () => {
    it('should have correct default configuration', () => {
      expect(API_CONFIG).toMatchObject({
        TIMEOUT: 30000,
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000,
      });
    });

    it('should have a valid BASE_URL', () => {
      expect(API_CONFIG.BASE_URL).toBeDefined();
      expect(typeof API_CONFIG.BASE_URL).toBe('string');
      expect(API_CONFIG.BASE_URL).toMatch(/^https?:\/\//);
    });

    it('should have a boolean DEBUG flag', () => {
      expect(typeof API_CONFIG.DEBUG).toBe('boolean');
    });
  });

  describe('IMAGE_UPLOAD_CONFIG', () => {
    it('should have correct file size limit', () => {
      expect(IMAGE_UPLOAD_CONFIG.MAX_FILE_SIZE).toBe(5 * 1024 * 1024);
    });

    it('should have correct allowed file types', () => {
      expect(IMAGE_UPLOAD_CONFIG.ALLOWED_TYPES).toEqual([
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/webp'
      ]);
    });

    it('should have correct max images per task', () => {
      expect(IMAGE_UPLOAD_CONFIG.MAX_IMAGES_PER_TASK).toBe(5);
    });
  });

  describe('ERROR_MESSAGES', () => {
    it('should have all required error messages', () => {
      const expectedKeys = [
        'NETWORK_ERROR',
        'UPLOAD_FAILED',
        'INVALID_FILE_TYPE',
        'FILE_TOO_LARGE',
        'NO_FILE_SELECTED',
        'UNAUTHORIZED',
        'SERVER_ERROR'
      ];

      expectedKeys.forEach(key => {
        expect(ERROR_MESSAGES).toHaveProperty(key);
        expect(typeof ERROR_MESSAGES[key as keyof typeof ERROR_MESSAGES]).toBe('string');
        expect(ERROR_MESSAGES[key as keyof typeof ERROR_MESSAGES].length).toBeGreaterThan(0);
      });
    });

    it('should have user-friendly error messages', () => {
      expect(ERROR_MESSAGES.NETWORK_ERROR).toContain('Network error');
      expect(ERROR_MESSAGES.UPLOAD_FAILED).toContain('Failed to upload');
      expect(ERROR_MESSAGES.INVALID_FILE_TYPE).toContain('Invalid file type');
      expect(ERROR_MESSAGES.FILE_TOO_LARGE).toContain('File size too large');
      expect(ERROR_MESSAGES.NO_FILE_SELECTED).toContain('Please select');
      expect(ERROR_MESSAGES.UNAUTHORIZED).toContain('not authorized');
      expect(ERROR_MESSAGES.SERVER_ERROR).toContain('Server error');
    });
  });
});

describe('Configuration Integration', () => {
  it('should have consistent configuration structure', () => {
    // Test that API_CONFIG has all required properties
    expect(API_CONFIG).toHaveProperty('BASE_URL');
    expect(API_CONFIG).toHaveProperty('TIMEOUT');
    expect(API_CONFIG).toHaveProperty('RETRY_ATTEMPTS');
    expect(API_CONFIG).toHaveProperty('RETRY_DELAY');
    expect(API_CONFIG).toHaveProperty('DEBUG');
  });

  it('should have valid configuration values', () => {
    // Test that all configuration values are valid
    expect(API_CONFIG.TIMEOUT).toBeGreaterThan(0);
    expect(API_CONFIG.RETRY_ATTEMPTS).toBeGreaterThan(0);
    expect(API_CONFIG.RETRY_DELAY).toBeGreaterThan(0);
    expect(typeof API_CONFIG.DEBUG).toBe('boolean');
    expect(API_CONFIG.BASE_URL).toMatch(/^https?:\/\//);
  });
});
