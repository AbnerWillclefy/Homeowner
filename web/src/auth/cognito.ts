import { config } from "../shared/config";

/** Why a Cognito call failed, in words the screens can choose their own text for. Never Cognito's raw message. */
export type CognitoFailure =
  | { kind: "already-registered" }
  | { kind: "invalid-password" }
  | { kind: "invalid-input" }
  | { kind: "wrong-code" }
  | { kind: "expired-code" }
  /** The email was never confirmed. Offer to confirm and to resend the code. */
  | { kind: "not-confirmed" }
  /** Wrong email or password (deliberately not told apart), or a refresh token Cognito no longer accepts. */
  | { kind: "not-authorized" }
  | { kind: "rate-limited" }
  | { kind: "network" }
  | { kind: "error" };

export type CognitoOk = { kind: "ok" };
export type CognitoResult = CognitoOk | CognitoFailure;

export interface SignInTokens {
  idToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}
export interface RefreshTokens {
  idToken: string;
  /** Present only if Cognito rotated it; otherwise keep the old one. */
  refreshToken?: string;
  expiresInSeconds: number;
}

export type SignInResult = { kind: "ok"; tokens: SignInTokens } | CognitoFailure;
export type RefreshResult = { kind: "ok"; tokens: RefreshTokens } | CognitoFailure;

const FAILURE_BY_TYPE: Record<string, CognitoFailure["kind"]> = {
  UsernameExistsException: "already-registered",
  InvalidPasswordException: "invalid-password",
  InvalidParameterException: "invalid-input",
  CodeMismatchException: "wrong-code",
  ExpiredCodeException: "expired-code",
  UserNotConfirmedException: "not-confirmed",
  NotAuthorizedException: "not-authorized",
  LimitExceededException: "rate-limited",
  TooManyRequestsException: "rate-limited",
  TooManyFailedAttemptsException: "rate-limited",
};

type Called = { ok: true; body: Record<string, unknown> } | { ok: false; failure: CognitoFailure };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** One call to the Cognito public API. Never throws, never logs the request body (it can hold a password). */
async function call(target: string, payload: Record<string, unknown>): Promise<Called> {
  let res: Response;
  try {
    res = await fetch(`https://cognito-idp.${config.cognitoRegion}.amazonaws.com/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}`,
      },
      body: JSON.stringify({ ClientId: config.cognitoClientId, ...payload }),
      credentials: "omit",
      cache: "no-store",
    });
  } catch {
    return { ok: false, failure: { kind: "network" } };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, failure: { kind: "error" } };
  }
  if (!isRecord(body)) return { ok: false, failure: { kind: "error" } };

  if (!res.ok) {
    const type = typeof body.__type === "string" ? body.__type.split("#").pop()! : "";
    return { ok: false, failure: { kind: FAILURE_BY_TYPE[type] ?? "error" } };
  }
  return { ok: true, body };
}

async function simple(target: string, payload: Record<string, unknown>): Promise<CognitoResult> {
  const result = await call(target, payload);
  return result.ok ? { kind: "ok" } : result.failure;
}

export function signUp(email: string, password: string): Promise<CognitoResult> {
  return simple("SignUp", {
    Username: email,
    Password: password,
    UserAttributes: [{ Name: "email", Value: email }],
  });
}

export function confirmSignUp(email: string, code: string): Promise<CognitoResult> {
  return simple("ConfirmSignUp", { Username: email, ConfirmationCode: code });
}

export function resendCode(email: string): Promise<CognitoResult> {
  return simple("ResendConfirmationCode", { Username: email });
}

function authResult(body: Record<string, unknown>): Record<string, unknown> | null {
  return isRecord(body.AuthenticationResult) ? body.AuthenticationResult : null;
}

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const result = await call("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    AuthParameters: { USERNAME: email, PASSWORD: password },
  });
  if (!result.ok) return result.failure;
  const auth = authResult(result.body);
  const { IdToken, RefreshToken, ExpiresIn } = auth ?? {};
  if (typeof IdToken !== "string" || typeof RefreshToken !== "string" || typeof ExpiresIn !== "number") {
    // A challenge (for example MFA) is not something this pool uses.
    return { kind: "error" };
  }
  return { kind: "ok", tokens: { idToken: IdToken, refreshToken: RefreshToken, expiresInSeconds: ExpiresIn } };
}

export async function refreshSession(refreshToken: string): Promise<RefreshResult> {
  const result = await call("InitiateAuth", {
    AuthFlow: "REFRESH_TOKEN_AUTH",
    AuthParameters: { REFRESH_TOKEN: refreshToken },
  });
  if (!result.ok) return result.failure;
  const { IdToken, RefreshToken, ExpiresIn } = authResult(result.body) ?? {};
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
