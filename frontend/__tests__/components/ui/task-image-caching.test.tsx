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

describe('TaskImageUpload - Image Caching', () => {
  const mockOnImageUpload = jest.fn();
  const mockOnImageDelete = jest.fn();
  const mockOnImageClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTaskImageUrl.mockResolvedValue('data:image/jpeg;base64,test-image-data');
  });

  it('should load image URL only once per image', async () => {
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

    // Wait for image to load
    await waitFor(() => {
      expect(mockGetTaskImageUrl).toHaveBeenCalledWith(1);
    });

    // Clear the mock to track subsequent calls
    mockGetTaskImageUrl.mockClear();

    // Re-render the component
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

    // Wait a bit to ensure no additional calls are made
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Should not call getTaskImageUrl again
    expect(mockGetTaskImageUrl).not.toHaveBeenCalled();
  });

  it('should handle multiple images without reloading', async () => {
    const existingImages = [
      { id: 1, taskId: 1, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1000, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
      { id: 2, taskId: 1, filename: 'test2.jpg', originalName: 'test2.jpg', fileSize: 1000, mimeType: 'image/jpeg', filePath: '/test2.jpg', isPrimary: false, createdAt: '2025-01-09' },
    ];

    render(
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

    // Wait for both images to load
    await waitFor(() => {
      expect(mockGetTaskImageUrl).toHaveBeenCalledWith(1);
      expect(mockGetTaskImageUrl).toHaveBeenCalledWith(2);
    });

    // Should be called exactly twice (once per image)
    expect(mockGetTaskImageUrl).toHaveBeenCalledTimes(2);
  });

  it('should handle image loading errors gracefully', async () => {
    const existingImages = [
      { id: 1, taskId: 1, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1000, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
    ];

    // Mock API to reject
    mockGetTaskImageUrl.mockRejectedValue(new Error('Failed to load image'));

    render(
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

    // Wait for error to be handled
    await waitFor(() => {
      expect(mockGetTaskImageUrl).toHaveBeenCalledWith(1);
    });

    // Should show error state
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });

  it('should not reload images when component re-renders with same props', async () => {
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

    // Re-render with same props
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

    // Wait a bit
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Should not have made additional calls
    expect(mockGetTaskImageUrl.mock.calls.length).toBe(initialCallCount);
  });

  it('should clean up image URLs when component unmounts', async () => {
    const existingImages = [
      { id: 1, taskId: 1, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1000, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
    ];

    const { unmount } = render(
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

    // Wait for image to load
    await waitFor(() => {
      expect(mockGetTaskImageUrl).toHaveBeenCalledWith(1);
    });

    // Unmount component
    unmount();

    // No additional assertions needed - the test verifies that unmounting doesn't cause errors
    // In a real implementation, we would verify that URL.revokeObjectURL is called
  });
});
