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

describe('TaskImageUpload - Complete Workflow Integration', () => {
  const mockOnImageUpload = jest.fn();
  const mockOnImageDelete = jest.fn();
  const mockOnImageClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTaskImageUrl.mockResolvedValue('data:image/jpeg;base64,test-image-data');
  });

  describe('Complete Upload Workflow', () => {
    it('should handle complete drag and drop upload workflow', async () => {
      const mockImageResponse = {
        id: 1000,
        taskId: 1,
        filename: 'task_1_uuid.jpg',
        originalName: 'test-image.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        filePath: '/uploads/tasks/task_1_uuid.jpg',
        isPrimary: true,
        createdAt: new Date('2025-01-09T16:00:00Z')
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

      // Step 1: Verify initial state
      expect(screen.getByText('Click to add images')).toBeInTheDocument();
      expect(screen.getByText('Drag & drop images here')).toBeInTheDocument();

      // Step 2: Simulate drag and drop upload
      const mockFile = new File(['test'], 'test-image.jpg', { type: 'image/jpeg' });
      const dropzone = screen.getByText('Click to add images');
      
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [mockFile],
        },
      });

      // Step 3: Verify upload progress
      await waitFor(() => {
        expect(screen.getByText(/Uploading.../)).toBeInTheDocument();
      });

      // Step 4: Wait for upload completion
      await waitFor(() => {
        expect(mockUploadTaskImage).toHaveBeenCalledWith(1, [mockFile]);
      });

      // Step 5: Verify success state
      await waitFor(() => {
        expect(screen.getByText(/Upload complete!/)).toBeInTheDocument();
      });

      // Step 6: Verify final state
      expect(mockUploadTaskImage).toHaveBeenCalledTimes(1);
    });

    it('should handle complete file picker upload workflow', async () => {
      const mockImageResponse = {
        id: 1001,
        taskId: 2,
        filename: 'task_2_uuid.jpg',
        originalName: 'test-image.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        filePath: '/uploads/tasks/task_2_uuid.jpg',
        isPrimary: true,
        createdAt: new Date('2025-01-09T16:01:00Z')
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

      // Step 1: Verify initial state
      expect(screen.getByText('Click to add images')).toBeInTheDocument();

      // Step 2: Simulate file picker upload
      const mockFile = new File(['test'], 'test-image.jpg', { type: 'image/jpeg' });
      const dropzone = screen.getByText('Click to add images');
      
      // Simulate clicking to open file picker
      fireEvent.click(dropzone);

      // Simulate file selection
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [mockFile],
        },
      });

      // Step 3: Verify upload progress
      await waitFor(() => {
        expect(screen.getByText(/Uploading.../)).toBeInTheDocument();
      });

      // Step 4: Wait for upload completion
      await waitFor(() => {
        expect(mockUploadTaskImage).toHaveBeenCalledWith(2, [mockFile]);
      });

      // Step 5: Verify success state
      await waitFor(() => {
        expect(screen.getByText(/Upload complete!/)).toBeInTheDocument();
      });

      // Step 6: Verify final state
      expect(mockUploadTaskImage).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple file upload workflow', async () => {
      const mockImageResponses = [
        {
          id: 1002,
          taskId: 3,
          filename: 'task_3_uuid1.jpg',
          originalName: 'test1.jpg',
          fileSize: 1024,
          mimeType: 'image/jpeg',
          filePath: '/uploads/tasks/task_3_uuid1.jpg',
          isPrimary: true,
          createdAt: new Date('2025-01-09T16:02:00Z')
        },
        {
          id: 1003,
          taskId: 3,
          filename: 'task_3_uuid2.jpg',
          originalName: 'test2.jpg',
          fileSize: 2048,
          mimeType: 'image/jpeg',
          filePath: '/uploads/tasks/task_3_uuid2.jpg',
          isPrimary: false,
          createdAt: new Date('2025-01-09T16:03:00Z')
        }
      ];

      mockUploadTaskImage
        .mockResolvedValueOnce(mockImageResponses[0])
        .mockResolvedValueOnce(mockImageResponses[1]);

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

      // Step 1: Verify initial state
      expect(screen.getByText('Click to add images')).toBeInTheDocument();

      // Step 2: Simulate multiple file upload
      const mockFile1 = new File(['test1'], 'test1.jpg', { type: 'image/jpeg' });
      const mockFile2 = new File(['test2'], 'test2.jpg', { type: 'image/jpeg' });
      const dropzone = screen.getByText('Click to add images');
      
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [mockFile1, mockFile2],
        },
      });

      // Step 3: Verify upload progress for both files
      await waitFor(() => {
        expect(screen.getByText(/Uploading.../)).toBeInTheDocument();
      });

      // Step 4: Wait for both uploads to complete
      await waitFor(() => {
        expect(mockUploadTaskImage).toHaveBeenCalledTimes(2);
      });

      // Step 5: Verify both uploads were successful
      expect(mockUploadTaskImage).toHaveBeenCalledWith(3, [mockFile1]);
      expect(mockUploadTaskImage).toHaveBeenCalledWith(3, [mockFile2]);

      // Step 6: Verify success states
      await waitFor(() => {
        expect(screen.getByText(/Upload complete!/)).toBeInTheDocument();
      });
    });

    it('should handle upload with existing images workflow', async () => {
      const existingImages = [
        { id: 1004, taskId: 4, filename: 'existing1.jpg', originalName: 'existing1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/existing1.jpg', isPrimary: true, createdAt: '2025-01-09' },
      ];

      const mockImageResponse = {
        id: 1005,
        taskId: 4,
        filename: 'task_4_uuid.jpg',
        originalName: 'new-image.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        filePath: '/uploads/tasks/task_4_uuid.jpg',
        isPrimary: false,
        createdAt: new Date('2025-01-09T16:04:00Z')
      };

      mockUploadTaskImage.mockResolvedValue(mockImageResponse);

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

      // Step 1: Verify existing image is displayed
      await waitFor(() => {
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(1004);
      });

      // Step 2: Simulate new file upload
      const mockFile = new File(['test'], 'new-image.jpg', { type: 'image/jpeg' });
      const dropzone = screen.getByText('Click to add images');
      
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [mockFile],
        },
      });

      // Step 3: Verify upload progress
      await waitFor(() => {
        expect(screen.getByText(/Uploading.../)).toBeInTheDocument();
      });

      // Step 4: Wait for upload completion
      await waitFor(() => {
        expect(mockUploadTaskImage).toHaveBeenCalledWith(4, [mockFile]);
      });

      // Step 5: Verify success state
      await waitFor(() => {
        expect(screen.getByText(/Upload complete!/)).toBeInTheDocument();
      });

      // Step 6: Verify both existing and new images are handled
      expect(mockUploadTaskImage).toHaveBeenCalledTimes(1);
      expect(mockGetTaskImageUrl).toHaveBeenCalledWith(1004);
    });
  });

  describe('Complete Delete Workflow', () => {
    it('should handle complete image deletion workflow', async () => {
      const existingImages = [
        { id: 1006, taskId: 5, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
      ];

      mockDeleteTaskImage.mockResolvedValue({ success: true, message: 'Image deleted successfully' });

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

      // Step 1: Verify image is loaded
      await waitFor(() => {
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(1006);
      });

      // Step 2: Find and click delete button
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      // Step 3: Wait for deletion to complete
      await waitFor(() => {
        expect(mockDeleteTaskImage).toHaveBeenCalledWith(5, 1006);
      });

      // Step 4: Verify deletion was successful
      const response = await mockDeleteTaskImage.mock.results[0].value;
      expect(response.success).toBe(true);
      expect(response.message).toBe('Image deleted successfully');

      // Step 5: Verify final state
      expect(mockDeleteTaskImage).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple image deletion workflow', async () => {
      const existingImages = [
        { id: 1007, taskId: 6, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
        { id: 1008, taskId: 6, filename: 'test2.jpg', originalName: 'test2.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test2.jpg', isPrimary: false, createdAt: '2025-01-09' },
      ];

      mockDeleteTaskImage.mockResolvedValue({ success: true, message: 'Image deleted successfully' });

      render(
        <TestWrapper>
          <TaskImageUpload
            taskId={6}
            existingImages={existingImages}
            onImageUpload={mockOnImageUpload}
            onImageDelete={mockOnImageDelete}
            onImageClick={mockOnImageClick}
            maxImages={5}
            maxSize={5}
          />
        </TestWrapper>
      );

      // Step 1: Verify both images are loaded
      await waitFor(() => {
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(1007);
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(1008);
      });

      // Step 2: Find and click both delete buttons
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      
      // Delete first image
      fireEvent.click(deleteButtons[0]);
      await waitFor(() => {
        expect(mockDeleteTaskImage).toHaveBeenCalledWith(6, 1007);
      });

      // Delete second image
      fireEvent.click(deleteButtons[1]);
      await waitFor(() => {
        expect(mockDeleteTaskImage).toHaveBeenCalledWith(6, 1008);
      });

      // Step 3: Verify both deletions were successful
      expect(mockDeleteTaskImage).toHaveBeenCalledTimes(2);
    });
  });

  describe('Complete Preview Workflow', () => {
    it('should handle complete image preview workflow', async () => {
      const existingImages = [
        { id: 1009, taskId: 7, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
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

      // Step 1: Verify image is loaded
      await waitFor(() => {
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(1009);
      });

      // Step 2: Find and click image to open preview
      const imageThumbnail = screen.getByAltText('Task reference image');
      fireEvent.click(imageThumbnail);

      // Step 3: Verify preview modal is opened
      await waitFor(() => {
        expect(screen.getByText('Task Reference Image')).toBeInTheDocument();
      });

      // Step 4: Verify image info is displayed
      expect(screen.getByText('Image ID: 1009')).toBeInTheDocument();
      expect(screen.getByText('Task ID: 7')).toBeInTheDocument();

      // Step 5: Verify navigation hints
      expect(screen.getByText('ESC')).toBeInTheDocument();
      expect(screen.getByText('Click Outside')).toBeInTheDocument();

      // Step 6: Close modal with escape key
      fireEvent.keyDown(document, { key: 'Escape' });
      await waitFor(() => {
        expect(screen.queryByText('Task Reference Image')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Recovery Workflow', () => {
    it('should handle upload error and recovery workflow', async () => {
      const mockImageResponse = {
        id: 1010,
        taskId: 8,
        filename: 'task_8_uuid.jpg',
        originalName: 'test-image.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        filePath: '/uploads/tasks/task_8_uuid.jpg',
        isPrimary: true,
        createdAt: new Date('2025-01-09T16:05:00Z')
      };

      // First upload fails, retry succeeds
      mockUploadTaskImage
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockImageResponse);

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

      // Step 1: First upload attempt (fails)
      const mockFile = new File(['test'], 'test-image.jpg', { type: 'image/jpeg' });
      const dropzone = screen.getByText('Click to add images');
      
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [mockFile],
        },
      });

      // Step 2: Verify error state
      await waitFor(() => {
        expect(screen.getByText(/Upload failed/)).toBeInTheDocument();
      });

      // Step 3: Retry upload (succeeds)
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [mockFile],
        },
      });

      // Step 4: Verify success state
      await waitFor(() => {
        expect(screen.getByText(/Upload complete!/)).toBeInTheDocument();
      });

      // Step 5: Verify both attempts were made
      expect(mockUploadTaskImage).toHaveBeenCalledTimes(2);
    });

    it('should handle delete error and recovery workflow', async () => {
      const existingImages = [
        { id: 1011, taskId: 9, filename: 'test1.jpg', originalName: 'test1.jpg', fileSize: 1024, mimeType: 'image/jpeg', filePath: '/test1.jpg', isPrimary: true, createdAt: '2025-01-09' },
      ];

      // First delete fails, retry succeeds
      mockDeleteTaskImage
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({ success: true, message: 'Image deleted successfully' });

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

      // Step 1: Verify image is loaded
      await waitFor(() => {
        expect(mockGetTaskImageUrl).toHaveBeenCalledWith(1011);
      });

      // Step 2: First delete attempt (fails)
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      // Step 3: Verify error state
      await waitFor(() => {
        expect(screen.getByText(/Delete failed/)).toBeInTheDocument();
      });

      // Step 4: Retry delete (succeeds)
      fireEvent.click(deleteButton);

      // Step 5: Verify success state
      await waitFor(() => {
        expect(mockDeleteTaskImage).toHaveBeenCalledTimes(2);
      });

      // Step 6: Verify both attempts were made
      expect(mockDeleteTaskImage).toHaveBeenCalledWith(9, 1011);
      expect(mockDeleteTaskImage).toHaveBeenCalledWith(9, 1011);
    });
  });
});
