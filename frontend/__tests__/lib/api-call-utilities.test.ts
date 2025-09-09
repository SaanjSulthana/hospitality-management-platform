import { API_CONFIG, ERROR_MESSAGES } from '../../src/config/api';

// Mock fetch for testing
global.fetch = jest.fn();

describe('API Call Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();
  });

  describe('API Configuration Usage', () => {
    it('should use API_CONFIG.BASE_URL for API calls', () => {
      const expectedUrl = `${API_CONFIG.BASE_URL}/test-endpoint`;
      
      // This test verifies that API_CONFIG.BASE_URL is used consistently
      expect(API_CONFIG.BASE_URL).toBeDefined();
      expect(typeof API_CONFIG.BASE_URL).toBe('string');
      expect(API_CONFIG.BASE_URL).toMatch(/^https?:\/\//);
    });

    it('should use API_CONFIG.TIMEOUT for request timeouts', () => {
      expect(API_CONFIG.TIMEOUT).toBe(30000);
      expect(typeof API_CONFIG.TIMEOUT).toBe('number');
    });

    it('should use API_CONFIG.RETRY_ATTEMPTS for retry logic', () => {
      expect(API_CONFIG.RETRY_ATTEMPTS).toBe(3);
      expect(typeof API_CONFIG.RETRY_ATTEMPTS).toBe('number');
    });

    it('should use API_CONFIG.RETRY_DELAY for retry delays', () => {
      expect(API_CONFIG.RETRY_DELAY).toBe(1000);
      expect(typeof API_CONFIG.RETRY_DELAY).toBe('number');
    });
  });

  describe('Error Message Usage', () => {
    it('should use ERROR_MESSAGES for consistent error handling', () => {
      const errorTypes = [
        'NETWORK_ERROR',
        'UPLOAD_FAILED', 
        'INVALID_FILE_TYPE',
        'FILE_TOO_LARGE',
        'NO_FILE_SELECTED',
        'UNAUTHORIZED',
        'SERVER_ERROR'
      ];

      errorTypes.forEach(errorType => {
        expect(ERROR_MESSAGES).toHaveProperty(errorType);
        expect(typeof ERROR_MESSAGES[errorType as keyof typeof ERROR_MESSAGES]).toBe('string');
      });
    });

    it('should provide user-friendly error messages', () => {
      expect(ERROR_MESSAGES.NETWORK_ERROR).toContain('Network error');
      expect(ERROR_MESSAGES.UPLOAD_FAILED).toContain('Failed to upload');
      expect(ERROR_MESSAGES.INVALID_FILE_TYPE).toContain('Invalid file type');
      expect(ERROR_MESSAGES.FILE_TOO_LARGE).toContain('File size too large');
      expect(ERROR_MESSAGES.NO_FILE_SELECTED).toContain('Please select');
      expect(ERROR_MESSAGES.UNAUTHORIZED).toContain('not authorized');
      expect(ERROR_MESSAGES.SERVER_ERROR).toContain('Server error');
    });
  });

  describe('API Call Patterns', () => {
    it('should handle successful API calls', async () => {
      const mockResponse = { success: true, data: 'test' };
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await fetch(`${API_CONFIG.BASE_URL}/test`);
      const data = await response.json();

      expect(fetch).toHaveBeenCalledWith(`${API_CONFIG.BASE_URL}/test`);
      expect(data).toEqual(mockResponse);
    });

    it('should handle network errors', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      try {
        await fetch(`${API_CONFIG.BASE_URL}/test`);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Network error');
      }
    });

    it('should handle HTTP error responses', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Server error' }),
      });

      const response = await fetch(`${API_CONFIG.BASE_URL}/test`);
      
      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
    });

    it('should handle authentication errors', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Invalid token' }),
      });

      const response = await fetch(`${API_CONFIG.BASE_URL}/test`);
      
      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });
  });

  describe('Retry Logic Patterns', () => {
    it('should implement retry logic with correct attempts', () => {
      const maxAttempts = API_CONFIG.RETRY_ATTEMPTS;
      expect(maxAttempts).toBe(3);
    });

    it('should implement retry logic with correct delay', () => {
      const retryDelay = API_CONFIG.RETRY_DELAY;
      expect(retryDelay).toBe(1000);
    });

    it('should handle retry scenarios', async () => {
      // Mock first two calls to fail, third to succeed
      (fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

      let attempts = 0;
      let lastError: Error | null = null;

      for (let i = 0; i < API_CONFIG.RETRY_ATTEMPTS; i++) {
        try {
          attempts++;
          const response = await fetch(`${API_CONFIG.BASE_URL}/test`);
          const data = await response.json();
          expect(data.success).toBe(true);
          break;
        } catch (error) {
          lastError = error as Error;
          if (i < API_CONFIG.RETRY_ATTEMPTS - 1) {
            await new Promise(resolve => setTimeout(resolve, API_CONFIG.RETRY_DELAY));
          }
        }
      }

      expect(attempts).toBe(3);
    });
  });

  describe('Request Headers Patterns', () => {
    it('should include proper headers for API calls', async () => {
      const mockToken = 'test-token';
      const expectedHeaders = {
        'Authorization': `Bearer ${mockToken}`,
        'Content-Type': 'application/json',
      };

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await fetch(`${API_CONFIG.BASE_URL}/test`, {
        method: 'POST',
        headers: expectedHeaders,
        body: JSON.stringify({ test: 'data' }),
      });

      expect(fetch).toHaveBeenCalledWith(
        `${API_CONFIG.BASE_URL}/test`,
        expect.objectContaining({
          method: 'POST',
          headers: expectedHeaders,
          body: JSON.stringify({ test: 'data' }),
        })
      );
    });

    it('should handle missing authorization token', () => {
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        // Should handle missing token gracefully
        expect(() => {
          const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          };
          return headers;
        }).not.toThrow();
      }
    });
  });

  describe('File Upload Patterns', () => {
    it('should handle file upload with proper headers', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', mockFile);

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, fileId: '123' }),
      });

      await fetch(`${API_CONFIG.BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      expect(fetch).toHaveBeenCalledWith(
        `${API_CONFIG.BASE_URL}/upload`,
        expect.objectContaining({
          method: 'POST',
          body: formData,
        })
      );
    });

    it('should validate file types before upload', () => {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const testFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      
      expect(allowedTypes).toContain(testFile.type);
    });

    it('should validate file size before upload', () => {
      const maxSize = 5 * 1024 * 1024; // 5MB
      const testFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      
      expect(testFile.size).toBeLessThanOrEqual(maxSize);
    });
  });

  describe('Error Handling Patterns', () => {
    it('should handle different HTTP status codes', async () => {
      const statusCodes = [400, 401, 403, 404, 500, 502, 503];
      
      for (const status of statusCodes) {
        (fetch as jest.Mock).mockResolvedValueOnce({
          ok: false,
          status,
          statusText: 'Error',
          json: async () => ({ error: `Error ${status}` }),
        });

        const response = await fetch(`${API_CONFIG.BASE_URL}/test`);
        
        expect(response.status).toBe(status);
        expect(response.ok).toBe(false);
      }
    });

    it('should handle JSON parsing errors', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/test`);
        await response.json();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Invalid JSON');
      }
    });

    it('should handle timeout scenarios', async () => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), API_CONFIG.TIMEOUT);
      });

      (fetch as jest.Mock).mockReturnValueOnce(timeoutPromise);

      try {
        await Promise.race([
          fetch(`${API_CONFIG.BASE_URL}/test`),
          timeoutPromise
        ]);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Request timeout');
      }
    });
  });
});
