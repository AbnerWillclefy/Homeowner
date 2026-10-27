import { config } from "../config";

/** Why a Cognito call failed. Only the sign-in failures the admin screen has words for. Never Cognito's raw message. */
export type CognitoFailure =
  | { kind: "not-confirmed" }
  /** Wrong email or password (deliberately not told apart), or a refresh token Cognito no longer accepts. */
  | { kind: "not-authorized" }
  | { kind: "rate-limited" }
  | { kind: "network" }
  | { kind: "error" };

export interface Tokens {
  idToken: string;
  /** Present on sign-in; on refresh only if Cognito rotated it. */
  refreshToken?: string;
  expiresInSeconds: number;
}

export type AuthResult = { kind: "ok"; tokens: Tokens } | CognitoFailure;

const FAILURE_BY_TYPE: Record<string, CognitoFailure["kind"]> = {
  UserNotConfirmedException: "not-confirmed",
  NotAuthorizedException: "not-authorized",
  LimitExceededException: "rate-limited",
  TooManyRequestsException: "rate-limited",
  TooManyFailedAttemptsException: "rate-limited",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** One InitiateAuth call to the Cognito public API (same app client as the PWA). Never throws, never logs the body. */
async function initiateAuth(authFlow: string, authParameters: Record<string, string>): Promise<AuthResult> {
  let res: Response;
  try {
    res = await fetch(`https://cognito-idp.${config.cognitoRegion}.amazonaws.com/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
      },
      body: JSON.stringify({ ClientId: config.cognitoClientId, AuthFlow: authFlow, AuthParameters: authParameters }),
      credentials: "omit",
      cache: "no-store",
    });
  } catch {
    return { kind: "network" };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { kind: "error" };
  }
  if (!isRecord(body)) return { kind: "error" };

  if (!res.ok) {
    const type = typeof body.__type === "string" ? (body.__type.split("#").pop() ?? "") : "";
    return { kind: FAILURE_BY_TYPE[type] ?? "error" };
  }

  const { IdToken, RefreshToken, ExpiresIn } = isRecord(body.AuthenticationResult) ? body.AuthenticationResult : {};
  // A challenge (for example MFA) is not something this pool uses.
  if (typeof IdToken !== "string" || typeof ExpiresIn !== "number") return { kind: "error" };
  return {
    kind: "ok",
    tokens: {
      idToken: IdToken,
      ...(typeof RefreshToken === "string" ? { refreshToken: RefreshToken } : {}),
      expiresInSeconds: ExpiresIn,
    },
  };
}

export function signIn(email: string, password: string): Promise<AuthResult> {
  return initiateAuth("USER_PASSWORD_AUTH", { USERNAME: email, PASSWORD: password });
}

export function refreshSession(refreshToken: string): Promise<AuthResult> {
  return initiateAuth("REFRESH_TOKEN_AUTH", { REFRESH_TOKEN: refreshToken });
}
