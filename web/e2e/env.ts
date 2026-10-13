import { loadEnv } from "vite";

// The same file the build reads (`vite build --mode e2e`), so the fakes and the built app can never disagree.
const values = loadEnv("e2e", process.cwd(), "VITE_");

function required(name: string): string {
  const value = values[name]?.trim();
  if (!value) throw new Error(`${name} is missing from web/.env.e2e.`);
  return value;
}

export const apiBaseUrl = required("VITE_API_BASE_URL").replace(/\/+$/, "");
export const cognitoRegion = required("VITE_COGNITO_REGION");
export const cognitoClientId = required("VITE_COGNITO_CLIENT_ID");
export const passwordPolicy = required("VITE_PASSWORD_POLICY");
