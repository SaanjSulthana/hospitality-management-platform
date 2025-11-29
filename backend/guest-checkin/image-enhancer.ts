/**
 * Image Enhancement for Document Extraction
 * Advanced preprocessing techniques to improve OCR accuracy
 */

import sharp from 'sharp';
// import log from "encore.dev/log";

/**
 * Enhance document image for better OCR
 * - Auto-rotate based on EXIF
 * - Normalize contrast
 * - Sharpen text
 * - Enhance brightness
 */
export async function enhanceDocumentImage(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer)
      .rotate() // Auto-rotate based on EXIF orientation
      .normalize() // Normalize contrast across the image
      .sharpen({ sigma: 1.5 }) // Sharpen text edges
      .modulate({ 
        brightness: 1.1,  // Slightly brighten
        saturation: 1.2   // Increase saturation for text clarity
      })
      .toBuffer();
  } catch (error) {
    console.error('Failed to enhance document image', error);
    return buffer; // Return original on error
  }
}

/**
 * Denoise image for stamps and watermarks
 * - Apply median filter to reduce noise
 * - Restore text clarity with sharpening
 */
export async function denoiseImage(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer)
      .median(3) // Median filter to reduce noise while preserving edges
      .sharpen() // Restore text clarity after noise reduction
      .toBuffer();
  } catch (error) {
    console.error('Failed to denoise image', error);
    return buffer;
  }
}

/**
 * Enhance contrast for faded documents
 * - Strong normalization
 * - Linear contrast adjustment
 */
export async function enhanceContrast(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer)
      .normalize() // Stretch histogram for better contrast
      .linear(1.5, -(128 * 1.5) + 128) // Increase contrast significantly
      .toBuffer();
  } catch (error) {
    console.error('Failed to enhance contrast', error);
    return buffer;
  }
}

/**
 * Binarization for stamps and seals
 * - Convert to grayscale
 * - Apply threshold for high contrast B&W
 */
export async function binarizeForStamps(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer)
      .greyscale() // Convert to grayscale
      .threshold(128) // Binary threshold at midpoint
      .toBuffer();
  } catch (error) {
    console.error('Failed to binarize image', error);
    return buffer;
  }
}

/**
 * Comprehensive preprocessing pipeline
 * Applies multiple enhancements and returns the best version
 */
export async function comprehensiveEnhancement(buffer: Buffer): Promise<{
  original: string;
  enhanced: string;
  highContrast: string;
}> {
  try {
    const [enhanced, highContrast] = await Promise.all([
      enhanceDocumentImage(buffer),
      enhanceContrast(buffer),
    ]);

    return {
      original: buffer.toString('base64'),
      enhanced: enhanced.toString('base64'),
      highContrast: highContrast.toString('base64'),
    };
  } catch (error) {
    console.error('Failed comprehensive enhancement', error);
    const base64 = buffer.toString('base64');
    return {
      original: base64,
      enhanced: base64,
      highContrast: base64,
    };
  }
}

/**
 * Detect if image needs enhancement
 * Analyzes image quality metrics
 */
export async function analyzeImageQuality(buffer: Buffer): Promise<{
  needsEnhancement: boolean;
  brightness: number;
  contrast: number;
}> {
  try {
    const stats = await sharp(buffer).stats();
    
    // Calculate average brightness across channels
    const avgBrightness = stats.channels.reduce((sum, ch) => sum + ch.mean, 0) / stats.channels.length;
    
    // Calculate average contrast (standard deviation)
    const avgContrast = stats.channels.reduce((sum, ch) => sum + ch.stdev, 0) / stats.channels.length;
    
    // Determine if enhancement is needed
    const needsEnhancement = avgBrightness < 100 || avgBrightness > 200 || avgContrast < 40;
    
    return {
      needsEnhancement,
      brightness: avgBrightness,
      contrast: avgContrast,
    };
  } catch (error) {
    console.error('Failed to analyze image quality', error);
    return {
      needsEnhancement: true, // Default to enhancement if analysis fails
      brightness: 128,
      contrast: 50,
    };
  }
}

