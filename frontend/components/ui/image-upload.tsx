import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Upload, Image as ImageIcon, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface ImageFile {
  id: string;
  file: File;
  preview: string;
  isUploading?: boolean;
  error?: string;
}

interface ImageUploadProps {
  onImagesChange: (images: ImageFile[]) => void;
  maxImages?: number;
  maxSize?: number; // in MB
  disabled?: boolean;
  className?: string;
}

export function ImageUpload({
  onImagesChange,
  maxImages = 5,
  maxSize = 5,
  disabled = false,
  className = '',
}: ImageUploadProps) {
  const [images, setImages] = useState<ImageFile[]>([]);
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      rejectedFiles.forEach(({ file, errors }) => {
        errors.forEach((error: any) => {
          if (error.code === 'file-too-large') {
            toast({
              variant: 'destructive',
              title: 'File too large',
              description: `${file.name} is larger than ${maxSize}MB`,
            });
          } else if (error.code === 'file-invalid-type') {
            toast({
              variant: 'destructive',
              title: 'Invalid file type',
              description: `${file.name} is not a supported image format`,
            });
          }
        });
      });
    }

    // Handle accepted files
    if (acceptedFiles.length > 0) {
      const newImages: ImageFile[] = acceptedFiles.map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview: URL.createObjectURL(file),
      }));

      const updatedImages = [...images, ...newImages].slice(0, maxImages);
      setImages(updatedImages);
      onImagesChange(updatedImages);

      if (acceptedFiles.length > 0) {
        toast({
          title: 'Images added',
          description: `${acceptedFiles.length} image(s) added successfully`,
        });
      }
    }
  }, [images, maxImages, maxSize, onImagesChange, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    maxSize: maxSize * 1024 * 1024, // Convert MB to bytes
    maxFiles: maxImages - images.length,
    disabled: disabled || images.length >= maxImages,
  });

  const removeImage = (imageId: string) => {
    const updatedImages = images.filter((img) => img.id !== imageId);
    setImages(updatedImages);
    onImagesChange(updatedImages);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Compact Upload Area */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-all duration-200
          ${isDragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }
          ${disabled || images.length >= maxImages 
            ? 'opacity-50 cursor-not-allowed' 
            : ''
          }
        `}
      >
        <input {...getInputProps()} />
        <div className="flex items-center justify-center gap-2">
          <div className="p-1.5 bg-blue-100 rounded-full">
            <Upload className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-left">
            <p className="text-xs font-medium text-gray-900">
              {isDragActive ? 'Drop images here' : 'Upload images'}
            </p>
            <p className="text-xs text-gray-500">
              {maxSize}MB max • {maxImages} images
            </p>
          </div>
        </div>
      </div>

      {/* Compact Image Previews */}
      {images.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Uploaded</span>
            <Badge variant="outline" className="text-xs h-5">
              {images.length}/{maxImages}
            </Badge>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            {images.map((image) => (
              <div key={image.id} className="relative group">
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={image.preview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                
                {/* Remove Button */}
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  onClick={() => removeImage(image.id)}
                  disabled={disabled}
                >
                  <X className="h-3 w-3" />
                </Button>
                
                {/* Upload Status */}
                {image.isUploading && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  </div>
                )}
                
                {image.error && (
                  <div className="absolute inset-0 bg-red-500 bg-opacity-90 flex items-center justify-center rounded-lg">
                    <AlertCircle className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
