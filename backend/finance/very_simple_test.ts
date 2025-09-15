import { api } from "encore.dev/api";

// Very simple test endpoint that returns an object
export const verySimpleTest = api(
  { auth: false, expose: true, method: "GET", path: "/finance/very-simple-test" },
  async () => {
    console.log("Very simple test endpoint called");
    return {
      message: "Hello from very simple test!",
      timestamp: new Date().toISOString()
    };
  }
);
