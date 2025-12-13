/**
 * Compression Middleware
 * 
 * Provides Brotli and gzip compression for responses > 1KB.
 * Tracks compression ratio metrics for monitoring.
 */

import { gzipSync, brotliCompressSync, constants } from 'zlib';
import { recordMetric } from './metrics_aggregator';

// Minimum size to compress (1KB)
const COMPRESSION_THRESHOLD_BYTES = 1024;

// Maximum size to compress synchronously (10MB) - larger payloads should use streaming
const MAX_SYNC_COMPRESS_BYTES = 10 * 1024 * 1024;

/**
 * Compression result with metadata
 */
export interface CompressionResult {
  data: Buffer;
  encoding: 'br' | 'gzip' | 'identity';
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  wasCompressed: boolean;
}

/**
 * Compression options
 */
export interface CompressionOptions {
  threshold?: number;
  preferBrotli?: boolean;
  brotliQuality?: number;
  gzipLevel?: number;
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  threshold: COMPRESSION_THRESHOLD_BYTES,
  preferBrotli: true,
  brotliQuality: 4, // Fast compression (0-11, higher = better compression but slower)
  gzipLevel: 6,     // Default gzip level (0-9)
};

/**
 * Parse Accept-Encoding header
 */
export function parseAcceptEncoding(acceptEncoding?: string): {
  supportsBrotli: boolean;
  supportsGzip: boolean;
  preferredEncoding: 'br' | 'gzip' | 'identity';
} {
  if (!acceptEncoding) {
    return {
      supportsBrotli: false,
      supportsGzip: false,
      preferredEncoding: 'identity',
    };
  }
  
  const normalized = acceptEncoding.toLowerCase();
  const supportsBrotli = normalized.includes('br');
  const supportsGzip = normalized.includes('gzip') || normalized.includes('deflate');
  
  // Determine preferred encoding based on q-values or order
  let preferredEncoding: 'br' | 'gzip' | 'identity' = 'identity';
  
  if (supportsBrotli) {
    preferredEncoding = 'br';
  } else if (supportsGzip) {
    preferredEncoding = 'gzip';
  }
  
  return {
    supportsBrotli,
    supportsGzip,
    preferredEncoding,
  };
}

/**
 * Compress data with Brotli
 */
function compressBrotli(data: Buffer, quality: number): Buffer {
  return brotliCompressSync(data, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: quality,
    },
  });
}

/**
 * Compress data with gzip
 */
function compressGzip(data: Buffer, level: number): Buffer {
  return gzipSync(data, { level });
}

/**
 * Compress response data based on Accept-Encoding header
 */
export function compressResponse(
  data: string | Buffer | object,
  acceptEncoding?: string,
  options: CompressionOptions = {}
): CompressionResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Convert data to Buffer
  let buffer: Buffer;
  if (Buffer.isBuffer(data)) {
    buffer = data;
  } else if (typeof data === 'string') {
    buffer = Buffer.from(data, 'utf-8');
  } else {
    buffer = Buffer.from(JSON.stringify(data), 'utf-8');
  }
  
  const originalSize = buffer.length;
  
  // Don't compress if below threshold or too large for sync
  if (originalSize < opts.threshold || originalSize > MAX_SYNC_COMPRESS_BYTES) {
    return {
      data: buffer,
      encoding: 'identity',
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 1,
      wasCompressed: false,
    };
  }
  
  const { supportsBrotli, supportsGzip, preferredEncoding } = parseAcceptEncoding(acceptEncoding);
  
  // No compression support
  if (!supportsBrotli && !supportsGzip) {
    return {
      data: buffer,
      encoding: 'identity',
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 1,
      wasCompressed: false,
    };
  }
  
  try {
    let compressed: Buffer;
    let encoding: 'br' | 'gzip';
    
    if (opts.preferBrotli && supportsBrotli) {
      compressed = compressBrotli(buffer, opts.brotliQuality);
      encoding = 'br';
    } else if (supportsGzip) {
      compressed = compressGzip(buffer, opts.gzipLevel);
      encoding = 'gzip';
    } else if (supportsBrotli) {
      compressed = compressBrotli(buffer, opts.brotliQuality);
      encoding = 'br';
    } else {
      // Shouldn't reach here, but fallback
      return {
        data: buffer,
        encoding: 'identity',
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1,
        wasCompressed: false,
      };
    }
    
    const compressedSize = compressed.length;
    const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;
    
    // Only use compression if it actually reduces size
    if (compressedSize >= originalSize) {
      return {
        data: buffer,
        encoding: 'identity',
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1,
        wasCompressed: false,
      };
    }
    
    return {
      data: compressed,
      encoding,
      originalSize,
      compressedSize,
      compressionRatio,
      wasCompressed: true,
    };
  } catch (error) {
    console.error('[Compression] Failed to compress:', error);
    return {
      data: buffer,
      encoding: 'identity',
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 1,
      wasCompressed: false,
    };
  }
}

/**
 * Get headers for compressed response
 */
export function getCompressionHeaders(result: CompressionResult): Record<string, string> {
  const headers: Record<string, string> = {
    'Vary': 'Accept-Encoding',
  };
  
  if (result.wasCompressed) {
    headers['Content-Encoding'] = result.encoding;
    headers['Content-Length'] = String(result.compressedSize);
    headers['X-Original-Size'] = String(result.originalSize);
    headers['X-Compression-Ratio'] = result.compressionRatio.toFixed(3);
  } else {
    headers['Content-Length'] = String(result.originalSize);
  }
  
  return headers;
}

/**
 * Wrapper to compress and track metrics for a response
 */
export function compressWithMetrics(
  path: string,
  data: string | Buffer | object,
  acceptEncoding?: string,
  options?: CompressionOptions
): {
  result: CompressionResult;
  headers: Record<string, string>;
} {
  const startTime = performance.now();
  const result = compressResponse(data, acceptEncoding, options);
  const compressionTime = performance.now() - startTime;
  
  // Log compression stats for monitoring
  if (result.wasCompressed) {
    console.debug('[Compression]', {
      path,
      encoding: result.encoding,
      originalSize: result.originalSize,
      compressedSize: result.compressedSize,
      ratio: result.compressionRatio.toFixed(3),
      timeMs: compressionTime.toFixed(2),
    });
  }
  
  return {
    result,
    headers: getCompressionHeaders(result),
  };
}

/**
 * Check if content type should be compressed
 */
export function isCompressibleContentType(contentType?: string): boolean {
  if (!contentType) return true; // Assume JSON
  
  const compressible = [
    'application/json',
    'text/plain',
    'text/html',
    'text/css',
    'text/javascript',
    'application/javascript',
    'application/xml',
    'text/xml',
    'image/svg+xml',
  ];
  
  const normalized = contentType.toLowerCase().split(';')[0].trim();
  return compressible.some(type => normalized.includes(type));
}

/**
 * Compression statistics for monitoring
 */
export interface CompressionStats {
  totalCompressed: number;
  totalUncompressed: number;
  totalBytesSaved: number;
  avgCompressionRatio: number;
  byEncoding: {
    brotli: number;
    gzip: number;
    identity: number;
  };
}

// In-memory stats
const stats = {
  totalCompressed: 0,
  totalUncompressed: 0,
  totalOriginalBytes: 0,
  totalCompressedBytes: 0,
  byEncoding: {
    brotli: 0,
    gzip: 0,
    identity: 0,
  },
};

/**
 * Record compression stats
 */
export function recordCompressionStats(result: CompressionResult): void {
  if (result.wasCompressed) {
    stats.totalCompressed++;
    stats.byEncoding[result.encoding === 'br' ? 'brotli' : 'gzip']++;
  } else {
    stats.totalUncompressed++;
    stats.byEncoding.identity++;
  }
  
  stats.totalOriginalBytes += result.originalSize;
  stats.totalCompressedBytes += result.compressedSize;
}

/**
 * Get compression statistics
 */
export function getCompressionStats(): CompressionStats {
  const total = stats.totalCompressed + stats.totalUncompressed;
  return {
    totalCompressed: stats.totalCompressed,
    totalUncompressed: stats.totalUncompressed,
    totalBytesSaved: stats.totalOriginalBytes - stats.totalCompressedBytes,
    avgCompressionRatio: stats.totalOriginalBytes > 0 
      ? stats.totalCompressedBytes / stats.totalOriginalBytes 
      : 1,
    byEncoding: { ...stats.byEncoding },
  };
}

/**
 * Reset compression stats (for testing)
 */
export function resetCompressionStats(): void {
  stats.totalCompressed = 0;
  stats.totalUncompressed = 0;
  stats.totalOriginalBytes = 0;
  stats.totalCompressedBytes = 0;
  stats.byEncoding = { brotli: 0, gzip: 0, identity: 0 };
}

