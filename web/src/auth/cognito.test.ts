import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmSignUp, refreshSession, resendCode, signIn, signUp } from "./cognito";

function stubFetch(response: Response | Error) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

function cognitoError(type: string, status = 400) {
  return Response.json({ __type: type, message: "raw text that must never reach the screen" }, { status });
}

function sentBody(fn: ReturnType<typeof stubFetch>): Record<string, unknown> {
  return JSON.parse(fn.mock.calls[0]![1]?.body as string) as Record<string, unknown>;
}

afterEach(() => vi.unstubAllGlobals());

describe("request shape", () => {
  it("posts to the regional Cognito endpoint with the target header", async () => {
    const fetch = stubFetch(Response.json({ UserConfirmed: false }));
    await signUp("a@example.com", "Passw0rdPassw0rd");
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://cognito-idp.eu-west-1.amazonaws.com/");
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers["X-Amz-Target"]).toBe("AWSCognitoIdentityProviderService.SignUp");
    expect(headers["Content-Type"]).toBe("application/x-amz-json-1.1");
    expect(sentBody(fetch)).toEqual({
      ClientId: "testclientid",
      Username: "a@example.com",
      Password: "Passw0rdPassw0rd",
      UserAttributes: [{ Name: "email", Value: "a@example.com" }],
    });
  });

  it("sends no cookies along", async () => {
    const fetch = stubFetch(Response.json({}));
    await resendCode("a@example.com");
    expect(fetch.mock.calls[0]![1]?.credentials).toBe("omit");
  });
});

describe("signUp, confirmSignUp, resendCode", () => {
  it("succeed on a normal answer", async () => {
    stubFetch(Response.json({ UserConfirmed: false }));
    expect(await signUp("a@example.com", "x")).toEqual({ kind: "ok" });
    stubFetch(Response.json({}));
    expect(await confirmSignUp("a@example.com", "123456")).toEqual({ kind: "ok" });
    stubFetch(Response.json({ CodeDeliveryDetails: {} }));
    expect(await resendCode("a@example.com")).toEqual({ kind: "ok" });
  });

  it("sends the confirmation code", async () => {
    const fetch = stubFetch(Response.json({}));
    await confirmSignUp("a@example.com", "123456");
    expect(sentBody(fetch)).toEqual({ ClientId: "testclientid", Username: "a@example.com", ConfirmationCode: "123456" });
  });
});

describe("error mapping", () => {
  it.each([
    ["UsernameExistsException", "already-registered"],
    ["InvalidPasswordException", "invalid-password"],
    ["InvalidParameterException", "invalid-input"],
    ["CodeMismatchException", "wrong-code"],
    ["ExpiredCodeException", "expired-code"],
    ["UserNotConfirmedException", "not-confirmed"],
    ["NotAuthorizedException", "not-authorized"],
    ["LimitExceededException", "rate-limited"],
    ["TooManyRequestsException", "rate-limited"],
    ["TooManyFailedAttemptsException", "rate-limited"],
    ["SomethingNewException", "error"],
  ] as const)("maps %s to %s", async (type, kind) => {
    stubFetch(cognitoError(type));
    expect(await signUp("a@example.com", "x")).toEqual({ kind });
  });

  it("reads a namespaced __type", async () => {
    stubFetch(cognitoError("com.amazonaws.cognito.identity.idp.model#CodeMismatchException"));
    expect(await confirmSignUp("a@example.com", "1")).toEqual({ kind: "wrong-code" });
  });

  it("maps a network failure to network", async () => {
    stubFetch(new TypeError("Failed to fetch"));
    expect(await signUp("a@example.com", "x")).toEqual({ kind: "network" });
  });

  it("maps an unreadable error body to error", async () => {
    stubFetch(new Response("<html>bad gateway</html>", { status: 502 }));
    expect(await resendCode("a@example.com")).toEqual({ kind: "error" });
  });

  it("never carries Cognito's raw message", async () => {
    stubFetch(cognitoError("InvalidPasswordException"));
    expect(JSON.stringify(await signUp("a@example.com", "x"))).not.toContain("raw text");
  });
});

describe("signIn", () => {
  it("uses the password flow and returns the tokens", async () => {
    const fetch = stubFetch(
      Response.json({ AuthenticationResult: { IdToken: "id1", RefreshToken: "rt1", AccessToken: "ac", ExpiresIn: 3600 } }),
    );
    expect(await signIn("a@example.com", "pw")).toEqual({
      kind: "ok",
      tokens: { idToken: "id1", refreshToken: "rt1", expiresInSeconds: 3600 },
    });
    expect(sentBody(fetch)).toEqual({
      ClientId: "testclientid",
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: "a@example.com", PASSWORD: "pw" },
    });
  });

  it("treats a challenge as an error, since the pool has no MFA", async () => {
    stubFetch(Response.json({ ChallengeName: "NEW_PASSWORD_REQUIRED" }));
    expect(await signIn("a@example.com", "pw")).toEqual({ kind: "error" });
  });

  it("maps wrong credentials and unconfirmed people", async () => {
    stubFetch(cognitoError("NotAuthorizedException"));
    expect(await signIn("a@example.com", "bad")).toEqual({ kind: "not-authorized" });
    stubFetch(cognitoError("UserNotConfirmedException"));
    expect(await signIn("a@example.com", "pw")).toEqual({ kind: "not-confirmed" });
  });

  it("rejects a result missing a token", async () => {
    stubFetch(Response.json({ AuthenticationResult: { IdToken: "id1", ExpiresIn: 3600 } }));
    expect(await signIn("a@example.com", "pw")).toEqual({ kind: "error" });
  });
});

describe("refreshSession", () => {
  it("returns a new ID token when Cognito sends no new refresh token", async () => {
    const fetch = stubFetch(Response.json({ AuthenticationResult: { IdToken: "id2", ExpiresIn: 3600 } }));
    expect(await refreshSession("rt1")).toEqual({ kind: "ok", tokens: { idToken: "id2", expiresInSeconds: 3600 } });
    expect(sentBody(fetch)).toEqual({
      ClientId: "testclientid",
      AuthFlow: "REFRESH_TOKEN_AUTH",
      AuthParameters: { REFRESH_TOKEN: "rt1" },
    });
  });

  it("passes on a rotated refresh token", async () => {
    stubFetch(Response.json({ AuthenticationResult: { IdToken: "id2", RefreshToken: "rt2", ExpiresIn: 60 } }));
    expect(await refreshSession("rt1")).toEqual({
      kind: "ok",
      tokens: { idToken: "id2", refreshToken: "rt2", expiresInSeconds: 60 },
    });
  });

  it("reports a rejected refresh token as not-authorized", async () => {
    stubFetch(cognitoError("NotAuthorizedException"));
    expect(await refreshSession("old")).toEqual({ kind: "not-authorized" });
  });

  it("reports a network failure as network", async () => {
    stubFetch(new TypeError("offline"));
    expect(await refreshSession("rt1")).toEqual({ kind: "network" });
  });
});
