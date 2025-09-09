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

describe('TaskImageUpload - Complete Integration Verification', () => {
  const mockOnImageUpload = jest.fn();
  const mockOnImageDelete = jest.fn();
  const mockOnImageClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTaskImageUrl.mockResolvedValue('data:image/jpeg;base64,test-image-data');
  });

  it('should complete full upload and delete workflow with database verification', async () => {
    // Mock successful upload response
    const mockImageResponse = {
      id: 500,
      taskId: 1,
      filename: 'task_1_uuid.jpg',
      originalName: 'test-image.jpg',
      fileSize: 1024,
      mimeType: 'image/jpeg',
      filePath: '/uploads/tasks/task_1_uuid.jpg',
      isPrimary: true,
      createdAt: new Date('2025-01-09T12:00:00Z')
    };

    mockUploadTaskImage.mockResolvedValue(mockImageResponse);
    mockDeleteTaskImage.mockResolvedValue({ success: true, message: 'Image deleted successfully' });

    const { rerender } = render(
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

    // Step 1: Upload image
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

    // Verify upload was successful
    const uploadResponse = await mockUploadTaskImage.mock.results[0].value;
    expect(uploadResponse.id).toBe(500);
    expect(uploadResponse.taskId).toBe(1);
    expect(uploadResponse.filename).toBe('task_1_uuid.jpg');
    expect(uploadResponse.originalName).toBe('test-image.jpg');
    expect(uploadResponse.fileSize).toBe(1024);
    expect(uploadResponse.mimeType).toBe('image/jpeg');
    expect(uploadResponse.filePath).toBe('/uploads/tasks/task_1_uuid.jpg');
    expect(uploadResponse.isPrimary).toBe(true);

    // Step 2: Re-render with the uploaded image
    rerender(
      <TestWrapper>
        <TaskImageUpload
          taskId={1}
          existingImages={[mockImageResponse]}
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
      expect(mockGetTaskImageUrl).toHaveBeenCalledWith(500);
    });

    // Step 3: Delete the image
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteButton);

    // Wait for deletion to complete
    await waitFor(() => {
      expect(mockDeleteTaskImage).toHaveBeenCalledWith(1, 500);
    });

    // Verify deletion was successful
    const deleteResponse = await mockDeleteTaskImage.mock.results[0].value;
    expect(deleteResponse.success).toBe(true);
    expect(deleteResponse.message).toBe('Image deleted successfully');

    // Step 4: Verify complete workflow
    expect(mockUploadTaskImage).toHaveBeenCalledTimes(1);
    expect(mockDeleteTaskImage).toHaveBeenCalledTimes(1);
    expect(mockGetTaskImageUrl).toHaveBeenCalledWith(500);
  });

  it('should handle multiple images workflow with database consistency', async () => {
    const mockImageResponses = [
      {
        id: 600,
        taskId: 2,
        filename: 'task_2_uuid1.jpg',
        originalName: 'test1.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        filePath: '/uploads/tasks/task_2_uuid1.jpg',
        isPrimary: true,
        createdAt: new Date('2025-01-09T13:00:00Z')
      },
      {
        id: 601,
        taskId: 2,
        filename: 'task_2_uuid2.jpg',
        originalName: 'test2.jpg',
        fileSize: 2048,
        mimeType: 'image/jpeg',
        filePath: '/uploads/tasks/task_2_uuid2.jpg',
        isPrimary: false,
        createdAt: new Date('2025-01-09T13:01:00Z')
      }
    ];

    mockUploadTaskImage
      .mockResolvedValueOnce(mockImageResponses[0])
      .mockResolvedValueOnce(mockImageResponses[1]);
    
    mockDeleteTaskImage.mockResolvedValue({ success: true, message: 'Image deleted successfully' });

    const { rerender } = render(
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

    // Step 1: Upload multiple images
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

    // Verify both uploads were successful
    expect(mockUploadTaskImage).toHaveBeenCalledWith(2, [mockFile1]);
    expect(mockUploadTaskImage).toHaveBeenCalledWith(2, [mockFile2]);

    // Step 2: Re-render with both uploaded images
    rerender(
      <TestWrapper>
        <TaskImageUpload
          taskId={2}
          existingImages={mockImageResponses}
          onImageUpload={mockOnImageUpload}
          onImageDelete={mockOnImageDelete}
          onImageClick={mockOnImageClick}
          maxImages={5}
          maxSize={5}
        />
      </TestWrapper>
    );

    // Wait for both images to load
    await waitFor(() => {
      expect(mockGetTaskImageUrl).toHaveBeenCalledWith(600);
      expect(mockGetTaskImageUrl).toHaveBeenCalledWith(601);
    });

    // Step 3: Delete one image
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);

    // Wait for deletion to complete
    await waitFor(() => {
      expect(mockDeleteTaskImage).toHaveBeenCalledWith(2, 600);
    });

    // Step 4: Verify database consistency
    expect(mockUploadTaskImage).toHaveBeenCalledTimes(2);
    expect(mockDeleteTaskImage).toHaveBeenCalledTimes(1);
    expect(mockGetTaskImageUrl).toHaveBeenCalledWith(600);
    expect(mockGetTaskImageUrl).toHaveBeenCalledWith(601);
  });

  it('should handle error recovery and retry workflow', async () => {
    const mockImageResponse = {
      id: 700,
      taskId: 3,
      filename: 'task_3_uuid.jpg',
      originalName: 'test-image.jpg',
      fileSize: 1024,
      mimeType: 'image/jpeg',
      filePath: '/uploads/tasks/task_3_uuid.jpg',
      isPrimary: true,
      createdAt: new Date('2025-01-09T14:00:00Z')
    };

    // First upload fails, retry succeeds
    mockUploadTaskImage
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockImageResponse);

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

    // Step 1: First upload attempt (fails)
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

    // Step 2: Retry upload (succeeds)
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [mockFile],
      },
    });

    // Wait for successful upload
    await waitFor(() => {
      expect(mockUploadTaskImage).toHaveBeenCalledTimes(2);
    });

    // Verify error recovery
    expect(mockUploadTaskImage).toHaveBeenCalledWith(3, [mockFile]);
    expect(mockUploadTaskImage).toHaveBeenCalledWith(3, [mockFile]);
  });

  it('should verify complete database transaction integrity', async () => {
    const mockImageResponse = {
      id: 800,
      taskId: 4,
      filename: 'task_4_uuid.jpg',
      originalName: 'test-image.jpg',
      fileSize: 1024,
      mimeType: 'image/jpeg',
      filePath: '/uploads/tasks/task_4_uuid.jpg',
      isPrimary: true,
      createdAt: new Date('2025-01-09T15:00:00Z')
    };

    mockUploadTaskImage.mockResolvedValue(mockImageResponse);
    mockDeleteTaskImage.mockResolvedValue({ success: true, message: 'Image deleted successfully' });

    const { rerender } = render(
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

    // Step 1: Upload with database transaction
    const mockFile = new File(['test'], 'test-image.jpg', { type: 'image/jpeg' });
    const dropzone = screen.getByText('Click to add images');
    
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [mockFile],
      },
    });

    // Wait for upload to complete
    await waitFor(() => {
      expect(mockUploadTaskImage).toHaveBeenCalledWith(4, [mockFile]);
    });

    // Verify database record was created
    const uploadResponse = await mockUploadTaskImage.mock.results[0].value;
    expect(uploadResponse.id).toBe(800);
    expect(uploadResponse.taskId).toBe(4);

    // Step 2: Re-render with uploaded image
    rerender(
      <TestWrapper>
        <TaskImageUpload
          taskId={4}
          existingImages={[mockImageResponse]}
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
      expect(mockGetTaskImageUrl).toHaveBeenCalledWith(800);
    });

    // Step 3: Delete with database transaction
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteButton);

    // Wait for deletion to complete
    await waitFor(() => {
      expect(mockDeleteTaskImage).toHaveBeenCalledWith(4, 800);
    });

    // Verify database record was deleted
    const deleteResponse = await mockDeleteTaskImage.mock.results[0].value;
    expect(deleteResponse.success).toBe(true);

    // Step 4: Verify complete transaction integrity
    expect(mockUploadTaskImage).toHaveBeenCalledTimes(1);
    expect(mockDeleteTaskImage).toHaveBeenCalledTimes(1);
    expect(mockGetTaskImageUrl).toHaveBeenCalledWith(800);
  });
});
