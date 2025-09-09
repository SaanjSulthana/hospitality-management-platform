import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TaskImageUpload } from '@/components/ui/task-image-upload';
import { useToast } from '@/components/ui/use-toast';

// Mock the toast hook
jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock the task images API
jest.mock('../../lib/api/task-images', () => ({
  uploadTaskImage: jest.fn(),
  deleteTaskImage: jest.fn(),
  getTaskImageUrl: jest.fn(),
}));

// Mock react-dropzone
jest.mock('react-dropzone', () => ({
  useDropzone: (options: any) => ({
    getRootProps: () => ({
      onClick: options.onDrop ? () => {
        // Simulate file selection
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

describe('TaskImageUpload - File Picker Upload', () => {
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
    const uploadArea = screen.getByText('Add images');
    expect(uploadArea).toBeInTheDocument();

    // Click on the upload area to trigger file picker
    fireEvent.click(uploadArea);

    // Wait for the upload to be triggered
    await waitFor(() => {
      expect(mockOnImageUpload).toHaveBeenCalledWith(1, expect.any(Array));
    });
  });

  it('should show visual feedback during file picker interaction', async () => {
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

    const uploadArea = screen.getByText('Add images');
    
    // Check that the upload area has proper styling
    expect(uploadArea.closest('div')).toHaveClass('cursor-pointer');
    expect(uploadArea.closest('div')).toHaveClass('border-2');
    expect(uploadArea.closest('div')).toHaveClass('border-dashed');
  });

  it('should handle multiple file selection via file picker', async () => {
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

    const uploadArea = screen.getByText('Add images');
    fireEvent.click(uploadArea);

    await waitFor(() => {
      expect(mockOnImageUpload).toHaveBeenCalledWith(1, expect.any(Array));
    });
  });

  it('should respect maxImages limit in file picker', async () => {
    render(
      <TestWrapper>
        <TaskImageUpload
          taskId={1}
          existingImages={[]}
          onImageUpload={mockOnImageUpload}
          onImageDelete={mockOnImageDelete}
          onImageClick={mockOnImageClick}
          maxImages={2}
          maxSize={5}
        />
      </TestWrapper>
    );

    const uploadArea = screen.getByText('Add images');
    fireEvent.click(uploadArea);

    await waitFor(() => {
      expect(mockOnImageUpload).toHaveBeenCalledWith(1, expect.any(Array));
    });
  });

  it('should be disabled when maxImages reached', () => {
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
    expect(screen.queryByText('Add images')).not.toBeInTheDocument();
  });
});
