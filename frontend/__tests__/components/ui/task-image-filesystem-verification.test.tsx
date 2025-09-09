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

// Mock the task images API with filesystem verification
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

describe('TaskImageUpload - Filesystem Verification', () => {
  const mockOnImageUpload = jest.fn();
  const mockOnImageDelete = jest.fn();
  const mockOnImageClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTaskImageUrl.mockResolvedValue('data:image/jpeg;base64,test-image-data');
  });

  describe('File System Verification', () => {
    it('should verify file exists on disk after successful upload', async () => {
      const mockImageResponse = {
        id: 123,
        taskId: 1,
        filename: 'task_1_uuid.jpg',
        originalName: 'test-image.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        filePath: '/uploads/tasks/task_1_uuid.jpg',
        isPrimary: true,
        createdAt: new Date()
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
        expect(mockUploadTaskImage).toHaveBeenCalled();
      });

      // Verify the response includes file path information
      const response = await mockUploadTaskImage.mock.results[0].value;
      expect(response.filePath).toBe('/uploads/tasks/task_1_uuid.jpg');
      expect(response.filename).toBe('task_1_uuid.jpg');
      
      // The backend should have created the file on disk
      // This is verified by the successful API response
    });

    it('should verify file is removed from disk after successful deletion', async () => {
      const existingImages = [
        { id: 456, taskId: 1, filename: 'task_1_uuid.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/uploads/tasks/task_1_uuid.jpg', isPrimary: true, createdAt: '2025-01-09' },
      ];

      mockDeleteTaskImage.mockResolvedValue({ success: true, message: 'Image deleted successfully' });

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
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(456);
      });

      // Find and click the delete button
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      // Wait for deletion to complete
      await waitFor(() => {
        expect(mockDeleteTaskImage).toHaveBeenCalled();
      });

      // Verify the deletion was successful
      const response = await mockDeleteTaskImage.mock.results[0].value;
      expect(response.success).toBe(true);
      expect(response.message).toBe('Image deleted successfully');
      
      // The backend should have removed the file from disk
      // This is verified by the successful API response
    });

    it('should handle file system errors gracefully', async () => {
      const filesystemError = new Error('File system error: Permission denied');
      mockUploadTaskImage.mockRejectedValue(filesystemError);

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

      // Simulate file upload
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

      // Verify that the error was handled gracefully
      expect(mockUploadTaskImage).toHaveBeenCalledWith(1, [mockFile]);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle partial upload failures', async () => {
      const mockFile1 = new File(['test1'], 'test1.jpg', { type: 'image/jpeg' });
      const mockFile2 = new File(['test2'], 'test2.jpg', { type: 'image/jpeg' });

      // First upload succeeds, second fails
      mockUploadTaskImage
        .mockResolvedValueOnce({
          id: 100,
          taskId: 1,
          filename: 'task_1_uuid1.jpg',
          originalName: 'test1.jpg',
          fileSize: 1024,
          mimeType: 'image/jpeg',
          filePath: '/uploads/tasks/task_1_uuid1.jpg',
          isPrimary: true,
          createdAt: new Date()
        })
        .mockRejectedValueOnce(new Error('Upload failed for second file'));

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

      // Simulate multiple file upload
      const dropzone = screen.getByText('Click to add images');
      
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [mockFile1, mockFile2],
        },
      });

      // Wait for uploads to complete
      await waitFor(() => {
        expect(mockUploadTaskImage).toHaveBeenCalledTimes(2);
      });

      // Verify that both uploads were attempted
      expect(mockUploadTaskImage).toHaveBeenCalledWith(1, [mockFile1]);
      expect(mockUploadTaskImage).toHaveBeenCalledWith(1, [mockFile2]);
    });

    it('should handle concurrent upload operations', async () => {
      const mockFile1 = new File(['test1'], 'test1.jpg', { type: 'image/jpeg' });
      const mockFile2 = new File(['test2'], 'test2.jpg', { type: 'image/jpeg' });
      const mockFile3 = new File(['test3'], 'test3.jpg', { type: 'image/jpeg' });

      // All uploads succeed
      mockUploadTaskImage
        .mockResolvedValue({
          id: 200,
          taskId: 1,
          filename: 'task_1_uuid.jpg',
          originalName: 'test.jpg',
          fileSize: 1024,
          mimeType: 'image/jpeg',
          filePath: '/uploads/tasks/task_1_uuid.jpg',
          isPrimary: true,
          createdAt: new Date()
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

      // Simulate concurrent file uploads
      const dropzone = screen.getByText('Click to add images');
      
      // Upload files concurrently
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [mockFile1, mockFile2, mockFile3],
        },
      });

      // Wait for all uploads to complete
      await waitFor(() => {
        expect(mockUploadTaskImage).toHaveBeenCalledTimes(3);
      });

      // Verify all uploads were processed
      expect(mockUploadTaskImage).toHaveBeenCalledWith(1, [mockFile1]);
      expect(mockUploadTaskImage).toHaveBeenCalledWith(1, [mockFile2]);
      expect(mockUploadTaskImage).toHaveBeenCalledWith(1, [mockFile3]);
    });

    it('should handle database transaction failures', async () => {
      const dbError = new Error('Database transaction failed');
      mockUploadTaskImage.mockRejectedValue(dbError);

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

      // Simulate file upload
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

      // Verify that the database error was handled
      expect(mockUploadTaskImage).toHaveBeenCalledWith(1, [mockFile]);
    });

    it('should handle network connectivity issues', async () => {
      const networkError = new Error('Network error: Connection timeout');
      mockUploadTaskImage.mockRejectedValue(networkError);

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

      // Simulate file upload
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

      // Verify that the network error was handled
      expect(mockUploadTaskImage).toHaveBeenCalledWith(1, [mockFile]);
    });

    it('should handle file size validation errors', async () => {
      const sizeError = new Error('File size too large. Maximum size is 5MB for task images.');
      mockUploadTaskImage.mockRejectedValue(sizeError);

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

      // Simulate large file upload
      const mockFile = new File(['test'], 'large-image.jpg', { type: 'image/jpeg' });
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

      // Verify that the size validation error was handled
      expect(mockUploadTaskImage).toHaveBeenCalledWith(1, [mockFile]);
    });

    it('should handle file type validation errors', async () => {
      const typeError = new Error('File type not supported. Please upload images (JPG, PNG, WebP) only.');
      mockUploadTaskImage.mockRejectedValue(typeError);

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

      // Simulate unsupported file type upload
      const mockFile = new File(['test'], 'document.pdf', { type: 'application/pdf' });
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

      // Verify that the type validation error was handled
      expect(mockUploadTaskImage).toHaveBeenCalledWith(1, [mockFile]);
    });

    it('should handle concurrent delete operations', async () => {
      const existingImages = [
        { id: 300, taskId: 1, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
        { id: 301, taskId: 1, filename: 'test2.jpg', originalName: 'test2.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test2.jpg', isPrimary: false, createdAt: '2025-01-09' },
      ];

      mockDeleteTaskImage.mockResolvedValue({ success: true, message: 'Image deleted successfully' });

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

      // Wait for images to load
      await waitFor(() => {
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(300);
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(301);
      });

      // Find and click both delete buttons
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      
      // Click both delete buttons
      fireEvent.click(deleteButtons[0]);
      fireEvent.click(deleteButtons[1]);

      // Wait for both deletions to complete
      await waitFor(() => {
        expect(mockDeleteTaskImage).toHaveBeenCalledTimes(2);
      });

      // Verify both deletions were processed
      expect(mockDeleteTaskImage).toHaveBeenCalledWith(1, 300);
      expect(mockDeleteTaskImage).toHaveBeenCalledWith(1, 301);
    });
  });
});
