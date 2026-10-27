export const ENVIRONMENTS = ["local", "staging", "production"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

/** Environment name to that environment's admin origin. Partial is valid: a missing entry means "not configured". */
export type AdminUrls = Partial<Record<Environment, string>>;

export interface Config {
  environment: Environment;
  apiUrl: string;
  cognitoRegion: string;
  cognitoClientId: string;
  adminUrls: AdminUrls;
}

export function isEnvironment(value: unknown): value is Environment {
  return typeof value === "string" && (ENVIRONMENTS as readonly string[]).includes(value);
}

function readSet(name: string, raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) {
    throw new Error(`${name} is not set. Copy admin/.env.example to admin/.env.local, or set it in the build environment.`);
  }
  return value;
}

function readShape(name: string, raw: string | undefined, shape: RegExp, example: string): string {
  const value = readSet(name, raw);
  if (!shape.test(value)) throw new Error(`${name} does not look right (expected something like ${example}).`);
  return value;
}

function readEnvironment(raw: string | undefined): Environment {
  const value = readSet("VITE_ENVIRONMENT", raw);
  if (!isEnvironment(value)) {
    throw new Error(`VITE_ENVIRONMENT must be one of ${ENVIRONMENTS.join(", ")} (got "${value}").`);
  }
  return value;
}

function readApiUrl(raw: string | undefined): string {
  const value = readSet("VITE_API_URL", raw).replace(/\/+$/, "");
  try {
    new URL(value);
  } catch {
    throw new Error("VITE_API_URL is not a URL (expected something like http://localhost:8080).");
  }
  return value;
}

/** One admin origin: https, or http for localhost only. Returned as a bare origin, with no path. */
function readOrigin(name: string, value: unknown): string {
  if (typeof value !== "string") throw new Error(`${name} must be a string.`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} is not a URL (got "${value}").`);
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    throw new Error(`${name} must be an https origin (got "${value}").`);
  }
  return url.origin;
}

/** Empty or unset is valid ({}): the repository variables only exist after the first apply. Anything else must be right. */
export function readAdminUrls(raw: string | undefined): AdminUrls {
  const text = raw?.trim();
  if (!text) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("VITE_ADMIN_URLS is not valid JSON (expected an object such as {\"production\":\"https://...\"}).");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("VITE_ADMIN_URLS must be a JSON object from environment name to origin.");
  }
  const urls: AdminUrls = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!isEnvironment(key)) {
      throw new Error(`VITE_ADMIN_URLS has an unknown environment "${key}" (use ${ENVIRONMENTS.join(", ")}).`);
    }
    urls[key] = readOrigin(`VITE_ADMIN_URLS.${key}`, value);
  }
  return urls;
}

/** Reads and validates the build-time variables. Throws a message naming the variable, so a bad build fails loudly. */
export function readConfig(env: Partial<Record<string, string>>): Config {
  return {
    environment: readEnvironment(env.VITE_ENVIRONMENT),
    apiUrl: readApiUrl(env.VITE_API_URL),
    cognitoRegion: readShape("VITE_COGNITO_REGION", env.VITE_COGNITO_REGION, /^[a-z]{2}(-[a-z]+)+-\d$/, "eu-west-1"),
    cognitoClientId: readShape(
      "VITE_COGNITO_CLIENT_ID",
      env.VITE_COGNITO_CLIENT_ID,
      /^[A-Za-z0-9]+$/,
      "1h57kf5cpq17m0eml12EXAMPLE",
    ),
    adminUrls: readAdminUrls(env.VITE_ADMIN_URLS),
  };
}

export const config: Config = readConfig(import.meta.env);
