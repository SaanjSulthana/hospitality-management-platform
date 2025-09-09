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

describe('TaskImageUpload - Performance Testing', () => {
  const mockOnImageUpload = jest.fn();
  const mockOnImageDelete = jest.fn();
  const mockOnImageClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTaskImageUrl.mockResolvedValue('data:image/jpeg;base64,test-image-data');
  });

  describe('Large File Upload Performance', () => {
    it('should handle large file uploads efficiently', async () => {
      const largeFileSize = 4 * 1024 * 1024; // 4MB
      const mockImageResponse = {
        id: 3000,
        taskId: 1,
        filename: 'task_1_large_uuid.jpg',
        originalName: 'large-image.jpg',
        fileSize: largeFileSize,
        mimeType: 'image/jpeg',
        filePath: '/uploads/tasks/task_1_large_uuid.jpg',
        isPrimary: true,
        createdAt: new Date('2025-01-09T18:00:00Z')
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

      // Create a large file mock
      const largeFile = new File(['x'.repeat(largeFileSize)], 'large-image.jpg', { type: 'image/jpeg' });
      
      const startTime = performance.now();
      
      // Simulate large file upload
      const dropzone = screen.getByText('Click to add images');
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [largeFile],
        },
      });

      // Wait for upload to complete
      await waitFor(() => {
        expect(mockUploadTaskImage).toHaveBeenCalledWith(1, [largeFile]);
      });

      const endTime = performance.now();
      const uploadTime = endTime - startTime;

      // Verify upload completed successfully
      expect(mockUploadTaskImage).toHaveBeenCalledTimes(1);
      
      // Performance assertion: upload should complete within reasonable time
      expect(uploadTime).toBeLessThan(10000); // 10 seconds max
    });

    it('should handle multiple large file uploads concurrently', async () => {
      const largeFileSize = 2 * 1024 * 1024; // 2MB each
      const mockImageResponses = [
        {
          id: 3001,
          taskId: 2,
          filename: 'task_2_large1_uuid.jpg',
          originalName: 'large1.jpg',
          fileSize: largeFileSize,
          mimeType: 'image/jpeg',
          filePath: '/uploads/tasks/task_2_large1_uuid.jpg',
          isPrimary: true,
          createdAt: new Date('2025-01-09T18:01:00Z')
        },
        {
          id: 3002,
          taskId: 2,
          filename: 'task_2_large2_uuid.jpg',
          originalName: 'large2.jpg',
          fileSize: largeFileSize,
          mimeType: 'image/jpeg',
          filePath: '/uploads/tasks/task_2_large2_uuid.jpg',
          isPrimary: false,
          createdAt: new Date('2025-01-09T18:02:00Z')
        }
      ];

      mockUploadTaskImage
        .mockResolvedValueOnce(mockImageResponses[0])
        .mockResolvedValueOnce(mockImageResponses[1]);

      render(
        <TestWrapper>
          <TaskImageUpload
            taskId={2}
            existingImages={[]}
            onImageUpload={mockOnImageUpload}
            onImageDelete={mockOnImageDelete}
            onImageClick={mockOnImageClick}
            maxImages={5}
            maxSize={5}
          />
        </TestWrapper>
      );

      // Create large files
      const largeFile1 = new File(['x'.repeat(largeFileSize)], 'large1.jpg', { type: 'image/jpeg' });
      const largeFile2 = new File(['x'.repeat(largeFileSize)], 'large2.jpg', { type: 'image/jpeg' });
      
      const startTime = performance.now();
      
      // Simulate concurrent large file uploads
      const dropzone = screen.getByText('Click to add images');
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [largeFile1, largeFile2],
        },
      });

      // Wait for both uploads to complete
      await waitFor(() => {
        expect(mockUploadTaskImage).toHaveBeenCalledTimes(2);
      });

      const endTime = performance.now();
      const uploadTime = endTime - startTime;

      // Verify both uploads completed successfully
      expect(mockUploadTaskImage).toHaveBeenCalledWith(2, [largeFile1]);
      expect(mockUploadTaskImage).toHaveBeenCalledWith(2, [largeFile2]);
      
      // Performance assertion: concurrent uploads should complete within reasonable time
      expect(uploadTime).toBeLessThan(15000); // 15 seconds max for concurrent uploads
    });

    it('should handle file size validation efficiently', async () => {
      const oversizedFile = 6 * 1024 * 1024; // 6MB (exceeds 5MB limit)
      const sizeError = new Error('File size too large. Maximum size is 5MB for task images.');
      mockUploadTaskImage.mockRejectedValue(sizeError);

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

      const startTime = performance.now();
      
      // Create oversized file
      const oversizedFileObj = new File(['x'.repeat(oversizedFile)], 'oversized.jpg', { type: 'image/jpeg' });
      
      // Simulate oversized file upload
      const dropzone = screen.getByText('Click to add images');
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [oversizedFileObj],
        },
      });

      // Wait for error to be handled
      await waitFor(() => {
        expect(screen.getByText(/Upload failed/)).toBeInTheDocument();
      });

      const endTime = performance.now();
      const validationTime = endTime - startTime;

      // Verify validation was performed efficiently
      expect(mockUploadTaskImage).toHaveBeenCalledWith(3, [oversizedFileObj]);
      
      // Performance assertion: validation should be fast
      expect(validationTime).toBeLessThan(1000); // 1 second max for validation
    });
  });

  describe('Memory Management Performance', () => {
    it('should handle memory cleanup efficiently for multiple images', async () => {
      const existingImages = [
        { id: 3003, taskId: 4, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
        { id: 3004, taskId: 4, filename: 'test2.jpg', originalName: 'test2.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test2.jpg', isPrimary: false, createdAt: '2025-01-09' },
        { id: 3005, taskId: 4, filename: 'test3.jpg', originalName: 'test3.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test3.jpg', isPrimary: false, createdAt: '2025-01-09' },
      ];

      mockDeleteTaskImage.mockResolvedValue({ success: true, message: 'Image deleted successfully' });

      const { rerender } = render(
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

      // Wait for all images to load
      await waitFor(() => {
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(3003);
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(3004);
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(3005);
      });

      const startTime = performance.now();

      // Delete all images
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      
      for (const deleteButton of deleteButtons) {
        fireEvent.click(deleteButton);
      }

      // Wait for all deletions to complete
      await waitFor(() => {
        expect(mockDeleteTaskImage).toHaveBeenCalledTimes(3);
      });

      const endTime = performance.now();
      const deletionTime = endTime - startTime;

      // Verify all deletions completed successfully
      expect(mockDeleteTaskImage).toHaveBeenCalledWith(4, 3003);
      expect(mockDeleteTaskImage).toHaveBeenCalledWith(4, 3004);
      expect(mockDeleteTaskImage).toHaveBeenCalledWith(4, 3005);
      
      // Performance assertion: multiple deletions should be efficient
      expect(deletionTime).toBeLessThan(5000); // 5 seconds max for multiple deletions
    });

    it('should handle image caching performance efficiently', async () => {
      const existingImages = [
        { id: 3006, taskId: 5, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
      ];

      const { rerender } = render(
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

      // Wait for initial image load
      await waitFor(() => {
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(3006);
      });

      const initialCallCount = mockGetTaskImageUrl.mock.calls.length;

      // Re-render component multiple times to test caching
      for (let i = 0; i < 5; i++) {
        rerender(
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
      }

      // Verify caching is working (no additional API calls)
      expect(mockGetTaskImageUrl).toHaveBeenCalledTimes(initialCallCount);
    });
  });

  describe('UI Performance', () => {
    it('should handle rapid user interactions efficiently', async () => {
      const mockImageResponse = {
        id: 3007,
        taskId: 6,
        filename: 'task_6_uuid.jpg',
        originalName: 'test-image.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        filePath: '/uploads/tasks/task_6_uuid.jpg',
        isPrimary: true,
        createdAt: new Date('2025-01-09T18:03:00Z')
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

      const startTime = performance.now();

      // Simulate rapid user interactions
      const dropzone = screen.getByText('Click to add images');
      const mockFile = new File(['test'], 'test-image.jpg', { type: 'image/jpeg' });
      
      // Rapid clicks and drops
      for (let i = 0; i < 10; i++) {
        fireEvent.click(dropzone);
        fireEvent.drop(dropzone, {
          dataTransfer: {
            files: [mockFile],
          },
        });
      }

      // Wait for upload to complete
      await waitFor(() => {
        expect(mockUploadTaskImage).toHaveBeenCalled();
      });

      const endTime = performance.now();
      const interactionTime = endTime - startTime;

      // Verify rapid interactions are handled efficiently
      expect(interactionTime).toBeLessThan(3000); // 3 seconds max for rapid interactions
    });

    it('should handle modal performance efficiently', async () => {
      const existingImages = [
        { id: 3008, taskId: 7, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
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
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(3008);
      });

      const startTime = performance.now();

      // Rapid modal open/close operations
      const imageThumbnail = screen.getByAltText('Task reference image');
      
      for (let i = 0; i < 5; i++) {
        // Open modal
        fireEvent.click(imageThumbnail);
        await waitFor(() => {
          expect(screen.getByText('Task Reference Image')).toBeInTheDocument();
        });
        
        // Close modal
        fireEvent.keyDown(document, { key: 'Escape' });
        await waitFor(() => {
          expect(screen.queryByText('Task Reference Image')).not.toBeInTheDocument();
        });
      }

      const endTime = performance.now();
      const modalTime = endTime - startTime;

      // Verify modal operations are efficient
      expect(modalTime).toBeLessThan(2000); // 2 seconds max for modal operations
    });
  });

  describe('Network Performance', () => {
    it('should handle network latency efficiently', async () => {
      const mockImageResponse = {
        id: 3009,
        taskId: 8,
        filename: 'task_8_uuid.jpg',
        originalName: 'test-image.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        filePath: '/uploads/tasks/task_8_uuid.jpg',
        isPrimary: true,
        createdAt: new Date('2025-01-09T18:04:00Z')
      };

      // Simulate network latency
      mockUploadTaskImage.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockImageResponse), 100))
      );

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

      const startTime = performance.now();

      // Simulate file upload with network latency
      const mockFile = new File(['test'], 'test-image.jpg', { type: 'image/jpeg' });
      const dropzone = screen.getByText('Click to add images');
      
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [mockFile],
        },
      });

      // Wait for upload to complete
      await waitFor(() => {
        expect(mockUploadTaskImage).toHaveBeenCalledWith(8, [mockFile]);
      });

      const endTime = performance.now();
      const networkTime = endTime - startTime;

      // Verify network latency is handled efficiently
      expect(networkTime).toBeLessThan(5000); // 5 seconds max including network latency
    });

    it('should handle network errors efficiently', async () => {
      const networkError = new Error('Network error');
      mockUploadTaskImage.mockRejectedValue(networkError);

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

      const startTime = performance.now();

      // Simulate file upload with network error
      const mockFile = new File(['test'], 'test-image.jpg', { type: 'image/jpeg' });
      const dropzone = screen.getByText('Click to add images');
      
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [mockFile],
        },
      });

      // Wait for error to be handled
      await waitFor(() => {
        expect(screen.getByText(/Upload failed/)).toBeInTheDocument();
      });

      const endTime = performance.now();
      const errorTime = endTime - startTime;

      // Verify network errors are handled efficiently
      expect(errorTime).toBeLessThan(2000); // 2 seconds max for error handling
    });
  });
});
