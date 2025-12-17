/**
 * Capacitor Native Utilities
 * 
 * Provides native device features through Capacitor plugins.
 * Automatically falls back to web APIs when running in browser.
 */

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Network } from '@capacitor/network';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Browser } from '@capacitor/browser';
import { Preferences } from '@capacitor/preferences';

/**
 * Check if running in native Capacitor environment
 */
export const isNative = Capacitor.isNativePlatform();

/**
 * Get current platform
 */
export const platform = Capacitor.getPlatform() as 'web' | 'android' | 'ios';

/**
 * Check if running on specific platform
 */
export const isAndroid = platform === 'android';
export const isIOS = platform === 'ios';
export const isWeb = platform === 'web';

/**
 * Initialize Capacitor app features
 * Call this on app startup
 */
export async function initializeCapacitor(): Promise<void> {
  if (!isNative) {
    console.log('[Capacitor] Running in web mode');
    return;
  }

  console.log(`[Capacitor] Initializing on ${platform}`);

  try {
    // Hide splash screen after app is ready
    await SplashScreen.hide();

    // Configure status bar
    if (isIOS || isAndroid) {
      await StatusBar.setStyle({ style: Style.Dark });
      if (isAndroid) {
        await StatusBar.setBackgroundColor({ color: '#ffffff' });
      }
    }

    // Handle Android back button
    if (isAndroid) {
      App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          App.exitApp();
        }
      });
    }

    // Handle app state changes
    App.addListener('appStateChange', ({ isActive }) => {
      console.log('[Capacitor] App state changed:', isActive ? 'active' : 'background');
      window.dispatchEvent(new CustomEvent('app-state-change', {
        detail: { isActive }
      }));
    });

    // Handle keyboard events
    if (isIOS || isAndroid) {
      Keyboard.addListener('keyboardWillShow', (info) => {
        document.body.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
        document.body.classList.add('keyboard-visible');
      });

      Keyboard.addListener('keyboardWillHide', () => {
        document.body.style.setProperty('--keyboard-height', '0px');
        document.body.classList.remove('keyboard-visible');
      });
    }

    // Monitor network status
    Network.addListener('networkStatusChange', (status) => {
      console.log('[Capacitor] Network status:', status);
      window.dispatchEvent(new CustomEvent('network-status-change', {
        detail: status
      }));
    });

    console.log('[Capacitor] Initialization complete');
  } catch (error) {
    console.error('[Capacitor] Initialization failed:', error);
  }
}

/**
 * Take a photo using device camera
 * Returns base64 encoded image data
 */
export async function takePhoto(): Promise<string | null> {
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
      correctOrientation: true,
    });

    return image.base64String || null;
  } catch (error) {
    console.error('[Capacitor] Camera error:', error);
    return null;
  }
}

/**
 * Pick photo from device gallery
 * Returns base64 encoded image data
 */
export async function pickPhoto(): Promise<string | null> {
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Photos,
      correctOrientation: true,
    });

    return image.base64String || null;
  } catch (error) {
    console.error('[Capacitor] Gallery error:', error);
    return null;
  }
}

/**
 * Pick photo or take new one (shows action sheet)
 * Returns base64 encoded image data
 */
export async function pickOrTakePhoto(): Promise<string | null> {
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Prompt,
      correctOrientation: true,
      promptLabelHeader: 'Select Image',
      promptLabelPhoto: 'From Gallery',
      promptLabelPicture: 'Take Photo',
    });

    return image.base64String || null;
  } catch (error) {
    console.error('[Capacitor] Image picker error:', error);
    return null;
  }
}

/**
 * Get current geolocation
 */
export async function getCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
  try {
    // Check permissions first
    const permStatus = await Geolocation.checkPermissions();
    
    if (permStatus.location !== 'granted') {
      const requestStatus = await Geolocation.requestPermissions();
      if (requestStatus.location !== 'granted') {
        console.warn('[Capacitor] Geolocation permission denied');
        return null;
      }
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });

    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
  } catch (error) {
    console.error('[Capacitor] Geolocation error:', error);
    return null;
  }
}

/**
 * Haptic feedback
 */
export async function hapticFeedback(
  style: 'light' | 'medium' | 'heavy' = 'light'
): Promise<void> {
  if (!isNative) return;

  const styleMap = {
    light: ImpactStyle.Light,
    medium: ImpactStyle.Medium,
    heavy: ImpactStyle.Heavy,
  };

  try {
    await Haptics.impact({ style: styleMap[style] });
  } catch (error) {
    console.error('[Capacitor] Haptics error:', error);
  }
}

/**
 * Haptic notification feedback
 */
export async function hapticNotification(
  type: 'success' | 'warning' | 'error' = 'success'
): Promise<void> {
  if (!isNative) return;

  try {
    await Haptics.notification({ type: type as any });
  } catch (error) {
    console.error('[Capacitor] Haptics error:', error);
  }
}

/**
 * Check network status
 */
export async function checkNetworkStatus(): Promise<{
  connected: boolean;
  connectionType: string;
}> {
  try {
    const status = await Network.getStatus();
    return {
      connected: status.connected,
      connectionType: status.connectionType,
    };
  } catch {
    return {
      connected: navigator.onLine,
      connectionType: 'unknown',
    };
  }
}

/**
 * Open URL in external browser
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (isNative) {
    await Browser.open({ url });
  } else {
    window.open(url, '_blank');
  }
}

/**
 * Store data persistently
 */
export async function setStorageItem(key: string, value: string): Promise<void> {
  if (isNative) {
    await Preferences.set({ key, value });
  } else {
    localStorage.setItem(key, value);
  }
}

/**
 * Get stored data
 */
export async function getStorageItem(key: string): Promise<string | null> {
  if (isNative) {
    const result = await Preferences.get({ key });
    return result.value;
  } else {
    return localStorage.getItem(key);
  }
}

/**
 * Remove stored data
 */
export async function removeStorageItem(key: string): Promise<void> {
  if (isNative) {
    await Preferences.remove({ key });
  } else {
    localStorage.removeItem(key);
  }
}

/**
 * Setup deep link handler
 */
export function setupDeepLinkHandler(
  navigate: (path: string) => void
): () => void {
  if (!isNative) {
    return () => {};
  }

  let listenerHandle: { remove: () => void } | null = null;

  App.addListener('appUrlOpen', (event) => {
    console.log('[Capacitor] Deep link received:', event.url);
    
    try {
      const url = new URL(event.url);
      const path = url.pathname;
      
      if (path) {
        navigate(path);
      }
    } catch (error) {
      console.error('[Capacitor] Deep link parse error:', error);
    }
  }).then((handle) => {
    listenerHandle = handle;
  });

  return () => {
    listenerHandle?.remove();
  };
}

/**
 * Get app info
 */
export async function getAppInfo(): Promise<{
  name: string;
  id: string;
  version: string;
  build: string;
} | null> {
  if (!isNative) return null;

  try {
    const info = await App.getInfo();
    return {
      name: info.name,
      id: info.id,
      version: info.version,
      build: info.build,
    };
  } catch {
    return null;
  }
}

/**
 * Exit the app (Android only)
 */
export function exitApp(): void {
  if (isAndroid) {
    App.exitApp();
  }
}

/**
 * Convert base64 to Blob
 * Useful for file uploads from camera
 */
export function base64ToBlob(base64: string, mimeType: string = 'image/jpeg'): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Convert base64 to File
 * Useful for form submissions with camera photos
 */
export function base64ToFile(
  base64: string,
  filename: string = 'photo.jpg',
  mimeType: string = 'image/jpeg'
): File {
  const blob = base64ToBlob(base64, mimeType);
  return new File([blob], filename, { type: mimeType });
}

