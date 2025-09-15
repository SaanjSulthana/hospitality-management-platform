import { g as getEnvMode, i as isDevelopment, a as getApiUrl, b as getEnvVar } from "./index-CluqVwGa.js";
const __vite_import_meta_env__ = { "BASE_URL": "/", "DEV": false, "MODE": "development", "PROD": true, "SSR": false, "VITE_CLIENT_TARGET": "http://localhost:4000" };
var define_process_env_default = {};
function testEnvironmentConfig() {
  console.log("🧪 Testing Environment Configuration...");
  try {
    const mode = getEnvMode();
    console.log("✅ Environment mode:", mode);
    const isDev = isDevelopment();
    console.log("✅ Is development:", isDev);
    const apiUrl = getApiUrl();
    console.log("✅ API URL:", apiUrl);
    const viteApiUrl = getEnvVar("VITE_API_URL");
    const reactApiUrl = getEnvVar("REACT_APP_API_URL");
    console.log("✅ VITE_API_URL:", viteApiUrl);
    console.log("✅ REACT_APP_API_URL:", reactApiUrl);
    const hasProcess = typeof process !== "undefined";
    const hasProcessEnv = hasProcess && typeof define_process_env_default !== "undefined";
    console.log("✅ Process available:", hasProcess);
    console.log("✅ Process.env available:", hasProcessEnv);
    if (hasProcessEnv) {
      console.log("✅ NODE_ENV:", "production");
    }
    let hasImportMeta = false;
    let hasImportMetaEnv = false;
    try {
      hasImportMeta = typeof import.meta !== "undefined";
      hasImportMetaEnv = hasImportMeta && __vite_import_meta_env__;
    } catch (e) {
    }
    console.log("✅ import.meta available:", hasImportMeta);
    console.log("✅ import.meta.env available:", hasImportMetaEnv);
    if (hasImportMetaEnv) {
      try {
        console.log("✅ import.meta.env.MODE:", "development");
      } catch (e) {
        console.log("❌ Error accessing import.meta.env.MODE");
      }
    }
    console.log("🎉 Environment configuration test completed successfully!");
  } catch (error) {
    console.error("❌ Environment configuration test failed:", error);
  }
}
if (typeof window !== "undefined" && isDevelopment()) {
  console.log("🔧 Running environment test in development mode...");
  testEnvironmentConfig();
}
export {
  testEnvironmentConfig
};
