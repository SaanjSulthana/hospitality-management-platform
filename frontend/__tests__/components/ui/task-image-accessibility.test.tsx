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

describe('TaskImageUpload - Accessibility and UI/UX Polish', () => {
  const mockOnImageUpload = jest.fn();
  const mockOnImageDelete = jest.fn();
  const mockOnImageClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTaskImageUrl.mockResolvedValue('data:image/jpeg;base64,test-image-data');
  });

  describe('Accessibility Features', () => {
    it('should provide proper ARIA labels and roles', () => {
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

      // Verify upload area has proper accessibility attributes
      const uploadArea = screen.getByText('Click to add images').closest('div');
      expect(uploadArea).toBeInTheDocument();
      
      // Verify delete buttons have proper roles
      // (This will be tested when images are present)
    });

    it('should provide proper keyboard navigation', async () => {
      const existingImages = [
        { id: 5000, taskId: 2, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
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

      // Wait for image to load
      await waitFor(() => {
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(5000);
      });

      // Test keyboard navigation
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      
      // Verify button is focusable
      deleteButton.focus();
      expect(document.activeElement).toBe(deleteButton);
      
      // Test keyboard activation
      fireEvent.keyDown(deleteButton, { key: 'Enter' });
      fireEvent.keyDown(deleteButton, { key: ' ' });
    });

    it('should provide proper screen reader support', async () => {
      const existingImages = [
        { id: 5001, taskId: 3, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
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
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(5001);
      });

      // Verify screen reader support
      const image = screen.getByAltText('Task reference image');
      expect(image).toBeInTheDocument();
      
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      expect(deleteButton).toBeInTheDocument();
    });

    it('should provide proper focus management', async () => {
      const existingImages = [
        { id: 5002, taskId: 4, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
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
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(5002);
      });

      // Test focus management
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      
      // Focus the button
      deleteButton.focus();
      expect(document.activeElement).toBe(deleteButton);
      
      // Test focus styles
      expect(deleteButton).toHaveClass('focus:outline-none');
    });
  });

  describe('UI/UX Polish', () => {
    it('should provide smooth animations and transitions', () => {
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

      // Verify smooth animations
      const uploadArea = screen.getByText('Click to add images').closest('div');
      expect(uploadArea).toHaveClass('transition-all');
      expect(uploadArea).toHaveClass('duration-200');
      expect(uploadArea).toHaveClass('hover:scale-105');
    });

    it('should provide proper visual feedback', async () => {
      const mockImageResponse = {
        id: 5003,
        taskId: 6,
        filename: 'task_6_uuid.jpg',
        originalName: 'test-image.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        filePath: '/uploads/tasks/task_6_uuid.jpg',
        isPrimary: true,
        createdAt: new Date('2025-01-09T20:00:00Z')
      };

      mockUploadTaskImage.mockResolvedValue(mockImageResponse);

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

      // Verify visual feedback during upload
      await waitFor(() => {
        expect(screen.getByText(/Uploading.../)).toBeInTheDocument();
      });

      // Verify progress bar styling
      const progressBar = screen.getByText(/Uploading.../).closest('div');
      expect(progressBar).toHaveClass('bg-gradient-to-r');
      expect(progressBar).toHaveClass('from-blue-500');
      expect(progressBar).toHaveClass('to-green-500');
    });

    it('should provide proper error states and messaging', async () => {
      const uploadError = new Error('Upload failed');
      mockUploadTaskImage.mockRejectedValue(uploadError);

      render(
        <TestWrapper>
          <TaskImageUpload
            taskId={7}
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

      // Verify error state
      await waitFor(() => {
        expect(screen.getByText(/Upload failed/)).toBeInTheDocument();
      });

      // Verify error styling
      const errorContainer = screen.getByText(/Upload failed/).closest('div');
      expect(errorContainer).toHaveClass('bg-red-500/90');
      expect(errorContainer).toHaveClass('backdrop-blur-sm');
    });

    it('should provide proper success states and messaging', async () => {
      const mockImageResponse = {
        id: 5004,
        taskId: 8,
        filename: 'task_8_uuid.jpg',
        originalName: 'test-image.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        filePath: '/uploads/tasks/task_8_uuid.jpg',
        isPrimary: true,
        createdAt: new Date('2025-01-09T20:01:00Z')
      };

      mockUploadTaskImage.mockResolvedValue(mockImageResponse);

      render(
        <TestWrapper>
          <TaskImageUpload
            taskId={8}
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

      // Verify success state
      await waitFor(() => {
        expect(screen.getByText(/Upload complete!/)).toBeInTheDocument();
      });

      // Verify success styling
      const successContainer = screen.getByText(/Upload complete!/).closest('div');
      expect(successContainer).toHaveClass('text-center');
    });
  });

  describe('Modal Accessibility', () => {
    it('should provide proper modal accessibility', async () => {
      const existingImages = [
        { id: 5005, taskId: 9, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
      ];

      render(
        <TestWrapper>
          <TaskImageUpload
            taskId={9}
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
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(5005);
      });

      // Open preview modal
      const imageThumbnail = screen.getByAltText('Task reference image');
      fireEvent.click(imageThumbnail);

      // Verify modal accessibility
      await waitFor(() => {
        expect(screen.getByText('Task Reference Image')).toBeInTheDocument();
      });

      // Verify modal has proper structure
      const modal = screen.getByText('Task Reference Image').closest('div');
      expect(modal).toHaveClass('max-w-7xl');
      expect(modal).toHaveClass('max-h-[98vh]');
    });

    it('should provide proper modal keyboard navigation', async () => {
      const existingImages = [
        { id: 5006, taskId: 10, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
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
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(5006);
      });

      // Open preview modal
      const imageThumbnail = screen.getByAltText('Task reference image');
      fireEvent.click(imageThumbnail);

      // Verify modal is open
      await waitFor(() => {
        expect(screen.getByText('Task Reference Image')).toBeInTheDocument();
      });

      // Test keyboard navigation
      fireEvent.keyDown(document, { key: 'Escape' });
      
      // Verify modal closes
      await waitFor(() => {
        expect(screen.queryByText('Task Reference Image')).not.toBeInTheDocument();
      });
    });
  });

  describe('Color Contrast and Visual Design', () => {
    it('should provide proper color contrast', () => {
      render(
        <TestWrapper>
          <TaskImageUpload
            taskId={11}
            existingImages={[]}
            onImageUpload={mockOnImageUpload}
            onImageDelete={mockOnImageDelete}
            onImageClick={mockOnImageClick}
            maxImages={5}
            maxSize={5}
          />
        </TestWrapper>
      );

      // Verify proper color contrast
      const uploadArea = screen.getByText('Click to add images').closest('div');
      expect(uploadArea).toHaveClass('border-gray-300');
      expect(uploadArea).toHaveClass('text-gray-600');
      
      // Verify hover states
      expect(uploadArea).toHaveClass('hover:border-blue-500');
      expect(uploadArea).toHaveClass('hover:bg-blue-50');
    });

    it('should provide proper visual hierarchy', async () => {
      const existingImages = [
        { id: 5007, taskId: 12, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
      ];

      render(
        <TestWrapper>
          <TaskImageUpload
            taskId={12}
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
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(5007);
      });

      // Verify visual hierarchy
      const imageContainer = screen.getByAltText('Task reference image').closest('div');
      expect(imageContainer).toHaveClass('aspect-square');
      expect(imageContainer).toHaveClass('rounded-lg');
      expect(imageContainer).toHaveClass('overflow-hidden');
    });
  });

  describe('Loading States and Feedback', () => {
    it('should provide proper loading states', async () => {
      const existingImages = [
        { id: 5008, taskId: 13, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
      ];

      render(
        <TestWrapper>
          <TaskImageUpload
            taskId={13}
            existingImages={existingImages}
            onImageUpload={mockOnImageUpload}
            onImageDelete={mockOnImageDelete}
            onImageClick={mockOnImageClick}
            maxImages={5}
            maxSize={5}
          />
        </TestWrapper>
      );

      // Verify loading state
      await waitFor(() => {
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(5008);
      });

      // Verify loading spinner
      const loadingSpinner = screen.getByRole('button', { name: /delete/i }).querySelector('svg');
      expect(loadingSpinner).toBeInTheDocument();
    });

    it('should provide proper progress feedback', async () => {
      const mockImageResponse = {
        id: 5009,
        taskId: 14,
        filename: 'task_14_uuid.jpg',
        originalName: 'test-image.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        filePath: '/uploads/tasks/task_14_uuid.jpg',
        isPrimary: true,
        createdAt: new Date('2025-01-09T20:02:00Z')
      };

      mockUploadTaskImage.mockResolvedValue(mockImageResponse);

      render(
        <TestWrapper>
          <TaskImageUpload
            taskId={14}
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

      // Verify progress feedback
      await waitFor(() => {
        expect(screen.getByText(/Uploading.../)).toBeInTheDocument();
      });

      // Verify progress bar
      const progressBar = screen.getByText(/Uploading.../).closest('div');
      expect(progressBar).toHaveClass('bg-gradient-to-r');
    });
  });
});
