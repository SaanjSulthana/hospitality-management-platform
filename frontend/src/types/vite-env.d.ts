/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MODE: string;
  readonly BASE_URL: string;
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly SSR: boolean;
  // Add more env variables as needed
  [key: string]: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
