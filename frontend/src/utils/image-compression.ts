/**
 * Image Compression Utility
 * Compresses images before upload to reduce file size and prevent "length limit exceeded" errors
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeMB?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export interface CompressionResult {
  compressedFile: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  quality: number;
}

/**
 * Compress an image file to reduce its size
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const {
    maxWidth = 2048,
    maxHeight = 2048,
    quality = 0.8,
    maxSizeMB = 10,
    format = 'jpeg'
  } = options;

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      try {
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height;
          
          if (width > height) {
            width = Math.min(width, maxWidth);
            height = width / aspectRatio;
          } else {
            height = Math.min(height, maxHeight);
            width = height * aspectRatio;
          }
        }

        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;

        // Draw and compress the image
        ctx?.drawImage(img, 0, 0, width, height);

        // Convert to blob with compression
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            // Check if compressed size is acceptable
            const compressedSizeMB = blob.size / (1024 * 1024);
            
            // For now, accept any compression result to avoid infinite recursion
            // The smartCompressImage function will handle multiple attempts

            // Create new file with compressed data
            const compressedFile = new File(
              [blob],
              file.name.replace(/\.[^/.]+$/, `.${format}`),
              {
                type: `image/${format}`,
                lastModified: Date.now()
              }
            );

            const result: CompressionResult = {
              compressedFile,
              originalSize: file.size,
              compressedSize: blob.size,
              compressionRatio: (1 - blob.size / file.size) * 100,
              quality
            };

            resolve(result);
          },
          `image/${format}`,
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
 * Smart compression that automatically adjusts quality based on file size
 */
export async function smartCompressImage(
  file: File,
  targetSizeMB: number = 5
): Promise<CompressionResult> {
  const originalSizeMB = file.size / (1024 * 1024);
  
  // Always compress files larger than 1MB, regardless of target
  if (originalSizeMB <= 1) {
    return {
      compressedFile: file,
      originalSize: file.size,
      compressedSize: file.size,
      compressionRatio: 0,
      quality: 1
    };
  }

  // Try different quality levels until we get significant compression
  const qualityLevels = [0.6, 0.5, 0.4, 0.3, 0.2];
  
  for (const quality of qualityLevels) {
    try {
      const result = await compressImage(file, {
        maxWidth: 1200, // More aggressive dimension reduction
        maxHeight: 1200, // More aggressive dimension reduction
        quality,
        maxSizeMB: targetSizeMB,
        format: 'jpeg'
      });

      const compressedSizeMB = result.compressedSize / (1024 * 1024);
      const reductionRatio = result.compressionRatio;
      
      console.log(`Compression attempt: quality=${quality}, size=${compressedSizeMB.toFixed(2)}MB, reduction=${reductionRatio.toFixed(1)}%`);
      
      // Accept if we got at least 20% reduction or reached target size
      if (reductionRatio >= 20 || compressedSizeMB <= targetSizeMB) {
        return result;
      }
    } catch (error) {
      console.warn(`Compression failed at quality ${quality}:`, error);
    }
  }

  // If all attempts failed, return the original file
  console.warn('All compression attempts failed, returning original file');
  return {
    compressedFile: file,
    originalSize: file.size,
    compressedSize: file.size,
    compressionRatio: 0,
    quality: 1
  };
}

/**
 * Check if an image needs compression
 */
export function needsCompression(file: File, maxSizeMB: number = 10): boolean {
  const fileSizeMB = file.size / (1024 * 1024);
  return fileSizeMB > maxSizeMB;
}

/**
 * Get compression recommendations based on file size
 */
export function getCompressionRecommendations(file: File): {
  needsCompression: boolean;
  recommendedQuality: number;
  estimatedSizeMB: number;
  message: string;
} {
  const fileSizeMB = file.size / (1024 * 1024);
  
  if (fileSizeMB <= 5) {
    return {
      needsCompression: false,
      recommendedQuality: 0.9,
      estimatedSizeMB: fileSizeMB,
      message: 'File size is optimal, no compression needed'
    };
  } else if (fileSizeMB <= 10) {
    return {
      needsCompression: true,
      recommendedQuality: 0.8,
      estimatedSizeMB: fileSizeMB * 0.6,
      message: 'Light compression recommended for better upload performance'
    };
  } else if (fileSizeMB <= 20) {
    return {
      needsCompression: true,
      recommendedQuality: 0.7,
      estimatedSizeMB: fileSizeMB * 0.4,
      message: 'Moderate compression needed to reduce upload time'
    };
  } else {
    return {
      needsCompression: true,
      recommendedQuality: 0.5,
      estimatedSizeMB: fileSizeMB * 0.25,
      message: 'Heavy compression required to meet size limits'
    };
  }
}
