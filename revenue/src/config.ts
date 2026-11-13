import { parsePolicy, type PasswordPolicy } from "./auth/passwordPolicy";

export interface Config {
  apiUrl: string;
  cognitoRegion: string;
  cognitoClientId: string;
  passwordPolicy: PasswordPolicy;
}

function readSet(name: string, raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) {
    throw new Error(`${name} is not set. Copy revenue/.env.example to revenue/.env.local, or set it in the build environment.`);
  }
  return value;
}

function readShape(name: string, raw: string | undefined, shape: RegExp, example: string): string {
  const value = readSet(name, raw);
  if (!shape.test(value)) throw new Error(`${name} does not look right (expected something like ${example}).`);
  return value;
}

/** Reads and validates the build-time variables. Throws a message naming the variable, so a bad build fails loudly. */
export function readConfig(env: Partial<Record<string, string>>): Config {
  const apiUrl = readSet("VITE_API_URL", env.VITE_API_URL).replace(/\/+$/, "");
  try {
    new URL(apiUrl);
  } catch {
    throw new Error("VITE_API_URL is not a URL (expected something like http://localhost:8080).");
  }
  return {
    apiUrl,
    cognitoRegion: readShape("VITE_COGNITO_REGION", env.VITE_COGNITO_REGION, /^[a-z]{2}(-[a-z]+)+-\d$/, "eu-west-1"),
    cognitoClientId: readShape("VITE_COGNITO_CLIENT_ID", env.VITE_COGNITO_CLIENT_ID, /^[A-Za-z0-9]+$/, "1h57kf5cpq17m0eml12EXAMPLE"),
    passwordPolicy: parsePolicy(readSet("VITE_PASSWORD_POLICY", env.VITE_PASSWORD_POLICY)),
  };
}

export const config: Config = readConfig(import.meta.env);
