/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_MAPTILER_SECRET_KEY: string;
  readonly VITE_PUBLIC_POSTHOG_HOST: string;
  readonly VITE_PUBLIC_POSTHOG_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
