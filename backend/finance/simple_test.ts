import { api } from "encore.dev/api";

// Very simple test endpoint
export const simpleTest = api(
  { auth: false, expose: true, method: "GET", path: "/finance/simple-test" },
  async () => {
    console.log("Simple test endpoint called");
    return {
      message: "Simple test successful",
      timestamp: new Date().toISOString()
    };
  }
);

