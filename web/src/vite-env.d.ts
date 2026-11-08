/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the API, baked in at build time. Public: never put secrets here. */
  readonly VITE_API_BASE_URL: string;
  /** AWS region of the Cognito user pool, baked in at build time. Public. */
  readonly VITE_COGNITO_REGION: string;
  /** Cognito app client id for the PWA, baked in at build time. Public: the client has no secret. */
  readonly VITE_COGNITO_CLIENT_ID: string;
  /** The pool's password rules as one JSON object (Terraform output password_policy), baked in at build time. Public. */
  readonly VITE_PASSWORD_POLICY: string;
  /** Set only by the e2e build, to a stub of Pluggy Connect. Without both, the pinned CDN script is used. */
  readonly VITE_PLUGGY_CONNECT_URL?: string;
  /** The `sha384-...` hash of the script at VITE_PLUGGY_CONNECT_URL. */
  readonly VITE_PLUGGY_CONNECT_SRI?: string;
}

interface ImportMeta{
  readonly env: ImportMetaEnv;
}
