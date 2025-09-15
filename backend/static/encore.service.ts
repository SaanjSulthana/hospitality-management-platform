import { api } from "encore.dev/api";
import { Service } from "encore.dev/service";
import { readFileSync, existsSync } from "fs";
import { extname } from "path";

export default new Service("static");

// Serve static files with fallback handling
export const serveStatic = api.raw(
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
        req.url?.startsWith('/config/')) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain");
      res.end("API route not found");
      return;
    }

    try {
      // Check if dist directory exists, if not create it
      if (!existsSync('./dist')) {
        console.log('Dist directory not found, creating...');
        const { execSync } = require('child_process');
        execSync('mkdir -p dist', { stdio: 'inherit' });
        
        // Try to build frontend if possible
        try {
          console.log('Attempting to build frontend...');
          execSync('cd ../frontend && bun install && bun run build', { stdio: 'inherit' });
          execSync('cp -r ../frontend/dist/* dist/', { stdio: 'inherit' });
        } catch (buildError) {
          console.log('Frontend build failed, serving fallback:', buildError);
        }
      }

      const filePath = `./dist${req.url}`;
      console.log(`Serving static file: ${filePath}`);
      
      if (!existsSync(filePath)) {
        // If file doesn't exist, serve index.html for SPA routing
        const indexPath = './dist/index.html';
        if (existsSync(indexPath)) {
          const indexContent = readFileSync(indexPath);
          res.setHeader("Content-Type", "text/html");
          res.end(indexContent);
          return;
        } else {
          res.statusCode = 404;
          res.setHeader("Content-Type", "text/html");
          res.end("<html><body><h1>Frontend not available</h1><p>Please check deployment configuration.</p></body></html>");
          return;
        }
      }

      const fileContent = readFileSync(filePath);
      const ext = extname(filePath).toLowerCase();
      let contentType = "application/octet-stream";

      switch (ext) {
        case ".html":
          contentType = "text/html";
          break;
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
      console.error('Static file serving error:', error);
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/html");
      res.end("<html><body><h1>Error serving static files</h1><p>Please check deployment configuration.</p></body></html>");
    }
  }
);
