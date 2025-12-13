import { Service } from "encore.dev/service";

/**
 * Middleware Service
 * 
 * Provides global networking optimizations:
 * - Response metrics and Server-Timing headers
 * - Compression (Brotli/gzip)
 * - Conditional GET support (ETag/Last-Modified)
 * - Cache-Control headers for CDN integration
 * 
 * This service is designed to be used by other services
 * to wrap their responses with networking optimizations.
 */
export default new Service("middleware");

