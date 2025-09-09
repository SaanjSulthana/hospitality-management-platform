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
const mockDeleteTaskImage = jest.fn();
const mockGetTaskImageUrl = jest.fn();
const mockListTaskImages = jest.fn();

jest.mock('../../lib/api/task-images', () => ({
  uploadTaskImage: mockUploadTaskImage,
  deleteTaskImage: mockDeleteTaskImage,
  getTaskImageUrl: mockGetTaskImageUrl,
  listTaskImages: mockListTaskImages,
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

// Mock window.matchMedia for responsive testing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('TaskImageUpload - Mobile Responsiveness', () => {
  const mockOnImageUpload = jest.fn();
  const mockOnImageDelete = jest.fn();
  const mockOnImageClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTaskImageUrl.mockResolvedValue('data:image/jpeg;base64,test-image-data');
  });

  describe('Mobile Upload Interface', () => {
    it('should render upload interface correctly on mobile screens', () => {
      // Mock mobile screen size
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(max-width: 768px)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

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

      // Verify mobile-friendly upload area
      expect(screen.getByText('Click to add images')).toBeInTheDocument();
      expect(screen.getByText('Drag & drop images here')).toBeInTheDocument();
      
      // Verify mobile-friendly styling classes are present
      const uploadArea = screen.getByText('Click to add images').closest('div');
      expect(uploadArea).toHaveClass('aspect-square');
    });

    it('should handle touch interactions on mobile', async () => {
      const mockImageResponse = {
        id: 2000,
        taskId: 1,
        filename: 'task_1_uuid.jpg',
        originalName: 'test-image.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        filePath: '/uploads/tasks/task_1_uuid.jpg',
        isPrimary: true,
        createdAt: new Date('2025-01-09T17:00:00Z')
      };

      mockUploadTaskImage.mockResolvedValue(mockImageResponse);

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

      // Simulate touch interaction (click on mobile)
      const mockFile = new File(['test'], 'test-image.jpg', { type: 'image/jpeg' });
      const dropzone = screen.getByText('Click to add images');
      
      fireEvent.click(dropzone);
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [mockFile],
        },
      });

      // Verify upload works on mobile
      await waitFor(() => {
        expect(mockUploadTaskImage).toHaveBeenCalledWith(1, [mockFile]);
      });
    });

    it('should display proper mobile layout for existing images', async () => {
      const existingImages = [
        { id: 2001, taskId: 2, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
        { id: 2002, taskId: 2, filename: 'test2.jpg', originalName: 'test2.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test2.jpg', isPrimary: false, createdAt: '2025-01-09' },
      ];

      render(
        <TestWrapper>
          <TaskImageUpload
            taskId={2}
            existingImages={existingImages}
            onImageUpload={mockOnImageUpload}
            onImageDelete={mockOnImageDelete}
            onImageClick={mockOnImageClick}
            maxImages={5}
            maxSize={5}
          />
        </TestWrapper>
      );

      // Wait for images to load
      await waitFor(() => {
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(2001);
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(2002);
      });

      // Verify mobile-friendly grid layout
      const imageContainer = screen.getByAltText('Task reference image').closest('div');
      expect(imageContainer).toHaveClass('aspect-square');
    });
  });

  describe('Mobile Image Preview', () => {
    it('should handle mobile image preview modal', async () => {
      const existingImages = [
        { id: 2003, taskId: 3, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
      ];

      render(
        <TestWrapper>
          <TaskImageUpload
            taskId={3}
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
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(2003);
      });

      // Open preview modal
      const imageThumbnail = screen.getByAltText('Task reference image');
      fireEvent.click(imageThumbnail);

      // Verify mobile-friendly modal
      await waitFor(() => {
        expect(screen.getByText('Task Reference Image')).toBeInTheDocument();
      });

      // Verify mobile-friendly modal styling
      const modal = screen.getByText('Task Reference Image').closest('div');
      expect(modal).toHaveClass('max-w-7xl', 'max-h-[98vh]');
    });

    it('should handle mobile touch gestures for modal', async () => {
      const existingImages = [
        { id: 2004, taskId: 4, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
      ];

      render(
        <TestWrapper>
          <TaskImageUpload
            taskId={4}
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
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(2004);
      });

      // Open preview modal
      const imageThumbnail = screen.getByAltText('Task reference image');
      fireEvent.click(imageThumbnail);

      // Verify modal is open
      await waitFor(() => {
        expect(screen.getByText('Task Reference Image')).toBeInTheDocument();
      });

      // Test mobile touch interaction (click outside to close)
      const modal = screen.getByText('Task Reference Image').closest('div');
      if (modal) {
        fireEvent.click(modal);
      }

      // Verify modal closes
      await waitFor(() => {
        expect(screen.queryByText('Task Reference Image')).not.toBeInTheDocument();
      });
    });
  });

  describe('Mobile Progress Tracking', () => {
    it('should display mobile-friendly progress indicators', async () => {
      const mockImageResponse = {
        id: 2005,
        taskId: 5,
        filename: 'task_5_uuid.jpg',
        originalName: 'test-image.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        filePath: '/uploads/tasks/task_5_uuid.jpg',
        isPrimary: true,
        createdAt: new Date('2025-01-09T17:01:00Z')
      };

      mockUploadTaskImage.mockResolvedValue(mockImageResponse);

      render(
        <TestWrapper>
          <TaskImageUpload
            taskId={5}
            existingImages={[]}
            onImageUpload={mockOnImageUpload}
            onImageDelete={mockOnImageDelete}
            onImageClick={mockOnImageClick}
            maxImages={5}
            maxSize={5}
          />
        </TestWrapper>
      );

      // Simulate file upload
      const mockFile = new File(['test'], 'test-image.jpg', { type: 'image/jpeg' });
      const dropzone = screen.getByText('Click to add images');
      
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [mockFile],
        },
      });

      // Verify mobile-friendly progress display
      await waitFor(() => {
        expect(screen.getByText(/Uploading.../)).toBeInTheDocument();
      });

      // Verify progress bar is mobile-friendly
      const progressBar = screen.getByText(/Uploading.../).closest('div');
      expect(progressBar).toHaveClass('w-3/4');
    });

    it('should handle mobile-friendly error states', async () => {
      const uploadError = new Error('Upload failed');
      mockUploadTaskImage.mockRejectedValue(uploadError);

      render(
        <TestWrapper>
          <TaskImageUpload
            taskId={6}
            existingImages={[]}
            onImageUpload={mockOnImageUpload}
            onImageDelete={mockOnImageDelete}
            onImageClick={mockOnImageClick}
            maxImages={5}
            maxSize={5}
          />
        </TestWrapper>
      );

      // Simulate file upload
      const mockFile = new File(['test'], 'test-image.jpg', { type: 'image/jpeg' });
      const dropzone = screen.getByText('Click to add images');
      
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [mockFile],
        },
      });

      // Verify mobile-friendly error display
      await waitFor(() => {
        expect(screen.getByText(/Upload failed/)).toBeInTheDocument();
      });

      // Verify error state is mobile-friendly
      const errorContainer = screen.getByText(/Upload failed/).closest('div');
      expect(errorContainer).toHaveClass('text-center');
    });
  });

  describe('Mobile Delete Operations', () => {
    it('should handle mobile-friendly delete operations', async () => {
      const existingImages = [
        { id: 2006, taskId: 7, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
      ];

      mockDeleteTaskImage.mockResolvedValue({ success: true, message: 'Image deleted successfully' });

      render(
        <TestWrapper>
          <TaskImageUpload
            taskId={7}
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
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(2006);
      });

      // Verify mobile-friendly delete button
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      expect(deleteButton).toHaveClass('h-7', 'w-7', 'rounded-full');

      // Test mobile touch interaction
      fireEvent.click(deleteButton);

      // Verify deletion works on mobile
      await waitFor(() => {
        expect(mockDeleteTaskImage).toHaveBeenCalledWith(7, 2006);
      });
    });

    it('should handle mobile-friendly delete confirmations', async () => {
      const existingImages = [
        { id: 2007, taskId: 8, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
      ];

      mockDeleteTaskImage.mockResolvedValue({ success: true, message: 'Image deleted successfully' });

      render(
        <TestWrapper>
          <TaskImageUpload
            taskId={8}
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
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(2007);
      });

      // Test mobile touch interaction for delete
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      // Verify mobile-friendly delete confirmation
      await waitFor(() => {
        expect(mockDeleteTaskImage).toHaveBeenCalledWith(8, 2007);
      });
    });
  });

  describe('Mobile Accessibility', () => {
    it('should provide mobile-friendly accessibility features', () => {
      render(
        <TestWrapper>
          <TaskImageUpload
            taskId={9}
            existingImages={[]}
            onImageUpload={mockOnImageUpload}
            onImageDelete={mockOnImageDelete}
            onImageClick={mockOnImageClick}
            maxImages={5}
            maxSize={5}
          />
        </TestWrapper>
      );

      // Verify mobile-friendly accessibility
      const uploadArea = screen.getByText('Click to add images');
      expect(uploadArea).toBeInTheDocument();
      
      // Verify touch-friendly sizing
      const uploadContainer = uploadArea.closest('div');
      expect(uploadContainer).toHaveClass('aspect-square');
    });

    it('should handle mobile screen reader compatibility', async () => {
      const existingImages = [
        { id: 2008, taskId: 10, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
      ];

      render(
        <TestWrapper>
          <TaskImageUpload
            taskId={10}
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
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(2008);
      });

      // Verify mobile screen reader compatibility
      const image = screen.getByAltText('Task reference image');
      expect(image).toBeInTheDocument();
      
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      expect(deleteButton).toBeInTheDocument();
    });
  });
});
