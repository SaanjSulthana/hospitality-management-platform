import { api } from "encore.dev/api";
import { Service } from "encore.dev/service";

export default new Service("static");

// Serve static files using Encore's built-in static file serving
export const serveStatic = api.static(
  { expose: true, path: "/!path", dir: "./dist" }
);
