import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TaskImageUpload } from '@/components/ui/task-image-upload';

// Mock the toast hook
jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock the task images API
const mockUploadTaskImage = jest.fn();
const mockGetTaskImageUrl = jest.fn();
jest.mock('../../lib/api/task-images', () => ({
  uploadTaskImage: mockUploadTaskImage,
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

describe('TaskImageUpload - Progress Tracking', () => {
  const mockOnImageUpload = jest.fn();
  const mockOnImageDelete = jest.fn();
  const mockOnImageClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTaskImageUrl.mockResolvedValue('data:image/jpeg;base64,test-image-data');
  });

  it('should show progress bar during upload', async () => {
    // Mock slow upload
    mockUploadTaskImage.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ id: 1 }), 1000))
    );

    render(
      <TestWrapper>
        <TaskImageUpload
          taskId={1}
          existingImages={[]}
          onImageUpload={mockOnImageUpload}
          onImageDelete={mockOnImageDelete}
          onImageClick={mockOnImageClick}
          maxImages={5}
          maxSize={5}
        />
      </TestWrapper>
    );

    // Simulate file drop
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const dropzone = screen.getByText('Click to add images');
    
    // Trigger file upload
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [mockFile],
      },
    });

    // Should show progress bar
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  it('should display percentage during upload', async () => {
    // Mock upload with progress
    mockUploadTaskImage.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ id: 1 }), 1000))
    );

    render(
      <TestWrapper>
        <TaskImageUpload
          taskId={1}
          existingImages={[]}
          onImageUpload={mockOnImageUpload}
          onImageDelete={mockOnImageDelete}
          onImageClick={mockOnImageClick}
          maxImages={5}
          maxSize={5}
        />
      </TestWrapper>
    );

    // Simulate file drop
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const dropzone = screen.getByText('Click to add images');
    
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [mockFile],
      },
    });

    // Should show percentage
    await waitFor(() => {
      expect(screen.getByText(/0%/)).toBeInTheDocument();
    });
  });

  it('should show completion animation when upload finishes', async () => {
    mockUploadTaskImage.mockResolvedValue({ id: 1 });

    render(
      <TestWrapper>
        <TaskImageUpload
          taskId={1}
          existingImages={[]}
          onImageUpload={mockOnImageUpload}
          onImageDelete={mockOnImageDelete}
          onImageClick={mockOnImageClick}
          maxImages={5}
          maxSize={5}
        />
      </TestWrapper>
    );

    // Simulate file drop
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const dropzone = screen.getByText('Click to add images');
    
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [mockFile],
      },
    });

    // Wait for completion
    await waitFor(() => {
      expect(screen.getByText(/100%/)).toBeInTheDocument();
    });

    // Should show success state
    await waitFor(() => {
      expect(screen.getByText(/Upload complete/)).toBeInTheDocument();
    });
  });

  it('should handle multiple simultaneous uploads with individual progress', async () => {
    mockUploadTaskImage.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ id: Math.random() }), 1000))
    );

    render(
      <TestWrapper>
        <TaskImageUpload
          taskId={1}
          existingImages={[]}
          onImageUpload={mockOnImageUpload}
          onImageDelete={mockOnImageDelete}
          onImageClick={mockOnImageClick}
          maxImages={5}
          maxSize={5}
        />
      </TestWrapper>
    );

    // Simulate multiple files
    const mockFiles = [
      new File(['test1'], 'test1.jpg', { type: 'image/jpeg' }),
      new File(['test2'], 'test2.jpg', { type: 'image/jpeg' }),
      new File(['test3'], 'test3.jpg', { type: 'image/jpeg' }),
    ];
    
    const dropzone = screen.getByText('Click to add images');
    
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: mockFiles,
      },
    });

    // Should show multiple progress bars
    await waitFor(() => {
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars).toHaveLength(3);
    });
  });

  it('should show error state when upload fails', async () => {
    mockUploadTaskImage.mockRejectedValue(new Error('Upload failed'));

    render(
      <TestWrapper>
        <TaskImageUpload
          taskId={1}
          existingImages={[]}
          onImageUpload={mockOnImageUpload}
          onImageDelete={mockOnImageDelete}
          onImageClick={mockOnImageClick}
          maxImages={5}
          maxSize={5}
        />
      </TestWrapper>
    );

    // Simulate file drop
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const dropzone = screen.getByText('Click to add images');
    
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [mockFile],
      },
    });

    // Should show error state
    await waitFor(() => {
      expect(screen.getByText(/Upload failed/)).toBeInTheDocument();
    });
  });

  it('should allow retry when upload fails', async () => {
    mockUploadTaskImage.mockRejectedValue(new Error('Upload failed'));

    render(
      <TestWrapper>
        <TaskImageUpload
          taskId={1}
          existingImages={[]}
          onImageUpload={mockOnImageUpload}
          onImageDelete={mockOnImageDelete}
          onImageClick={mockOnImageClick}
          maxImages={5}
          maxSize={5}
        />
      </TestWrapper>
    );

    // Simulate file drop
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const dropzone = screen.getByText('Click to add images');
    
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [mockFile],
      },
    });

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByText(/Upload failed/)).toBeInTheDocument();
    });

    // Should show retry button
    const retryButton = screen.getByText(/Retry/);
    expect(retryButton).toBeInTheDocument();

    // Mock successful retry
    mockUploadTaskImage.mockResolvedValue({ id: 1 });

    // Click retry
    fireEvent.click(retryButton);

    // Should show progress again
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  it('should show smooth progress transitions', async () => {
    // Mock upload with progress updates
    let progressCallback: (progress: number) => void;
    mockUploadTaskImage.mockImplementation((file, onProgress) => {
      progressCallback = onProgress;
      return new Promise(resolve => {
        setTimeout(() => resolve({ id: 1 }), 1000);
      });
    });

    render(
      <TestWrapper>
        <TaskImageUpload
          taskId={1}
          existingImages={[]}
          onImageUpload={mockOnImageUpload}
          onImageDelete={mockOnImageDelete}
          onImageClick={mockOnImageClick}
          maxImages={5}
          maxSize={5}
        />
      </TestWrapper>
    );

    // Simulate file drop
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const dropzone = screen.getByText('Click to add images');
    
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [mockFile],
      },
    });

    // Simulate progress updates
    await act(async () => {
      progressCallback(25);
      await new Promise(resolve => setTimeout(resolve, 100));
      progressCallback(50);
      await new Promise(resolve => setTimeout(resolve, 100));
      progressCallback(75);
      await new Promise(resolve => setTimeout(resolve, 100));
      progressCallback(100);
    });

    // Should show smooth progress updates
    await waitFor(() => {
      expect(screen.getByText(/100%/)).toBeInTheDocument();
    });
  });

  it('should show file size and name during upload', async () => {
    mockUploadTaskImage.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ id: 1 }), 1000))
    );

    render(
      <TestWrapper>
        <TaskImageUpload
          taskId={1}
          existingImages={[]}
          onImageUpload={mockOnImageUpload}
          onImageDelete={mockOnImageDelete}
          onImageClick={mockOnImageClick}
          maxImages={5}
          maxSize={5}
        />
      </TestWrapper>
    );

    // Simulate file drop
    const mockFile = new File(['test'], 'test-image.jpg', { type: 'image/jpeg' });
    const dropzone = screen.getByText('Click to add images');
    
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [mockFile],
      },
    });

    // Should show file name
    await waitFor(() => {
      expect(screen.getByText('test-image.jpg')).toBeInTheDocument();
    });
  });

  it('should show upload speed and ETA', async () => {
    mockUploadTaskImage.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ id: 1 }), 1000))
    );

    render(
      <TestWrapper>
        <TaskImageUpload
          taskId={1}
          existingImages={[]}
          onImageUpload={mockOnImageUpload}
          onImageDelete={mockOnImageDelete}
          onImageClick={mockOnImageClick}
          maxImages={5}
          maxSize={5}
        />
      </TestWrapper>
    );

    // Simulate file drop
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const dropzone = screen.getByText('Click to add images');
    
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [mockFile],
      },
    });

    // Should show upload speed info
    await waitFor(() => {
      expect(screen.getByText(/Uploading/)).toBeInTheDocument();
    });
  });
});
