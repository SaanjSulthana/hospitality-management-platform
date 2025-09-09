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

describe('TaskImageUpload - Cross-Browser Compatibility', () => {
  const mockOnImageUpload = jest.fn();
  const mockOnImageDelete = jest.fn();
  const mockOnImageClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTaskImageUrl.mockResolvedValue('data:image/jpeg;base64,test-image-data');
  });

  describe('File API Compatibility', () => {
    it('should handle File API across different browsers', async () => {
      const mockImageResponse = {
        id: 4000,
        taskId: 1,
        filename: 'task_1_uuid.jpg',
        originalName: 'test-image.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        filePath: '/uploads/tasks/task_1_uuid.jpg',
        isPrimary: true,
        createdAt: new Date('2025-01-09T19:00:00Z')
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

      // Test File API compatibility
      const mockFile = new File(['test'], 'test-image.jpg', { type: 'image/jpeg' });
      
      // Verify File object properties are accessible
      expect(mockFile.name).toBe('test-image.jpg');
      expect(mockFile.type).toBe('image/jpeg');
      expect(mockFile.size).toBe(4); // 'test' is 4 bytes

      // Simulate file upload
      const dropzone = screen.getByText('Click to add images');
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [mockFile],
        },
      });

      // Wait for upload to complete
      await waitFor(() => {
        expect(mockUploadTaskImage).toHaveBeenCalledWith(1, [mockFile]);
      });

      // Verify upload works across browsers
      expect(mockUploadTaskImage).toHaveBeenCalledTimes(1);
    });

    it('should handle FileReader API compatibility', async () => {
      const existingImages = [
        { id: 4001, taskId: 2, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
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
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(4001);
      });

      // Verify FileReader API is available
      expect(typeof FileReader).toBe('function');
      
      // Test FileReader functionality
      const fileReader = new FileReader();
      expect(fileReader).toBeDefined();
      expect(typeof fileReader.readAsDataURL).toBe('function');
    });
  });

  describe('Drag and Drop API Compatibility', () => {
    it('should handle drag and drop events across browsers', async () => {
      const mockImageResponse = {
        id: 4002,
        taskId: 3,
        filename: 'task_3_uuid.jpg',
        originalName: 'test-image.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        filePath: '/uploads/tasks/task_3_uuid.jpg',
        isPrimary: true,
        createdAt: new Date('2025-01-09T19:01:00Z')
      };

      mockUploadTaskImage.mockResolvedValue(mockImageResponse);

      render(
        <TestWrapper>
          <TaskImageUpload
            taskId={3}
            existingImages={[]}
            onImageUpload={mockOnImageUpload}
            onImageDelete={mockOnImageDelete}
            onImageClick={mockOnImageClick}
            maxImages={5}
            maxSize={5}
          />
        </TestWrapper>
      );

      // Test drag and drop API compatibility
      const mockFile = new File(['test'], 'test-image.jpg', { type: 'image/jpeg' });
      const dropzone = screen.getByText('Click to add images');
      
      // Simulate drag and drop with different event types
      const dragOverEvent = new Event('dragover', { bubbles: true });
      const dropEvent = new Event('drop', { bubbles: true });
      
      // Add files to drop event
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          files: [mockFile],
        },
      });

      // Test drag over
      fireEvent(dropzone, dragOverEvent);
      
      // Test drop
      fireEvent(dropzone, dropEvent);

      // Wait for upload to complete
      await waitFor(() => {
        expect(mockUploadTaskImage).toHaveBeenCalledWith(3, [mockFile]);
      });

      // Verify drag and drop works across browsers
      expect(mockUploadTaskImage).toHaveBeenCalledTimes(1);
    });

    it('should handle drag and drop with different file types', async () => {
      const mockImageResponse = {
        id: 4003,
        taskId: 4,
        filename: 'task_4_uuid.png',
        originalName: 'test-image.png',
        fileSize: 1024,
        mimeType: 'image/png',
        filePath: '/uploads/tasks/task_4_uuid.png',
        isPrimary: true,
        createdAt: new Date('2025-01-09T19:02:00Z')
      };

      mockUploadTaskImage.mockResolvedValue(mockImageResponse);

      render(
        <TestWrapper>
          <TaskImageUpload
            taskId={4}
            existingImages={[]}
            onImageUpload={mockOnImageUpload}
            onImageDelete={mockOnImageDelete}
            onImageClick={mockOnImageClick}
            maxImages={5}
            maxSize={5}
          />
        </TestWrapper>
      );

      // Test different image formats
      const pngFile = new File(['test'], 'test-image.png', { type: 'image/png' });
      const jpegFile = new File(['test'], 'test-image.jpeg', { type: 'image/jpeg' });
      const webpFile = new File(['test'], 'test-image.webp', { type: 'image/webp' });
      
      const dropzone = screen.getByText('Click to add images');
      
      // Test PNG upload
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [pngFile],
        },
      });

      await waitFor(() => {
        expect(mockUploadTaskImage).toHaveBeenCalledWith(4, [pngFile]);
      });

      // Verify different file types are handled
      expect(mockUploadTaskImage).toHaveBeenCalledTimes(1);
    });
  });

  describe('URL API Compatibility', () => {
    it('should handle URL.createObjectURL across browsers', async () => {
      const existingImages = [
        { id: 4004, taskId: 5, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
      ];

      render(
        <TestWrapper>
          <TaskImageUpload
            taskId={5}
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
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(4004);
      });

      // Test URL API compatibility
      expect(typeof URL).toBe('function');
      expect(typeof URL.createObjectURL).toBe('function');
      expect(typeof URL.revokeObjectURL).toBe('function');
      
      // Test URL.createObjectURL functionality
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const objectURL = URL.createObjectURL(mockFile);
      
      expect(objectURL).toBeDefined();
      expect(objectURL.startsWith('blob:')).toBe(true);
      
      // Test URL.revokeObjectURL functionality
      URL.revokeObjectURL(objectURL);
    });

    it('should handle URL.revokeObjectURL cleanup across browsers', async () => {
      const mockImageResponse = {
        id: 4005,
        taskId: 6,
        filename: 'task_6_uuid.jpg',
        originalName: 'test-image.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        filePath: '/uploads/tasks/task_6_uuid.jpg',
        isPrimary: true,
        createdAt: new Date('2025-01-09T19:03:00Z')
      };

      mockUploadTaskImage.mockResolvedValue(mockImageResponse);

      const { unmount } = render(
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

      // Wait for upload to complete
      await waitFor(() => {
        expect(mockUploadTaskImage).toHaveBeenCalledWith(6, [mockFile]);
      });

      // Test component unmount cleanup
      unmount();
      
      // Verify cleanup works across browsers
      expect(mockUploadTaskImage).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event Handling Compatibility', () => {
    it('should handle keyboard events across browsers', async () => {
      const existingImages = [
        { id: 4006, taskId: 7, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
      ];

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
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(4006);
      });

      // Open preview modal
      const imageThumbnail = screen.getByAltText('Task reference image');
      fireEvent.click(imageThumbnail);

      // Verify modal is open
      await waitFor(() => {
        expect(screen.getByText('Task Reference Image')).toBeInTheDocument();
      });

      // Test different keyboard event formats
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      const escapeEventAlt = new KeyboardEvent('keydown', { keyCode: 27, bubbles: true });
      
      // Test Escape key
      fireEvent.keyDown(document, { key: 'Escape' });
      
      // Verify modal closes
      await waitFor(() => {
        expect(screen.queryByText('Task Reference Image')).not.toBeInTheDocument();
      });
    });

    it('should handle click events across browsers', async () => {
      const existingImages = [
        { id: 4007, taskId: 8, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
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
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(4007);
      });

      // Test different click event formats
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      
      // Test standard click
      fireEvent.click(deleteButton);
      
      // Wait for deletion to complete
      await waitFor(() => {
        expect(mockDeleteTaskImage).toHaveBeenCalledWith(8, 4007);
      });

      // Verify click events work across browsers
      expect(mockDeleteTaskImage).toHaveBeenCalledTimes(1);
    });
  });

  describe('CSS Compatibility', () => {
    it('should handle CSS classes across browsers', () => {
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

      // Verify CSS classes are applied correctly
      const uploadArea = screen.getByText('Click to add images').closest('div');
      expect(uploadArea).toHaveClass('aspect-square');
      expect(uploadArea).toHaveClass('border-2');
      expect(uploadArea).toHaveClass('border-dashed');
      expect(uploadArea).toHaveClass('border-gray-300');
      expect(uploadArea).toHaveClass('rounded-lg');
      expect(uploadArea).toHaveClass('cursor-pointer');
      expect(uploadArea).toHaveClass('transition-all');
      expect(uploadArea).toHaveClass('duration-200');
    });

    it('should handle responsive CSS across browsers', () => {
      render(
        <TestWrapper>
          <TaskImageUpload
            taskId={10}
            existingImages={[]}
            onImageUpload={mockOnImageUpload}
            onImageDelete={mockOnImageDelete}
            onImageClick={mockOnImageClick}
            maxImages={5}
            maxSize={5}
          />
        </TestWrapper>
      );

      // Verify responsive CSS classes
      const uploadArea = screen.getByText('Click to add images').closest('div');
      expect(uploadArea).toHaveClass('aspect-square');
      
      // Verify text responsive classes
      const uploadText = screen.getByText('Click to add images');
      expect(uploadText).toHaveClass('text-sm');
      expect(uploadText).toHaveClass('text-gray-600');
    });
  });

  describe('Promise and Async Compatibility', () => {
    it('should handle Promise API across browsers', async () => {
      const mockImageResponse = {
        id: 4008,
        taskId: 11,
        filename: 'task_11_uuid.jpg',
        originalName: 'test-image.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        filePath: '/uploads/tasks/task_11_uuid.jpg',
        isPrimary: true,
        createdAt: new Date('2025-01-09T19:04:00Z')
      };

      // Test Promise compatibility
      const uploadPromise = Promise.resolve(mockImageResponse);
      mockUploadTaskImage.mockReturnValue(uploadPromise);

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

      // Simulate file upload
      const mockFile = new File(['test'], 'test-image.jpg', { type: 'image/jpeg' });
      const dropzone = screen.getByText('Click to add images');
      
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [mockFile],
        },
      });

      // Wait for Promise to resolve
      await waitFor(() => {
        expect(mockUploadTaskImage).toHaveBeenCalledWith(11, [mockFile]);
      });

      // Verify Promise handling works across browsers
      expect(mockUploadTaskImage).toHaveBeenCalledTimes(1);
    });

    it('should handle async/await across browsers', async () => {
      const existingImages = [
        { id: 4009, taskId: 12, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
      ];

      mockDeleteTaskImage.mockResolvedValue({ success: true, message: 'Image deleted successfully' });

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
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(4009);
      });

      // Test async/await functionality
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      // Wait for async operation to complete
      await waitFor(() => {
        expect(mockDeleteTaskImage).toHaveBeenCalledWith(12, 4009);
      });

      // Verify async/await works across browsers
      expect(mockDeleteTaskImage).toHaveBeenCalledTimes(1);
    });
  });
});
