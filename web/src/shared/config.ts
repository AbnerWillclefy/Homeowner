import { parsePolicy } from "../domains/auth/logic/passwordPolicy";

function readApiBaseUrl(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) {
    throw new Error(
      "VITE_API_BASE_URL is not set. Copy web/.env.example to web/.env.local, or set it in the build environment.",
    );
  }
  const url = value.replace(/\/+$/, "");

  const { protocol, hostname } = new URL(url);
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  if (protocol === "http:" && !isLocal) {
    console.warn(`VITE_API_BASE_URL uses http: for ${hostname}; browsers block it from an https: page.`);
  }
  return url;
}

function readSet(name: string, raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) {
    throw new Error(`${name} is not set. Copy web/.env.example to web/.env.local, or set it in the build environment.`);
  }
  return value;
}

function readRequired(name: string, raw: string | undefined, shape: RegExp, example: string): string {
  const value = readSet(name, raw);
  if (!shape.test(value)) {
    throw new Error(`${name} does not look right (expected something like ${example}).`);
  }
  return value;
}

export const config = {
  apiBaseUrl: readApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
  /** The AWS region of the Cognito user pool. Public. */
  cognitoRegion: readRequired(
    "VITE_COGNITO_REGION",
    import.meta.env.VITE_COGNITO_REGION,
    /^[a-z]{2}(-[a-z]+)+-\d$/,
    "eu-west-1",
  ),
  /** The Cognito app client id for this PWA. Public: it has no secret. */
  cognitoClientId: readRequired(
    "VITE_COGNITO_CLIENT_ID",
    import.meta.env.VITE_COGNITO_CLIENT_ID,
    /^[A-Za-z0-9]+$/,
    "1h57kf5cpq17m0eml12EXAMPLE",
  ),
  /** The user pool's password rules, so the sign-up text follows Terraform. Public. */
  passwordPolicy: parsePolicy(readSet("VITE_PASSWORD_POLICY", import.meta.env.VITE_PASSWORD_POLICY)),
} as const;
