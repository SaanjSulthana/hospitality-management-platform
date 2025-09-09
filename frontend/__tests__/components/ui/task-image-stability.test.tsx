import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TaskImageUpload } from '@/components/ui/task-image-upload';

// Mock the toast hook
jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock the task images API
const mockGetTaskImageUrl = jest.fn();
jest.mock('../../lib/api/task-images', () => ({
  uploadTaskImage: jest.fn(),
  deleteTaskImage: jest.fn(),
  getTaskImageUrl: mockGetTaskImageUrl,
}));

// Mock react-dropzone
jest.mock('react-dropzone', () => ({
  useDropzone: () => ({
    getRootProps: () => ({}),
    getInputProps: () => ({}),
    isDragActive: false,
    open: jest.fn(),
  }),
}));

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('TaskImageUpload - Image Stability', () => {
  const mockOnImageUpload = jest.fn();
  const mockOnImageDelete = jest.fn();
  const mockOnImageClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTaskImageUrl.mockResolvedValue('data:image/jpeg;base64,test-image-data');
  });

  it('should maintain image stability across multiple re-renders', async () => {
    const existingImages = [
      { id: 1, taskId: 1, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1000, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
    ];

    const { rerender } = render(
      <TestWrapper>
        <TaskImageUpload
          taskId={1}
          existingImages={existingImages}
          onImageUpload={mockOnImageUpload}
          onImageDelete={mockOnImageDelete}
          onImageClick={mockOnImageClick}
          maxImages={5}
          maxSize={5}
        />
      </TestWrapper>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(mockGetTaskImageUrl).toHaveBeenCalledWith(1);
    });

    const initialCallCount = mockGetTaskImageUrl.mock.calls.length;

    // Re-render multiple times with same props
    for (let i = 0; i < 5; i++) {
      rerender(
        <TestWrapper>
          <TaskImageUpload
            taskId={1}
            existingImages={existingImages}
            onImageUpload={mockOnImageUpload}
            onImageDelete={mockOnImageDelete}
            onImageClick={mockOnImageClick}
            maxImages={5}
            maxSize={5}
          />
        </TestWrapper>
      );
      
      // Wait a bit between re-renders
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });
    }

    // Should not have made additional API calls
    expect(mockGetTaskImageUrl.mock.calls.length).toBe(initialCallCount);
  });

  it('should handle prop changes without unnecessary reloads', async () => {
    const existingImages = [
      { id: 1, taskId: 1, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1000, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
    ];

    const { rerender } = render(
      <TestWrapper>
        <TaskImageUpload
          taskId={1}
          existingImages={existingImages}
          onImageUpload={mockOnImageUpload}
          onImageDelete={mockOnImageDelete}
          onImageClick={mockOnImageClick}
          maxImages={5}
          maxSize={5}
        />
      </TestWrapper>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(mockGetTaskImageUrl).toHaveBeenCalledWith(1);
    });

    const initialCallCount = mockGetTaskImageUrl.mock.calls.length;

    // Change non-image related props
    rerender(
      <TestWrapper>
        <TaskImageUpload
          taskId={1}
          existingImages={existingImages}
          onImageUpload={mockOnImageUpload}
          onImageDelete={mockOnImageDelete}
          onImageClick={mockOnImageClick}
          maxImages={3} // Changed from 5 to 3
          maxSize={10} // Changed from 5 to 10
        />
      </TestWrapper>
    );

    // Wait a bit
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Should not have made additional API calls for the same image
    expect(mockGetTaskImageUrl.mock.calls.length).toBe(initialCallCount);
  });

  it('should handle rapid prop changes gracefully', async () => {
    const existingImages = [
      { id: 1, taskId: 1, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1000, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
    ];

    const { rerender } = render(
      <TestWrapper>
        <TaskImageUpload
          taskId={1}
          existingImages={existingImages}
          onImageUpload={mockOnImageUpload}
          onImageDelete={mockOnImageDelete}
          onImageClick={mockOnImageClick}
          maxImages={5}
          maxSize={5}
        />
      </TestWrapper>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(mockGetTaskImageUrl).toHaveBeenCalledWith(1);
    });

    const initialCallCount = mockGetTaskImageUrl.mock.calls.length;

    // Rapid re-renders
    for (let i = 0; i < 10; i++) {
      rerender(
        <TestWrapper>
          <TaskImageUpload
            taskId={1}
            existingImages={existingImages}
            onImageUpload={mockOnImageUpload}
            onImageDelete={mockOnImageDelete}
            onImageClick={mockOnImageClick}
            maxImages={5}
            maxSize={5}
          />
        </TestWrapper>
      );
    }

    // Wait for all renders to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Should not have made additional API calls
    expect(mockGetTaskImageUrl.mock.calls.length).toBe(initialCallCount);
  });

  it('should handle component unmount and remount correctly', async () => {
    const existingImages = [
      { id: 1, taskId: 1, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1000, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
    ];

    const { unmount, rerender } = render(
      <TestWrapper>
        <TaskImageUpload
          taskId={1}
          existingImages={existingImages}
          onImageUpload={mockOnImageUpload}
          onImageDelete={mockOnImageDelete}
          onImageClick={mockOnImageClick}
          maxImages={5}
          maxSize={5}
        />
      </TestWrapper>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(mockGetTaskImageUrl).toHaveBeenCalledWith(1);
    });

    const initialCallCount = mockGetTaskImageUrl.mock.calls.length;

    // Unmount component
    unmount();

    // Wait a bit
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Remount component
    rerender(
      <TestWrapper>
        <TaskImageUpload
          taskId={1}
          existingImages={existingImages}
          onImageUpload={mockOnImageUpload}
          onImageDelete={mockOnImageDelete}
          onImageClick={mockOnImageClick}
          maxImages={5}
          maxSize={5}
        />
      </TestWrapper>
    );

    // Wait for remount
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Should use cached image, not make new API call
    expect(mockGetTaskImageUrl.mock.calls.length).toBe(initialCallCount);
  });
});
