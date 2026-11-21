import { config } from "../config";

/** Why a Cognito call failed. Never Cognito's raw message: the screens have their own words. */
export type CognitoFailure =
  | { kind: "not-confirmed" }
  /** Wrong email or password (deliberately not told apart), or a refresh token Cognito no longer accepts. */
  | { kind: "not-authorized" }
  | { kind: "rate-limited" }
  | { kind: "code-mismatch" }
  | { kind: "code-expired" }
  | { kind: "invalid-password" }
  | { kind: "network" }
  | { kind: "error" };

export interface Tokens {
  idToken: string;
  /** Present on sign-in; on refresh only if Cognito rotated it. */
  refreshToken?: string;
  expiresInSeconds: number;
}

export type AuthResult = { kind: "ok"; tokens: Tokens } | CognitoFailure;
export type StepResult = { kind: "ok" } | CognitoFailure;

const FAILURE_BY_TYPE: Record<string, CognitoFailure["kind"]> = {
  UserNotConfirmedException: "not-confirmed",
  NotAuthorizedException: "not-authorized",
  LimitExceededException: "rate-limited",
  TooManyRequestsException: "rate-limited",
  TooManyFailedAttemptsException: "rate-limited",
  CodeMismatchException: "code-mismatch",
  ExpiredCodeException: "code-expired",
  InvalidPasswordException: "invalid-password",
  // The pool hides whether an email exists, but a stray answer must not tell either: it is a wrong code.
  UserNotFoundException: "code-mismatch",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** One call to the Cognito public API (same app client as the PWA). Never throws, never logs the body. */
async function call(target: string, payload: Record<string, unknown>): Promise<{ kind: "ok"; body: Record<string, unknown> } | { kind: "failed"; type: string } | { kind: "network" } | { kind: "error" }> {
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
    return { kind: "network" };
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { kind: "error" };
  }
  if (!isRecord(body)) return { kind: "error" };
  if (!res.ok) return { kind: "failed", type: typeof body.__type === "string" ? (body.__type.split("#").pop() ?? "") : "" };
  return { kind: "ok", body };
}

function failure(result: { kind: "failed"; type: string }): CognitoFailure {
  return { kind: FAILURE_BY_TYPE[result.type] ?? "error" };
}

async function initiateAuth(authFlow: string, authParameters: Record<string, string>): Promise<AuthResult> {
  const result = await call("InitiateAuth", { AuthFlow: authFlow, AuthParameters: authParameters });
  if (result.kind === "network" || result.kind === "error") return result;
  if (result.kind === "failed") return failure(result);
  const { IdToken, RefreshToken, ExpiresIn } = isRecord(result.body.AuthenticationResult) ? result.body.AuthenticationResult : {};
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

/**
 * Asks Cognito to email a reset code. The app client hides whether the email exists, and an address with no
 * verified email gets an error: both answer "ok" here, so the screen can never tell the two apart.
 * Only a limit or a network problem is reported, because they say nothing about the email.
 */
export async function forgotPassword(email: string): Promise<StepResult> {
  const result = await call("ForgotPassword", { Username: email });
  if (result.kind === "ok") return { kind: "ok" };
  if (result.kind === "failed") {
    const mapped = failure(result);
    return mapped.kind === "rate-limited" ? mapped : { kind: "ok" };
  }
  return result;
}

export async function confirmForgotPassword(email: string, code: string, newPassword: string): Promise<StepResult> {
  const result = await call("ConfirmForgotPassword", { Username: email, ConfirmationCode: code, Password: newPassword });
  if (result.kind === "ok") return { kind: "ok" };
  if (result.kind === "failed") return failure(result);
  return result;
}
