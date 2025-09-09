import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('TaskImageUpload - Image Preview Modal', () => {
  const mockOnImageUpload = jest.fn();
  const mockOnImageDelete = jest.fn();
  const mockOnImageClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTaskImageUrl.mockResolvedValue('data:image/jpeg;base64,test-image-data');
  });

  it('should open image preview modal when image is clicked', async () => {
    const existingImages = [
      { id: 1, taskId: 1, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1000, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
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

    // Wait for image to load
    await waitFor(() => {
      expect(mockGetTaskImageUrl).toHaveBeenCalledWith(1);
    });

    // Find and click the image
    const imageElement = screen.getByAltText('Task reference');
    fireEvent.click(imageElement);

    // Check that modal is open
    await waitFor(() => {
      expect(screen.getByText('Task Reference Image')).toBeInTheDocument();
      expect(screen.getByText('ID: 1')).toBeInTheDocument();
    });
  });

  it('should close modal when close button is clicked', async () => {
    const existingImages = [
      { id: 1, taskId: 1, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1000, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
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

    // Wait for image to load
    await waitFor(() => {
      expect(mockGetTaskImageUrl).toHaveBeenCalledWith(1);
    });

    // Click image to open modal
    const imageElement = screen.getByAltText('Task reference');
    fireEvent.click(imageElement);

    // Wait for modal to open
    await waitFor(() => {
      expect(screen.getByText('Task Reference Image')).toBeInTheDocument();
    });

    // Click close button
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    // Modal should be closed
    await waitFor(() => {
      expect(screen.queryByText('Task Reference Image')).not.toBeInTheDocument();
    });
  });

  it('should close modal when ESC key is pressed', async () => {
    const user = userEvent.setup();
    const existingImages = [
      { id: 1, taskId: 1, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1000, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
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

    // Wait for image to load
    await waitFor(() => {
      expect(mockGetTaskImageUrl).toHaveBeenCalledWith(1);
    });

    // Click image to open modal
    const imageElement = screen.getByAltText('Task reference');
    await user.click(imageElement);

    // Wait for modal to open
    await waitFor(() => {
      expect(screen.getByText('Task Reference Image')).toBeInTheDocument();
    });

    // Press ESC key
    await user.keyboard('{Escape}');

    // Modal should be closed
    await waitFor(() => {
      expect(screen.queryByText('Task Reference Image')).not.toBeInTheDocument();
    });
  });

  it('should display image information correctly', async () => {
    const existingImages = [
      { id: 123, taskId: 1, filename: 'test-image.jpg', originalName: 'test-image.jpg', fileSize: 2048, mimeType: 'image/jpeg', filePath: '/test-image.jpg', isPrimary: true, createdAt: '2025-01-09' },
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

    // Wait for image to load
    await waitFor(() => {
      expect(mockGetTaskImageUrl).toHaveBeenCalledWith(123);
    });

    // Click image to open modal
    const imageElement = screen.getByAltText('Task reference');
    fireEvent.click(imageElement);

    // Check image information is displayed
    await waitFor(() => {
      expect(screen.getByText('Task Reference Image')).toBeInTheDocument();
      expect(screen.getByText('ID: 123')).toBeInTheDocument();
    });
  });

  it('should handle image loading errors in preview', async () => {
    const existingImages = [
      { id: 1, taskId: 1, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1000, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
    ];

    // Mock image to fail loading
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

    // Should show error state instead of image
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });

  it('should show loading state while image is loading', async () => {
    const existingImages = [
      { id: 1, taskId: 1, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1000, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
    ];

    // Mock slow loading
    mockGetTaskImageUrl.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve('data:image/jpeg;base64,test'), 100))
    );

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

    // Should show loading state initially
    expect(screen.getByRole('status')).toBeInTheDocument(); // Loader2 has role="status"
  });

  it('should display navigation hints', async () => {
    const existingImages = [
      { id: 1, taskId: 1, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1000, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
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

    // Wait for image to load
    await waitFor(() => {
      expect(mockGetTaskImageUrl).toHaveBeenCalledWith(1);
    });

    // Click image to open modal
    const imageElement = screen.getByAltText('Task reference');
    fireEvent.click(imageElement);

    // Check navigation hints are displayed
    await waitFor(() => {
      expect(screen.getByText(/Click outside or press ESC to close/i)).toBeInTheDocument();
    });
  });
});
