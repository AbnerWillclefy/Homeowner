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
  /** "true" shows the staging-only "Replan now" button on the Day Plan. Optional: unset means off. */
  readonly VITE_REPLAN_ENABLED?: string;
}

interface ImportMeta{
  readonly env: ImportMetaEnv;
}
