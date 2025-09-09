import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { uploadTaskImage, deleteTaskImage, getTaskImageUrl, TaskImage } from '../lib/api/task-images';
import { useToast } from '../components/ui/use-toast';

interface UseTaskImageManagementProps {
  taskId: number;
  existingImages: TaskImage[];
}

interface ImageUrlCache {
  [imageId: number]: string;
}

interface LoadingState {
  [imageId: number]: boolean;
}

export function useTaskImageManagement({ taskId, existingImages }: UseTaskImageManagementProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [imageUrls, setImageUrls] = useState<ImageUrlCache>({});
  const [loadingImages, setLoadingImages] = useState<LoadingState>({});
  const [errorImages, setErrorImages] = useState<Set<number>>(new Set());
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  
  const loadingRef = useRef<Set<number>>(new Set());
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load image URL for a specific image
  const loadImageUrl = useCallback(async (image: TaskImage) => {
    if (
      loadingRef.current.has(image.id) ||
      imageUrls[image.id] ||
      errorImages.has(image.id)
    ) {
      return;
    }

    loadingRef.current.add(image.id);
    setLoadingImages(prev => ({ ...prev, [image.id]: true }));

    try {
      const url = await getTaskImageUrl(image.id);
      
      if (mountedRef.current) {
        setImageUrls(prev => ({ ...prev, [image.id]: url }));
        setErrorImages(prev => {
          const newSet = new Set(prev);
          newSet.delete(image.id);
          return newSet;
        });
      }
    } catch (error) {
      console.error('Failed to load image URL:', error);
      
      if (mountedRef.current) {
        setErrorImages(prev => new Set(prev).add(image.id));
      }
    } finally {
      if (mountedRef.current) {
        loadingRef.current.delete(image.id);
        setLoadingImages(prev => {
          const newState = { ...prev };
          delete newState[image.id];
          return newState;
        });
      }
    }
  }, [imageUrls, errorImages]);

  // Load all images when existingImages change
  useEffect(() => {
    if (!existingImages || existingImages.length === 0) {
      return;
    }

    const imagesToLoad = existingImages.filter(image => 
      !imageUrls[image.id] && 
      !loadingRef.current.has(image.id) && 
      !errorImages.has(image.id)
    );

    imagesToLoad.forEach(image => {
      loadImageUrl(image);
    });
  }, [existingImages, loadImageUrl, imageUrls, errorImages]);

  // Clean up URLs when images are removed
  useEffect(() => {
    const currentImageIds = new Set(existingImages.map(img => img.id));
    
    setImageUrls(prev => {
      const newUrls = { ...prev };
      Object.keys(newUrls).forEach(key => {
        const imageId = parseInt(key);
        if (!currentImageIds.has(imageId)) {
          delete newUrls[imageId];
        }
      });
      return newUrls;
    });

    setLoadingImages(prev => {
      const newLoading = { ...prev };
      Object.keys(newLoading).forEach(key => {
        const imageId = parseInt(key);
        if (!currentImageIds.has(imageId)) {
          delete newLoading[imageId];
        }
      });
      return newLoading;
    });

    setErrorImages(prev => {
      const newErrors = new Set(prev);
      prev.forEach(imageId => {
        if (!currentImageIds.has(imageId)) {
          newErrors.delete(imageId);
        }
      });
      return newErrors;
    });
  }, [existingImages]);

  // Upload images
  const uploadImages = useCallback(async (files: File[]) => {
    const fileIds = files.map(() => Math.random().toString(36).substr(2, 9));
    
    // Add to uploading state
    setUploadingFiles(prev => new Set([...prev, ...fileIds]));

    try {
      const uploadPromises = files.map(async (file, index) => {
        const fileId = fileIds[index];
        
        try {
          // Upload with progress tracking
          const uploadedImage = await uploadTaskImage(taskId, file, (progress) => {
            // Update progress in the uploading files state
            // This would need to be handled by the parent component
            console.log(`Upload progress for ${file.name}: ${progress}%`);
          });
          
          // Remove from uploading state
          setUploadingFiles(prev => {
            const newSet = new Set(prev);
            newSet.delete(fileId);
            return newSet;
          });
          
          return uploadedImage;
        } catch (error) {
          // Remove from uploading state even on error
          setUploadingFiles(prev => {
            const newSet = new Set(prev);
            newSet.delete(fileId);
            return newSet;
          });
          throw error;
        }
      });

      await Promise.all(uploadPromises);
      
      // Invalidate tasks query to refresh the data
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      console.log('Invalidated tasks query after upload');
      
      toast({
        title: "Images uploaded successfully",
        description: `${files.length} image(s) uploaded to task.`,
      });
    } catch (error: any) {
      console.error('Upload failed:', error);
      
      // Remove all files from uploading state
      setUploadingFiles(prev => {
        const newSet = new Set(prev);
        fileIds.forEach(id => newSet.delete(id));
        return newSet;
      });
      
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message || "Failed to upload images. Please try again.",
      });
      throw error;
    }
  }, [taskId, queryClient, toast]);

  // Delete image
  const deleteImage = useCallback(async (imageId: number) => {
    try {
      await deleteTaskImage(taskId, imageId);
      
      // Invalidate tasks query to refresh the data
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      
      toast({
        title: "Image deleted",
        description: "Image has been removed from task.",
      });
    } catch (error: any) {
      console.error('Delete failed:', error);
      
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error.message || "Failed to delete image. Please try again.",
      });
      throw error;
    }
  }, [taskId, queryClient, toast]);

  // Retry loading an image
  const retryImage = useCallback((imageId: number) => {
    const image = existingImages.find(img => img.id === imageId);
    if (image) {
      setErrorImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(imageId);
        return newSet;
      });
      loadImageUrl(image);
    }
  }, [existingImages, loadImageUrl]);

  // Get image URL
  const getImageUrl = useCallback((imageId: number) => {
    return imageUrls[imageId] || '/placeholder-image.png';
  }, [imageUrls]);

  // Check if image is loading
  const isImageLoading = useCallback((imageId: number) => {
    return loadingImages[imageId] || false;
  }, [loadingImages]);

  // Check if image has error
  const hasImageError = useCallback((imageId: number) => {
    return errorImages.has(imageId);
  }, [errorImages]);

  // Check if any files are uploading
  const isUploading = uploadingFiles.size > 0;

  return useMemo(() => ({
    // Image management
    getImageUrl,
    isImageLoading,
    hasImageError,
    retryImage,
    
    // Upload/Delete actions
    uploadImages,
    deleteImage,
    isUploading,
    
    // Stats
    loadedCount: Object.keys(imageUrls).length,
    totalCount: existingImages.length,
    uploadingCount: uploadingFiles.size,
  }), [
    getImageUrl,
    isImageLoading,
    hasImageError,
    retryImage,
    uploadImages,
    deleteImage,
    isUploading,
    imageUrls,
    existingImages.length,
    uploadingFiles.size
  ]);
}
