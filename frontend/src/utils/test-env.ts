// Test utilities for environment configuration
import { getEnvMode, isDevelopment, getApiUrl, getEnvVar } from './env';


export function testEnvironmentConfig(): void {
  console.log('🧪 Testing Environment Configuration...');
  
  try {
    // Test environment mode detection
    const mode = getEnvMode();
    console.log('✅ Environment mode:', mode);
    
    // Test development detection
    const isDev = isDevelopment();
    console.log('✅ Is development:', isDev);
    
    // Test API URL
    const apiUrl = getApiUrl();
    console.log('✅ API URL:', apiUrl);
    
    // Test environment variables
    const viteApiUrl = getEnvVar('VITE_API_URL');
    const reactApiUrl = getEnvVar('REACT_APP_API_URL');
    console.log('✅ VITE_API_URL:', viteApiUrl);
    console.log('✅ REACT_APP_API_URL:', reactApiUrl);
    
    // Test process.env availability
    const hasProcess = typeof process !== 'undefined';
    const hasProcessEnv = hasProcess && typeof process.env !== 'undefined';
    console.log('✅ Process available:', hasProcess);
    console.log('✅ Process.env available:', hasProcessEnv);
    
    if (hasProcessEnv) {
      console.log('✅ NODE_ENV:', process.env.NODE_ENV);
    }
    
    // Test import.meta availability
    let hasImportMeta = false;
    let hasImportMetaEnv = false;
    try {
      // @ts-ignore - import.meta is available in Vite
      hasImportMeta = typeof import.meta !== 'undefined';
      // @ts-ignore - import.meta.env is available in Vite
      hasImportMetaEnv = hasImportMeta && import.meta.env;
    } catch (e) {
      // import.meta not available
    }
    
    console.log('✅ import.meta available:', hasImportMeta);
    console.log('✅ import.meta.env available:', hasImportMetaEnv);
    
    if (hasImportMetaEnv) {
      try {
        // @ts-ignore - import.meta.env is available in Vite
        console.log('✅ import.meta.env.MODE:', import.meta.env.MODE);
      } catch (e) {
        console.log('❌ Error accessing import.meta.env.MODE');
      }
    }
    
    console.log('🎉 Environment configuration test completed successfully!');
    
  } catch (error) {
    console.error('❌ Environment configuration test failed:', error);
  }
}

// Auto-run test in development
if (typeof window !== 'undefined' && isDevelopment()) {
  console.log('🔧 Running environment test in development mode...');
  testEnvironmentConfig();
}
