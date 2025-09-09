import { useState, useEffect, useCallback, useRef } from 'react';
import { getTaskImageUrl, TaskImage } from '../lib/api/task-images';

interface ImageUrlCache {
  [imageId: number]: string;
}

interface LoadingState {
  [imageId: number]: boolean;
}

export function useTaskImages(taskId: number, referenceImages: TaskImage[]) {
  const [imageUrls, setImageUrls] = useState<ImageUrlCache>({});
  const [loadingImages, setLoadingImages] = useState<LoadingState>({});
  const [errorImages, setErrorImages] = useState<Set<number>>(new Set());
  const loadingRef = useRef<Set<number>>(new Set());
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadImageUrl = useCallback(async (image: TaskImage) => {
    // Skip if already loading, loaded, or errored
    if (
      loadingRef.current.has(image.id) ||
      imageUrls[image.id] ||
      errorImages.has(image.id)
    ) {
      return;
    }

    // Mark as loading
    loadingRef.current.add(image.id);
    setLoadingImages(prev => ({ ...prev, [image.id]: true }));

    try {
      const url = await getTaskImageUrl(image.id);
      
      // Only update state if component is still mounted
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
      
      // Only update state if component is still mounted
      if (mountedRef.current) {
        setErrorImages(prev => new Set(prev).add(image.id));
      }
    } finally {
      // Only update state if component is still mounted
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

  // Load images when referenceImages change
  useEffect(() => {
    if (!referenceImages || referenceImages.length === 0) {
      return;
    }

    // Load images that aren't already loaded, loading, or errored
    const imagesToLoad = referenceImages.filter(image => 
      !imageUrls[image.id] && 
      !loadingRef.current.has(image.id) && 
      !errorImages.has(image.id)
    );

    imagesToLoad.forEach(image => {
      loadImageUrl(image);
    });
  }, [referenceImages, loadImageUrl, imageUrls, errorImages]);

  // Clean up URLs when images are removed
  useEffect(() => {
    const currentImageIds = new Set(referenceImages.map(img => img.id));
    
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
  }, [referenceImages]);

  const getImageUrl = useCallback((imageId: number) => {
    return imageUrls[imageId] || '/placeholder-image.png';
  }, [imageUrls]);

  const isImageLoading = useCallback((imageId: number) => {
    return loadingImages[imageId] || false;
  }, [loadingImages]);

  const hasImageError = useCallback((imageId: number) => {
    return errorImages.has(imageId);
  }, [errorImages]);

  const retryImage = useCallback((imageId: number) => {
    const image = referenceImages.find(img => img.id === imageId);
    if (image) {
      setErrorImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(imageId);
        return newSet;
      });
      loadImageUrl(image);
    }
  }, [referenceImages, loadImageUrl]);

  return {
    getImageUrl,
    isImageLoading,
    hasImageError,
    retryImage,
    loadedCount: Object.keys(imageUrls).length,
    totalCount: referenceImages.length,
  };
}
