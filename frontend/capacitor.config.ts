import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hvehospitality.pms',
  appName: 'Hospitality Management Platform',
  webDir: 'dist',
  
  // Server configuration
  server: {
    // Use environment variable for custom server URL (development)
    // In production, the app uses the bundled web assets
    url: process.env.CAPACITOR_SERVER_URL || undefined,
    cleartext: true, // Allow HTTP for local development
    androidScheme: 'https',
  },
  
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#3b82f6',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#ffffff',
    },
    Keyboard: {
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Camera: {
      // Camera plugin configuration
    },
    Geolocation: {
      // Geolocation plugin configuration
    },
  },
  
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: process.env.NODE_ENV !== 'production',
    backgroundColor: '#ffffff',
    // Build configuration
    buildOptions: {
      keystorePath: undefined, // Set for release builds
      keystoreAlias: undefined,
    },
  },
  
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true,
    allowsLinkPreview: false,
    backgroundColor: '#ffffff',
    // iOS specific settings
    preferredContentMode: 'mobile',
  },
};

export default config;
