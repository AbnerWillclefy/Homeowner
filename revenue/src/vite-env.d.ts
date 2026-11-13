/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the API. */
  readonly VITE_API_URL: string;
  /** Cognito app client id, the same client as the PWA. Public: the client has no secret. */
  readonly VITE_COGNITO_CLIENT_ID: string;
  /** AWS region of the Cognito user pool. Public. */
  readonly VITE_COGNITO_REGION: string;
  /** The pool's password rules, the Terraform `cognito_password_policy` JSON. */
  readonly VITE_PASSWORD_POLICY: string;
  /** E2E only: a stub for Pluggy Connect. Used only when both it and the integrity are set. */
  readonly VITE_PLUGGY_CONNECT_URL?: string;
  readonly VITE_PLUGGY_CONNECT_SRI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
