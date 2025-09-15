
import { api } from "encore.dev/api";
import { Service } from "encore.dev/service";
import { readFileSync } from "fs";
import { extname } from "path";

export default new Service("frontend");

// Serve static assets (CSS, JS, images, etc.)
export const serveAssets = api.raw(
  { expose: true, path: "/assets/*", method: "GET" },
  async (req, res) => {
    try {
      const filePath = `./dist${req.url}`;
      console.log(`Serving asset: ${filePath}`);
      const fileContent = readFileSync(filePath);
      const ext = extname(filePath).toLowerCase();
      let contentType = "application/octet-stream";

      switch (ext) {
        case ".css":
          contentType = "text/css";
          break;
        case ".js":
          contentType = "application/javascript";
          break;
        case ".svg":
          contentType = "image/svg+xml";
          break;
        case ".png":
          contentType = "image/png";
          break;
        case ".jpg":
        case ".jpeg":
          contentType = "image/jpeg";
          break;
        case ".gif":
          contentType = "image/gif";
          break;
        case ".ico":
          contentType = "image/x-icon";
          break;
        case ".woff":
          contentType = "font/woff";
          break;
        case ".woff2":
          contentType = "font/woff2";
          break;
        case ".ttf":
          contentType = "font/ttf";
          break;
        case ".eot":
          contentType = "application/vnd.ms-fontobject";
          break;
        default:
          contentType = "text/plain";
      }

      res.setHeader("Content-Type", contentType);
      res.end(fileContent);
    } catch (error) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain");
      res.end("Asset not found");
    }
  }
);

// Serve favicon
export const serveFavicon = api.raw(
  { expose: true, path: "/favicon.svg", method: "GET" },
  async (req, res) => {
    try {
      const filePath = "./dist/favicon.svg";
      const fileContent = readFileSync(filePath);
      res.setHeader("Content-Type", "image/svg+xml");
      res.end(fileContent);
    } catch (error) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain");
      res.end("Favicon not found");
    }
  }
);

// Serve SPA routes (catch-all for frontend routing)
export const serveSPA = api.raw(
  { expose: true, path: "/!path", method: "GET" },
  async (req, res) => {
    // Skip API routes - let them be handled by the API services
    if (req.url?.startsWith('/api/') || 
        req.url?.startsWith('/auth/') || 
        req.url?.startsWith('/finance/') || 
        req.url?.startsWith('/properties/') || 
        req.url?.startsWith('/staff/') || 
        req.url?.startsWith('/tasks/') || 
        req.url?.startsWith('/reports/') || 
        req.url?.startsWith('/analytics/') || 
        req.url?.startsWith('/users/') || 
        req.url?.startsWith('/branding/') || 
        req.url?.startsWith('/uploads/') || 
        req.url?.startsWith('/orgs/') || 
        req.url?.startsWith('/health') ||
        req.url?.startsWith('/config/') ||
        req.url?.startsWith('/assets/') ||
        req.url?.startsWith('/favicon.svg')) {
      // Let API routes and assets be handled by their respective services
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain");
      res.end("Route not found");
      return;
    }

    // For SPA routing, try to serve the specific file first
    try {
      const filePath = `./dist${req.url}`;
      console.log(`Serving SPA file: ${filePath}`);
      const fileContent = readFileSync(filePath);
      
      // Only handle HTML files in SPA service
      if (req.url?.endsWith('.html')) {
        res.setHeader("Content-Type", "text/html");
        res.end(fileContent);
        return;
      }
    } catch (error) {
      // File not found, continue to SPA fallback
    }
    
    // SPA fallback: serve index.html for all non-API routes
    try {
      const indexPath = "./dist/index.html";
      const indexContent = readFileSync(indexPath);
      res.setHeader("Content-Type", "text/html");
      res.end(indexContent);
    } catch (indexError) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/html");
      res.end("<html><body><h1>Frontend not available</h1></body></html>");
    }
  }
);
