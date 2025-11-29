/**
 * Image compression utility for large image files
 * Uses Canvas API for client-side compression to reduce upload time and storage
 */

export interface CompressionOptions {
  maxSize?: number; // in bytes, default 10MB
  quality?: number; // 0-1, default 0.8
  maxWidth?: number; // optional max width
  maxHeight?: number; // optional max height
}

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  wasCompressed: boolean;
}

/**
 * Compress an image file if it's larger than the specified threshold
 * Only compresses image files (not PDFs or other document types)
 */
export async function compressImageIfNeeded(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    quality = 0.8,
    maxWidth = 2048,
    maxHeight = 2048
  } = options;

  const originalSize = file.size;

  // Check if file is an image and if compression is needed
  if (!file.type.startsWith('image/') || originalSize <= maxSize) {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 1,
      wasCompressed: false
    };
  }

  try {
    console.log(`Compressing image: ${file.name} (${formatFileSize(originalSize)})`);
    
    const compressedFile = await compressImage(file, quality, maxWidth, maxHeight);
    const compressedSize = compressedFile.size;
    const compressionRatio = originalSize / compressedSize;

    console.log(`Compression complete: ${formatFileSize(originalSize)} → ${formatFileSize(compressedSize)} (${compressionRatio.toFixed(1)}x reduction)`);

    return {
      file: compressedFile,
      originalSize,
      compressedSize,
      compressionRatio,
      wasCompressed: true
    };
  } catch (error) {
    console.error('Image compression failed:', error);
    // Return original file if compression fails
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 1,
      wasCompressed: false
    };
  }
}

/**
 * Compress an image using Canvas API
 */
async function compressImage(
  file: File,
  quality: number,
  maxWidth: number,
  maxHeight: number
): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      try {
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = calculateDimensions(
          img.width,
          img.height,
          maxWidth,
          maxHeight
        );

        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;

        if (!ctx) {
          throw new Error('Canvas context not available');
        }

        // Draw and compress the image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob with specified quality
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            // Create new file with compressed data
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: file.lastModified
            });

            resolve(compressedFile);
          },
          file.type,
          quality
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for compression'));
    };

    // Load the image
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Calculate new dimensions while maintaining aspect ratio
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = originalWidth;
  let height = originalHeight;

  // Scale down if necessary while maintaining aspect ratio
  if (width > maxWidth || height > maxHeight) {
    const aspectRatio = width / height;

    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspectRatio;
    }

    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }
  }

  return {
    width: Math.round(width),
    height: Math.round(height)
  };
}

/**
 * Convert buffer to base64 using chunked approach to avoid stack overflow
 */
export function bufferToBase64(buffer: Uint8Array): string {
  const chunkSize = 8192; // Process in 8KB chunks
  let binaryString = '';
  
  for (let i = 0; i < buffer.length; i += chunkSize) {
    const chunk = buffer.slice(i, i + chunkSize);
    binaryString += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binaryString);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Check if file type is supported for compression
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Check if file should be compressed based on size and type
 */
export function shouldCompress(file: File, maxSize: number = 10 * 1024 * 1024): boolean {
  return isImageFile(file) && file.size > maxSize;
}
