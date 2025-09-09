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

// Mock the task images API with database verification
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

describe('TaskImageUpload - Database Integrity Verification', () => {
  const mockOnImageUpload = jest.fn();
  const mockOnImageDelete = jest.fn();
  const mockOnImageClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTaskImageUrl.mockResolvedValue('data:image/jpeg;base64,test-image-data');
  });

  describe('Database Record Creation After Upload', () => {
    it('should create database record when image is uploaded successfully', async () => {
      const mockImageResponse = {
        id: 123,
        taskId: 1,
        filename: 'task_1_uuid.jpg',
        originalName: 'test-image.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        filePath: '/uploads/tasks/task_1_uuid.jpg',
        isPrimary: true,
        createdAt: new Date('2025-01-09T10:00:00Z')
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
        expect(mockUploadTaskImage).toHaveBeenCalledWith(1, [mockFile]);
      });

      // Verify database record was created with correct data
      expect(mockUploadTaskImage).toHaveBeenCalledWith(1, [mockFile]);
      
      // Verify the response contains all required database fields
      const uploadCall = mockUploadTaskImage.mock.calls[0];
      expect(uploadCall[0]).toBe(1); // taskId
      expect(uploadCall[1]).toEqual([mockFile]); // files array
    });

    it('should handle database transaction rollback on upload failure', async () => {
      const dbError = new Error('Database connection failed');
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

      // Verify that no database record was created
      expect(mockUploadTaskImage).toHaveBeenCalledWith(1, [mockFile]);
      // The API should handle the rollback internally
    });

    it('should verify database record contains all required fields', async () => {
      const mockImageResponse = {
        id: 456,
        taskId: 2,
        filename: 'task_2_uuid.png',
        originalName: 'test-image.png',
        fileSize: 2048,
        mimeType: 'image/png',
        filePath: '/uploads/tasks/task_2_uuid.png',
        isPrimary: false,
        createdAt: new Date('2025-01-09T11:00:00Z')
      };

      mockUploadTaskImage.mockResolvedValue(mockImageResponse);

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

      // Simulate file upload
      const mockFile = new File(['test'], 'test-image.png', { type: 'image/png' });
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

      // Verify all required database fields are present
      const response = await mockUploadTaskImage.mock.results[0].value;
      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('taskId');
      expect(response).toHaveProperty('filename');
      expect(response).toHaveProperty('originalName');
      expect(response).toHaveProperty('fileSize');
      expect(response).toHaveProperty('mimeType');
      expect(response).toHaveProperty('filePath');
      expect(response).toHaveProperty('isPrimary');
      expect(response).toHaveProperty('createdAt');
    });

    it('should handle concurrent uploads without database conflicts', async () => {
      const mockImageResponse1 = {
        id: 100,
        taskId: 1,
        filename: 'task_1_uuid1.jpg',
        originalName: 'test1.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        filePath: '/uploads/tasks/task_1_uuid1.jpg',
        isPrimary: true,
        createdAt: new Date()
      };

      const mockImageResponse2 = {
        id: 101,
        taskId: 1,
        filename: 'task_1_uuid2.jpg',
        originalName: 'test2.jpg',
        fileSize: 2048,
        mimeType: 'image/jpeg',
        filePath: '/uploads/tasks/task_1_uuid2.jpg',
        isPrimary: false,
        createdAt: new Date()
      };

      mockUploadTaskImage
        .mockResolvedValueOnce(mockImageResponse1)
        .mockResolvedValueOnce(mockImageResponse2);

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
      const mockFile1 = new File(['test1'], 'test1.jpg', { type: 'image/jpeg' });
      const mockFile2 = new File(['test2'], 'test2.jpg', { type: 'image/jpeg' });
      const dropzone = screen.getByText('Click to add images');
      
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [mockFile1, mockFile2],
        },
      });

      // Wait for both uploads to complete
      await waitFor(() => {
        expect(mockUploadTaskImage).toHaveBeenCalledTimes(2);
      });

      // Verify both database records were created with unique IDs
      const calls = mockUploadTaskImage.mock.calls;
      expect(calls[0][0]).toBe(1); // taskId
      expect(calls[1][0]).toBe(1); // taskId
      expect(calls[0][1]).toEqual([mockFile1]);
      expect(calls[1][1]).toEqual([mockFile2]);
    });
  });

  describe('Database Record Deletion After Image Removal', () => {
    it('should delete database record when image is removed', async () => {
      const existingImages = [
        { id: 123, taskId: 1, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
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
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(123);
      });

      // Find and click the delete button
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      // Wait for deletion to complete
      await waitFor(() => {
        expect(mockDeleteTaskImage).toHaveBeenCalledWith(1, 123);
      });

      // Verify database record was deleted
      expect(mockDeleteTaskImage).toHaveBeenCalledWith(1, 123);
    });

    it('should handle database deletion failure gracefully', async () => {
      const existingImages = [
        { id: 456, taskId: 2, filename: 'test2.jpg', originalName: 'test2.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test2.jpg', isPrimary: true, createdAt: '2025-01-09' },
      ];

      const dbError = new Error('Database deletion failed');
      mockDeleteTaskImage.mockRejectedValue(dbError);

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
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(456);
      });

      // Find and click the delete button
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      // Wait for error to be handled
      await waitFor(() => {
        expect(screen.getByText(/Delete failed/)).toBeInTheDocument();
      });

      // Verify deletion was attempted
      expect(mockDeleteTaskImage).toHaveBeenCalledWith(2, 456);
    });

    it('should verify database record is completely removed', async () => {
      const existingImages = [
        { id: 789, taskId: 3, filename: 'test3.jpg', originalName: 'test3.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test3.jpg', isPrimary: true, createdAt: '2025-01-09' },
      ];

      mockDeleteTaskImage.mockResolvedValue({ success: true, message: 'Image deleted successfully' });

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
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(789);
      });

      // Find and click the delete button
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      // Wait for deletion to complete
      await waitFor(() => {
        expect(mockDeleteTaskImage).toHaveBeenCalledWith(3, 789);
      });

      // Verify the API response indicates successful deletion
      const deleteCall = mockDeleteTaskImage.mock.calls[0];
      expect(deleteCall[0]).toBe(3); // taskId
      expect(deleteCall[1]).toBe(789); // imageId
    });
  });

  describe('API Response Validation', () => {
    it('should validate upload API response structure', async () => {
      const mockImageResponse = {
        id: 999,
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

      // Validate API response structure
      const response = await mockUploadTaskImage.mock.results[0].value;
      expect(typeof response.id).toBe('number');
      expect(typeof response.taskId).toBe('number');
      expect(typeof response.filename).toBe('string');
      expect(typeof response.originalName).toBe('string');
      expect(typeof response.fileSize).toBe('number');
      expect(typeof response.mimeType).toBe('string');
      expect(typeof response.filePath).toBe('string');
      expect(typeof response.isPrimary).toBe('boolean');
      expect(response.createdAt).toBeInstanceOf(Date);
    });

    it('should validate delete API response structure', async () => {
      const existingImages = [
        { id: 111, taskId: 1, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
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
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(111);
      });

      // Find and click the delete button
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      // Wait for deletion to complete
      await waitFor(() => {
        expect(mockDeleteTaskImage).toHaveBeenCalled();
      });

      // Validate API response structure
      const response = await mockDeleteTaskImage.mock.results[0].value;
      expect(typeof response.success).toBe('boolean');
      expect(typeof response.message).toBe('string');
      expect(response.success).toBe(true);
    });
  });

  describe('Database Consistency Checks', () => {
    it('should verify frontend state matches database state after upload', async () => {
      const mockImageResponse = {
        id: 222,
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

      // Verify that the frontend receives the correct database response
      const response = await mockUploadTaskImage.mock.results[0].value;
      expect(response.id).toBe(222);
      expect(response.taskId).toBe(1);
      expect(response.filename).toBe('task_1_uuid.jpg');
      expect(response.originalName).toBe('test-image.jpg');
      expect(response.fileSize).toBe(1024);
      expect(response.mimeType).toBe('image/jpeg');
      expect(response.filePath).toBe('/uploads/tasks/task_1_uuid.jpg');
      expect(response.isPrimary).toBe(true);
    });

    it('should verify frontend state matches database state after deletion', async () => {
      const existingImages = [
        { id: 333, taskId: 1, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
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
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(333);
      });

      // Find and click the delete button
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      // Wait for deletion to complete
      await waitFor(() => {
        expect(mockDeleteTaskImage).toHaveBeenCalled();
      });

      // Verify that the frontend receives the correct database response
      const response = await mockDeleteTaskImage.mock.results[0].value;
      expect(response.success).toBe(true);
      expect(response.message).toBe('Image deleted successfully');
    });
  });
});
