/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "local", "staging" or "production": which environment this build is. Must match the API's ENVIRONMENT. */
  readonly VITE_ENVIRONMENT: string;
  /** Base URL of the API (the PWA calls its equivalent VITE_API_BASE_URL). */
  readonly VITE_API_URL: string;
  /** Cognito app client id, the same client as the PWA. Public: the client has no secret. */
  readonly VITE_COGNITO_CLIENT_ID: string;
  /** AWS region of the Cognito user pool. Public. */
  readonly VITE_COGNITO_REGION: string;
  /** JSON object from environment name to that environment's admin origin. Optional: empty or partial is valid. */
  readonly VITE_ADMIN_URLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
