import { Gateway } from "encore.dev/api";
import { auth } from "./middleware";

// Configure the API gateway to use the auth handler and enable CORS
export const gateway = new Gateway({ 
  authHandler: auth,
  cors: {
    allowOrigins: [
      "http://localhost:5173",
      "http://localhost:5174", 
      "https://staging-hospitality-management-platform-cr8i.frontend.encr.app",
      "https://hospitality-management-platform-cr8i.frontend.encr.app"
    ],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    allowCredentials: true
  }
});
