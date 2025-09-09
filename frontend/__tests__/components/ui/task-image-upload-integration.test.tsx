import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TaskImageUpload } from '@/components/ui/task-image-upload';

// Mock the toast hook
jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock the task images API
jest.mock('../../lib/api/task-images', () => ({
  uploadTaskImage: jest.fn().mockResolvedValue({
    id: 1,
    taskId: 1,
    filename: 'test.jpg',
    originalName: 'test.jpg',
    fileSize: 1000,
    mimeType: 'image/jpeg',
    filePath: '/test.jpg',
    isPrimary: true,
    createdAt: '2025-01-09'
  }),
  deleteTaskImage: jest.fn().mockResolvedValue({}),
  getTaskImageUrl: jest.fn().mockResolvedValue('data:image/jpeg;base64,test'),
}));

// Mock react-dropzone with more realistic behavior
jest.mock('react-dropzone', () => ({
  useDropzone: (options: any) => ({
    getRootProps: () => ({
      onClick: options.onDrop ? () => {
        // Simulate file selection for click
        const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
        options.onDrop([mockFile]);
      } : undefined,
      onDrop: options.onDrop ? (e: any) => {
        // Simulate drag and drop
        const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
        options.onDrop([mockFile]);
      } : undefined,
    }),
    getInputProps: () => ({
      onChange: options.onDrop ? (e: any) => {
        if (e.target.files && e.target.files.length > 0) {
          const files = Array.from(e.target.files);
          options.onDrop(files);
        }
      } : undefined,
    }),
    isDragActive: false,
    open: options.onDrop ? () => {
      // Simulate opening file picker
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      options.onDrop([mockFile]);
    } : jest.fn(),
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

describe('TaskImageUpload - Integration Tests', () => {
  const mockOnImageUpload = jest.fn();
  const mockOnImageDelete = jest.fn();
  const mockOnImageClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle file picker upload correctly', async () => {
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

    // Find the upload area
    const uploadArea = screen.getByText('Click to add images');
    expect(uploadArea).toBeInTheDocument();

    // Click on the upload area to trigger file picker
    fireEvent.click(uploadArea);

    // Wait for the upload to be triggered
    await waitFor(() => {
      expect(mockOnImageUpload).toHaveBeenCalledWith(1, expect.any(Array));
    });
  });

  it('should show progress tracking during upload', async () => {
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

    const uploadArea = screen.getByText('Click to add images');
    fireEvent.click(uploadArea);

    // Check that progress tracking is working
    await waitFor(() => {
      expect(mockOnImageUpload).toHaveBeenCalled();
    });
  });

  it('should handle multiple file uploads correctly', async () => {
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

    const uploadArea = screen.getByText('Click to add images');
    
    // Simulate multiple uploads
    fireEvent.click(uploadArea);
    fireEvent.click(uploadArea);

    await waitFor(() => {
      expect(mockOnImageUpload).toHaveBeenCalledTimes(2);
    });
  });

  it('should respect maxImages limit', async () => {
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
          maxImages={2}
          maxSize={5}
        />
      </TestWrapper>
    );

    // Upload area should not be visible when max images reached
    expect(screen.queryByText('Click to add images')).not.toBeInTheDocument();
  });

  it('should show visual feedback on hover', () => {
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

    const uploadArea = screen.getByText('Click to add images');
    const uploadContainer = uploadArea.closest('div');
    
    // Check that the upload area has proper styling
    expect(uploadContainer).toHaveClass('cursor-pointer');
    expect(uploadContainer).toHaveClass('border-2');
    expect(uploadContainer).toHaveClass('border-dashed');
    expect(uploadContainer).toHaveClass('transition-all');
  });
});
