import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeAuthSystem } from "./services/auth-init";
import { initializeCapacitor, isNative } from "./src/utils/capacitor";

// Initialize enterprise-grade authentication system
initializeAuthSystem();

// Initialize Capacitor for native apps
if (isNative) {
  initializeCapacitor().catch((error) => {
    console.error('[Main] Failed to initialize Capacitor:', error);
  });
}

// Register Service Worker for PWA (web only, not in Capacitor)
if ('serviceWorker' in navigator && !isNative) {
  // Only register in production
  try {
    // @ts-ignore
    if (import.meta.env.PROD) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('[SW] Service Worker registered:', registration.scope);
            
            // Check for updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New content is available, show update prompt
                    console.log('[SW] New content available, refresh to update');
                    window.dispatchEvent(new CustomEvent('sw-update-available'));
                  }
                });
              }
            });
          })
          .catch((error) => {
            console.log('[SW] Service Worker registration failed:', error);
          });
      });
    }
  } catch (e) {
    // Ignore errors in development
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
