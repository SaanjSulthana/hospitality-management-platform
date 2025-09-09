import { ApiClient, ApiError } from '../../src/utils/api-client';
import { API_CONFIG } from '../../src/config/api';

// Mock fetch
global.fetch = jest.fn();

describe('ApiClient', () => {
  let apiClient: ApiClient;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    apiClient = new ApiClient();
    mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    jest.clearAllMocks();
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => 'mock-token'),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    });
  });

  describe('constructor', () => {
    it('should use default configuration', () => {
      const client = new ApiClient();
      expect(client).toBeInstanceOf(ApiClient);
    });

    it('should use custom configuration', () => {
      const customClient = new ApiClient(
        'https://custom-api.com',
        60000,
        5,
        2000
      );
      expect(customClient).toBeInstanceOf(ApiClient);
    });
  });

  describe('request method', () => {
    it('should make successful GET request', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValue({ data: 'test' }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const result = await apiClient.request('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_CONFIG.BASE_URL}/test`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token',
          }),
        })
      );

      expect(result).toEqual({
        data: { data: 'test' },
        status: 200,
        statusText: 'OK',
        headers: mockResponse.headers,
      });
    });

    it('should make successful POST request with body', async () => {
      const mockResponse = {
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValue({ id: 1 }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const result = await apiClient.request('/test', {
        method: 'POST',
        body: { name: 'test' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_CONFIG.BASE_URL}/test`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'test' }),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token',
          }),
        })
      );

      expect(result.data).toEqual({ id: 1 });
    });

    it('should handle FormData requests', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValue({ success: true }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const formData = new FormData();
      formData.append('file', new File(['test'], 'test.txt'));

      const result = await apiClient.request('/upload', {
        method: 'POST',
        body: formData,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_CONFIG.BASE_URL}/upload`,
        expect.objectContaining({
          method: 'POST',
          body: formData,
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
          }),
        })
      );

      // Should not have Content-Type header for FormData
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.not.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should handle HTTP error responses', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValue({ error: 'Resource not found' }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await expect(apiClient.request('/test')).rejects.toThrow(ApiError);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(apiClient.request('/test')).rejects.toThrow('Network error');
    });

    it('should retry on network errors', async () => {
      // First call fails, second succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: jest.fn().mockResolvedValue({ data: 'success' }),
        } as any);

      const result = await apiClient.request('/test', { retryAttempts: 1 });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.data).toEqual({ data: 'success' });
    });

    it('should not retry on client errors', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValue({ error: 'Bad request' }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await expect(apiClient.request('/test')).rejects.toThrow(ApiError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle timeout', async () => {
      // Mock AbortController
      const mockAbortController = {
        abort: jest.fn(),
        signal: {} as AbortSignal,
      };
      
      global.AbortController = jest.fn(() => mockAbortController) as any;
      global.setTimeout = jest.fn((callback) => {
        callback();
        return 1 as any;
      }) as any;

      mockFetch.mockRejectedValueOnce(new Error('AbortError'));

      await expect(apiClient.request('/test', { timeout: 1000 })).rejects.toThrow(ApiError);
    });
  });

  describe('convenience methods', () => {
    beforeEach(() => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValue({ data: 'test' }),
      };

      mockFetch.mockResolvedValue(mockResponse as any);
    });

    it('should make GET request', async () => {
      await apiClient.get('/test');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should make POST request', async () => {
      await apiClient.post('/test', { data: 'test' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ 
          method: 'POST',
          body: JSON.stringify({ data: 'test' })
        })
      );
    });

    it('should make PUT request', async () => {
      await apiClient.put('/test', { data: 'test' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ 
          method: 'PUT',
          body: JSON.stringify({ data: 'test' })
        })
      );
    });

    it('should make PATCH request', async () => {
      await apiClient.patch('/test', { data: 'test' });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ 
          method: 'PATCH',
          body: JSON.stringify({ data: 'test' })
        })
      );
    });

    it('should make DELETE request', async () => {
      await apiClient.delete('/test');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('file upload', () => {
    it('should upload file successfully', async () => {
      const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValue({ fileId: '123' }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const result = await apiClient.uploadFile('/upload', mockFile);

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_CONFIG.BASE_URL}/upload`,
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
          }),
        })
      );

      expect(result.data).toEqual({ fileId: '123' });
    });

    it('should handle upload errors', async () => {
      const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const mockResponse = {
        ok: false,
        status: 413,
        statusText: 'Payload Too Large',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: jest.fn().mockResolvedValue({ error: 'File too large' }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as any);

      await expect(apiClient.uploadFile('/upload', mockFile)).rejects.toThrow(ApiError);
    });
  });

  describe('error handling', () => {
    it('should create ApiError with correct properties', () => {
      const error = new ApiError('Test error', 404, 'Not Found');
      
      expect(error.message).toBe('Test error');
      expect(error.status).toBe(404);
      expect(error.statusText).toBe('Not Found');
      expect(error.name).toBe('ApiError');
    });

    it('should handle different content types', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: jest.fn().mockResolvedValue('plain text response'),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const result = await apiClient.request('/test');
      expect(result.data).toBe('plain text response');
    });

    it('should handle blob responses', async () => {
      const mockBlob = new Blob(['binary data'], { type: 'application/pdf' });
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/pdf' }),
        blob: jest.fn().mockResolvedValue(mockBlob),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as any);

      const result = await apiClient.request('/test');
      expect(result.data).toBe(mockBlob);
    });
  });
});
