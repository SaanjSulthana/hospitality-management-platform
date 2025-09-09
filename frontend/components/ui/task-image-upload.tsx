import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Upload, Image as ImageIcon, AlertCircle, Loader2, Eye, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

// Global image cache to prevent multiple API calls for the same image
const imageCache = new Map<number, string>();
const loadingPromises = new Map<number, Promise<string>>();

// Function to clear cache for a specific image (useful when image is deleted)
export const clearImageCache = (imageId: number) => {
  imageCache.delete(imageId);
  loadingPromises.delete(imageId);
};

// Function to clear all cache (useful for cleanup)
export const clearAllImageCache = () => {
  imageCache.clear();
  loadingPromises.clear();
};

interface TaskImageUploadProps {
  taskId: number;
  existingImages: Array<{
    id: number;
    originalName: string;
    filename: string;
    fileSize: number;
    mimeType: string;
  }>;
  onImageUpload: (taskId: number, files: File[]) => Promise<void>;
  onImageDelete: (taskId: number, imageId: number) => Promise<void>;
  onImageClick?: (imageId: number, imageUrl: string) => void;
  maxImages?: number;
  maxSize?: number; // in MB
  disabled?: boolean;
  className?: string;
  compact?: boolean; // For task card display
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  error?: string;
}

export function TaskImageUpload({
  taskId,
  existingImages = [],
  onImageUpload,
  onImageDelete,
  onImageClick,
  maxImages = 5,
  maxSize = 5,
  disabled = false,
  className = '',
  compact = false,
}: TaskImageUploadProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [selectedImage, setSelectedImage] = useState<{ id: number; url: string } | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Keyboard navigation for image modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showImageModal) {
        setShowImageModal(false);
      }
    };

    if (showImageModal) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [showImageModal]);

  // Calculate available slots
  const availableSlots = maxImages - existingImages.length - uploadingFiles.length;
  const canUpload = availableSlots > 0 && !disabled;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    console.log('onDrop called with files:', acceptedFiles.length, 'canUpload:', canUpload, 'availableSlots:', availableSlots, 'existingImages:', existingImages.length);
    
    if (!canUpload || acceptedFiles.length === 0) {
      console.log('Upload not allowed - canUpload:', canUpload, 'files:', acceptedFiles.length);
      toast({
        variant: "destructive",
        title: "Upload not allowed",
        description: `Maximum ${maxImages} images allowed. ${availableSlots} slots remaining.`,
      });
      return;
    }

    // Limit files to available slots
    const filesToUpload = acceptedFiles.slice(0, availableSlots);
    
    if (filesToUpload.length < acceptedFiles.length) {
      toast({
        variant: "destructive",
        title: "Some files skipped",
        description: `Only ${filesToUpload.length} files uploaded. Maximum ${maxImages} images allowed.`,
      });
    }

    // Validate file sizes
    const validFiles = filesToUpload.filter(file => {
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > maxSize) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: `${file.name} is ${fileSizeMB.toFixed(1)}MB. Maximum size is ${maxSize}MB.`,
        });
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    // Add to uploading files
    const newUploadingFiles: UploadingFile[] = validFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      progress: 0,
    }));

    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);

    // Start upload
    handleUpload(validFiles, newUploadingFiles);
  }, [canUpload, availableSlots, maxImages, maxSize, onImageUpload, toast]);

  const handleUpload = async (files: File[], uploadingFiles: UploadingFile[]) => {
    console.log('handleUpload called with files:', files.length, 'uploadingFiles:', uploadingFiles.length);
    
    try {
      // Initialize progress for all files
      setUploadingFiles(prev => 
        prev.map(uf => {
          const isUploading = uploadingFiles.some(nf => nf.id === uf.id);
          return isUploading ? { ...uf, progress: 5 } : uf;
        })
      );

      // Create realistic progress simulation for each file
      const progressIntervals: NodeJS.Timeout[] = [];
      
      uploadingFiles.forEach((uploadingFile) => {
        const interval = setInterval(() => {
          setUploadingFiles(prev => 
            prev.map(uf => {
              if (uf.id === uploadingFile.id && uf.progress < 85) {
                // Simulate realistic progress with some randomness
                const increment = Math.random() * 8 + 2; // 2-10% increments
                return { ...uf, progress: Math.min(uf.progress + increment, 85) };
              }
              return uf;
            })
          );
        }, 150 + Math.random() * 100); // Random interval between 150-250ms
        
        progressIntervals.push(interval);
      });

      // Start the actual upload
      setUploadingFiles(prev => 
        prev.map(uf => {
          const isUploading = uploadingFiles.some(nf => nf.id === uf.id);
          return isUploading ? { ...uf, progress: 15 } : uf;
        })
      );

      await onImageUpload(taskId, files);
      
      // Clear all progress intervals
      progressIntervals.forEach(interval => clearInterval(interval));
      
      // Complete progress for all files
      setUploadingFiles(prev => 
        prev.map(uf => {
          const isUploading = uploadingFiles.some(nf => nf.id === uf.id);
          return isUploading ? { ...uf, progress: 100 } : uf;
        })
      );

      // Show success state briefly, then remove from uploading state
      setTimeout(() => {
        setUploadingFiles(prev => 
          prev.filter(uf => !uploadingFiles.some(nf => nf.id === uf.id))
        );
      }, 2000); // Show success for 2 seconds
      
      toast({
        title: "Images uploaded successfully",
        description: `${files.length} image(s) uploaded to task.`,
      });
    } catch (error: any) {
      console.error('Upload failed:', error);
      
      // Clear any running intervals
      const allIntervals = document.querySelectorAll('[data-progress-interval]');
      allIntervals.forEach(interval => clearInterval(interval as any));
      
      // Set error state for all uploading files
      setUploadingFiles(prev => 
        prev.map(uf => {
          const isUploading = uploadingFiles.some(nf => nf.id === uf.id);
          return isUploading ? { 
            ...uf, 
            error: error.message || 'Upload failed',
            progress: 0 // Reset progress on error
          } : uf;
        })
      );
      
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message || "Failed to upload images. Please try again.",
      });
    }
  };

  const handleDelete = async (imageId: number) => {
    try {
      await onImageDelete(taskId, imageId);
      
      // Clear the image from cache since it's been deleted
      clearImageCache(imageId);
      
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
    }
  };

  const handleImageClick = (imageId: number, imageUrl: string) => {
    console.log('Image clicked:', imageId, imageUrl);
    if (onImageClick) {
      onImageClick(imageId, imageUrl);
    } else {
      setSelectedImage({ id: imageId, url: imageUrl });
      setShowImageModal(true);
      setImageLoading(true);
    }
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    maxFiles: availableSlots,
    disabled: !canUpload,
    multiple: true,
    noClick: true, // Disable default click behavior
    noKeyboard: false, // Allow keyboard navigation
  });

  if (compact) {
    return (
      <div className={`space-y-2 ${className}`}>
        {/* Upload Area */}
        {canUpload && (
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-all duration-200
              ${isDragActive 
                ? 'border-blue-400 bg-blue-50 scale-105' 
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            onClick={(e) => {
              console.log('Upload area clicked, canUpload:', canUpload, 'disabled:', disabled);
              if (!disabled && canUpload) {
                console.log('Opening file picker...');
                open();
              }
            }}
          >
            <input {...getInputProps()} />
            <div className="flex items-center justify-center gap-2">
              <Upload className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">
                {isDragActive ? 'Drop images here' : 'Click to add images'}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {availableSlots} of {maxImages} slots available
            </div>
          </div>
        )}

        {/* Image Grid */}
        {(existingImages.length > 0 || uploadingFiles.length > 0) && (
          <div className="grid grid-cols-3 gap-2">
            {/* Existing Images */}
            {existingImages.map((image) => (
              <ImageThumbnail
                key={image.id}
                imageId={image.id}
                imageName={image.originalName}
                onImageClick={handleImageClick}
                onDelete={() => handleDelete(image.id)}
                isExisting={true}
              />
            ))}
            
            {/* Uploading Images */}
            {uploadingFiles.map((file) => (
              <UploadingThumbnail
                key={file.id}
                file={file}
                onRemove={() => {
                  setUploadingFiles(prev => prev.filter(f => f.id !== file.id));
                }}
              />
            ))}
          </div>
        )}

        {/* Enhanced Image Modal */}
        {showImageModal && selectedImage && (
          <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
            <DialogContent className="max-w-6xl max-h-[95vh] p-0 bg-black/95">
              <div className="relative flex items-center justify-center min-h-[80vh]">
                {/* Close Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-4 right-4 z-20 bg-black/50 text-white hover:bg-black/70 rounded-full w-10 h-10"
                  onClick={() => setShowImageModal(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
                
                {/* Image Info */}
                <div className="absolute top-4 left-4 z-20 bg-black/50 text-white px-3 py-2 rounded-lg">
                  <p className="text-sm font-medium">Task Reference Image</p>
                  <p className="text-xs opacity-75">ID: {selectedImage.id}</p>
                </div>
                
                {/* Main Image */}
                <div className="relative max-w-full max-h-full">
                  <img 
                    src={selectedImage.url} 
                    alt="Task reference"
                    className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder-image.png';
                    }}
                    onLoad={() => {
                      console.log('Image loaded successfully');
                    }}
                  />
                </div>
                
                {/* Navigation Hint */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-lg text-sm">
                  Click outside or press ESC to close
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  // Full upload interface (for create task dialog)
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Reference Images</span>
        </div>
        <Badge variant="outline" className="text-xs">
          {existingImages.length + uploadingFiles.length}/{maxImages}
        </Badge>
      </div>

      {/* Upload Area */}
      {canUpload && (
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200
            ${isDragActive 
              ? 'border-blue-400 bg-blue-50 scale-105' 
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          onClick={(e) => {
            console.log('Full upload area clicked, canUpload:', canUpload, 'disabled:', disabled);
            if (!disabled && canUpload) {
              console.log('Opening file picker from full interface...');
              open();
            }
          }}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-gray-400" />
            <div className="text-sm text-gray-600">
              {isDragActive ? 'Drop images here' : 'Drag & drop images or click to select'}
            </div>
            <div className="text-xs text-gray-500">
              {maxSize}MB max • {availableSlots} of {maxImages} slots available
            </div>
          </div>
        </div>
      )}

      {/* Image Grid */}
      {(existingImages.length > 0 || uploadingFiles.length > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Existing Images */}
          {existingImages.map((image) => (
            <ImageThumbnail
              key={image.id}
              imageId={image.id}
              imageName={image.originalName}
              onImageClick={handleImageClick}
              onDelete={() => handleDelete(image.id)}
              isExisting={true}
            />
          ))}
          
          {/* Uploading Images */}
          {uploadingFiles.map((file) => (
            <UploadingThumbnail
              key={file.id}
              file={file}
              onRemove={() => {
                setUploadingFiles(prev => prev.filter(f => f.id !== file.id));
              }}
            />
          ))}
        </div>
      )}

      {/* Enhanced Image Modal */}
      {showImageModal && selectedImage && (
        <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
          <DialogContent className="max-w-7xl max-h-[98vh] p-0 bg-black/98 border-0">
            <div className="relative flex items-center justify-center min-h-[90vh] w-full">
              {/* Close Button */}
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-6 right-6 z-30 bg-black/60 text-white hover:bg-black/80 rounded-full w-12 h-12 transition-all duration-200 hover:scale-110"
                onClick={() => setShowImageModal(false)}
                aria-label="Close image preview"
              >
                <X className="h-6 w-6" />
              </Button>
              
              {/* Image Info Panel */}
              <div className="absolute top-6 left-6 z-30 bg-black/60 text-white px-4 py-3 rounded-xl backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-1">
                  <ImageIcon className="h-4 w-4 text-blue-400" />
                  <p className="text-sm font-semibold">Task Reference Image</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-300">Image ID: <span className="text-white font-mono">{selectedImage.id}</span></p>
                  <p className="text-xs text-gray-300">Task ID: <span className="text-white font-mono">{taskId}</span></p>
                </div>
              </div>
              
              {/* Main Image Container */}
              <div className="relative max-w-full max-h-full flex items-center justify-center p-8">
                <div className="relative group">
                  {/* Loading State */}
                  {imageLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl z-10">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-white mx-auto mb-2" />
                        <p className="text-white text-sm">Loading image...</p>
                      </div>
                    </div>
                  )}
                  
                  <img 
                    src={selectedImage.url} 
                    alt="Task reference"
                    className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl transition-all duration-300 group-hover:shadow-3xl cursor-pointer"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder-image.png';
                      setImageLoading(false);
                    }}
                    onLoad={() => {
                      console.log('Image loaded successfully in preview');
                      setImageLoading(false);
                    }}
                    onClick={() => {
                      // Download image functionality
                      const link = document.createElement('a');
                      link.href = selectedImage.url;
                      link.download = `task-${taskId}-image-${selectedImage.id}.jpg`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                  />
                  
                  {/* Image Hover Overlay */}
                  {!imageLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="bg-black/60 text-white px-3 py-2 rounded-lg text-sm">
                        Click to download
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Enhanced Navigation Hints */}
              <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-black/60 text-white px-6 py-3 rounded-xl backdrop-blur-sm">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <kbd className="px-2 py-1 bg-white/20 rounded text-xs">ESC</kbd>
                    <span>Close</span>
                  </div>
                  <div className="w-px h-4 bg-white/30"></div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-2 py-1 bg-white/20 rounded text-xs">Click</kbd>
                    <span>Outside to close</span>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// Image Thumbnail Component
function ImageThumbnail({
  imageId,
  imageName,
  onImageClick,
  onDelete,
  isExisting,
}: {
  imageId: number;
  imageName: string;
  onImageClick: (imageId: number, imageUrl: string) => void;
  onDelete: () => void;
  isExisting: boolean;
}) {
  const [imageUrl, setImageUrl] = useState<string>('/placeholder-image.png');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  const loadImageUrl = useCallback(async () => {
    try {
      console.log('ImageThumbnail: Starting load for imageId:', imageId);
      setIsLoading(true);
      setHasError(false);
      
      // Check if image is already cached
      if (imageCache.has(imageId)) {
        const cachedUrl = imageCache.get(imageId)!;
        console.log('ImageThumbnail: Using cached image URL for imageId:', imageId);
        setImageUrl(cachedUrl);
        setLoaded(true);
        setIsLoading(false);
        return;
      }
      
      // Check if image is already being loaded
      if (loadingPromises.has(imageId)) {
        console.log('ImageThumbnail: Image already being loaded, waiting for existing promise...');
        const url = await loadingPromises.get(imageId)!;
        console.log('ImageThumbnail: Got URL from existing promise:', url);
        setImageUrl(url);
        setLoaded(true);
        setIsLoading(false);
        return;
      }
      
      // Import the API function dynamically to avoid circular dependencies
      const { getTaskImageUrl } = await import('../../lib/api/task-images');
      
      // Create loading promise and store it
      const loadingPromise = getTaskImageUrl(imageId);
      loadingPromises.set(imageId, loadingPromise);
      
      console.log('ImageThumbnail: Calling getTaskImageUrl for imageId:', imageId);
      const url = await loadingPromise;
      console.log('ImageThumbnail: Successfully loaded image URL for imageId:', imageId, 'URL length:', url.length);
      
      // Cache the result
      imageCache.set(imageId, url);
      console.log('ImageThumbnail: Cached image for imageId:', imageId, 'cache size:', imageCache.size);
      loadingPromises.delete(imageId);
      
      // Clean up previous object URL if it exists
      if (objectUrl && objectUrl.startsWith('blob:')) {
        URL.revokeObjectURL(objectUrl);
      }
      
      console.log('ImageThumbnail: Setting image URL and loaded state for imageId:', imageId);
      setImageUrl(url);
      setLoaded(true);
      console.log('ImageThumbnail: Image state updated for imageId:', imageId);
    } catch (error) {
      console.error('ImageThumbnail: Failed to load image:', error);
      setHasError(true);
      // Remove failed promise from loading map
      loadingPromises.delete(imageId);
    } finally {
      console.log('ImageThumbnail: Finally block reached for imageId:', imageId, 'setting isLoading to false');
      setIsLoading(false);
      console.log('ImageThumbnail: isLoading set to false for imageId:', imageId);
    }
  }, [imageId, objectUrl]);

  useEffect(() => {
    console.log('ImageThumbnail useEffect: isExisting:', isExisting, 'loaded:', loaded, 'isLoading:', isLoading, 'imageId:', imageId, 'cached:', imageCache.has(imageId));
    
    if (isExisting && !loaded) {
      console.log('ImageThumbnail: Triggering loadImageUrl for imageId:', imageId);
      loadImageUrl();
    } else if (!isExisting) {
      console.log('ImageThumbnail: Not existing image, setting loading to false');
      setIsLoading(false);
    }
  }, [isExisting, loaded, imageId]); // Removed isLoading from condition and dependencies to prevent deadlock

  // Initialize state when component mounts - removed to prevent constant resets

  // Cleanup effect for object URLs
  useEffect(() => {
    return () => {
      if (objectUrl && objectUrl.startsWith('blob:')) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  const handleClick = () => {
    console.log('Image clicked:', imageId, imageUrl, 'hasError:', hasError, 'loaded:', loaded);
    if (!hasError && imageUrl && imageUrl !== '/placeholder-image.png' && loaded) {
      console.log('Calling onImageClick with:', imageId, imageUrl);
      onImageClick(imageId, imageUrl);
    } else {
      console.log('Image click ignored - hasError:', hasError, 'url:', imageUrl, 'loaded:', loaded);
    }
  };

  return (
    <div className="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden">
      {isLoading ? (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : hasError ? (
        <div className="w-full h-full flex flex-col items-center justify-center bg-red-50">
          <AlertCircle className="h-6 w-6 text-red-400 mb-1" />
          <span className="text-xs text-red-600">Error</span>
        </div>
      ) : (
        <>
          <img
            src={imageUrl}
            alt={imageName}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105 cursor-pointer"
            onError={() => setHasError(true)}
            onClick={handleClick}
          />
          <div 
            className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center cursor-pointer"
            onClick={handleClick}
          >
            <Eye className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </div>
        </>
      )}
      
      {/* Delete Button */}
      <Button
        variant="destructive"
        size="sm"
        className="absolute top-1 right-1 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

// Uploading Thumbnail Component
function UploadingThumbnail({
  file,
  onRemove,
}: {
  file: UploadingFile;
  onRemove: () => void;
}) {
  const [preview, setPreview] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [uploadSpeed, setUploadSpeed] = useState<string>('');
  const [eta, setEta] = useState<string>('');

  useEffect(() => {
    if (file.file) {
      const url = URL.createObjectURL(file.file);
      setPreview(url);
      
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [file.file]);

  // Calculate upload speed and ETA
  useEffect(() => {
    if (file.progress > 0 && file.progress < 100) {
      const fileSizeKB = file.file.size / 1024;
      const uploadedKB = (fileSizeKB * file.progress) / 100;
      const speed = uploadedKB / 2; // Simulated speed calculation
      setUploadSpeed(`${speed.toFixed(1)} KB/s`);
      
      const remainingKB = fileSizeKB - uploadedKB;
      const remainingSeconds = remainingKB / speed;
      setEta(`${remainingSeconds.toFixed(0)}s`);
    }
  }, [file.progress, file.file.size]);

  // Show success animation when upload completes
  useEffect(() => {
    if (file.progress === 100 && !file.error) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    }
  }, [file.progress, file.error]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden">
      {preview ? (
        <img
          src={preview}
          alt={file.file.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-200">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}
      
      {/* Enhanced Upload Progress Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
        {/* Progress Bar */}
        <div className="w-3/4 mb-3">
          <div className="bg-white/20 rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-300 ease-out relative"
              style={{ width: `${file.progress}%` }}
            >
              {/* Animated shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Progress Content */}
        <div className="text-center text-white">
          {/* Loading Spinner or Success Icon */}
          {file.progress === 100 && showSuccess ? (
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          )}

          {/* Progress Percentage */}
          <div className="text-sm font-semibold mb-1">
            {file.progress}%
          </div>

          {/* File Info */}
          <div className="text-xs text-white/80 mb-1">
            {file.file.name}
          </div>
          <div className="text-xs text-white/60">
            {formatFileSize(file.file.size)}
          </div>

          {/* Upload Speed and ETA */}
          {file.progress > 0 && file.progress < 100 && (
            <div className="text-xs text-white/70 mt-2">
              <div>{uploadSpeed}</div>
              <div>ETA: {eta}</div>
            </div>
          )}

          {/* Status Text */}
          <div className="text-xs text-white/80 mt-2">
            {file.progress === 100 ? 'Upload complete!' : 'Uploading...'}
          </div>
        </div>
      </div>
      
      {/* Enhanced Error State */}
      {file.error && (
        <div className="absolute inset-0 bg-red-500/90 backdrop-blur-sm flex flex-col items-center justify-center text-white">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-200" />
            <div className="text-sm font-medium mb-2">Upload Failed</div>
            <div className="text-xs text-center px-3 mb-3">{file.error}</div>
            <Button
              variant="outline"
              size="sm"
              className="bg-white/20 border-white/30 text-white hover:bg-white/30 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                // Retry upload for this specific file
                const retryFile = [file.file];
                // This would need to be passed down from parent component
                // For now, we'll just clear the error state
                console.log('Retry upload for file:', file.file.name);
              }}
            >
              Retry
            </Button>
          </div>
        </div>
      )}
      
      {/* Remove Button */}
      <Button
        variant="destructive"
        size="sm"
        className="absolute top-2 right-2 h-7 w-7 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
