/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_TEMPLATE_SOURCE: string;
  readonly VITE_WORKER_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
