import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmForgotPassword, forgotPassword, refreshSession, signIn } from "./cognito";

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);
afterEach(() => fetchMock.mockReset());

const reply = (status: number, body: unknown) => fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));
const refused = (type: string) => reply(400, { __type: type, message: "raw Cognito text" });
const sent = () => {
  const [url, init] = fetchMock.mock.calls[0]!;
  const headers = init!.headers as Record<string, string>;
  return { url, target: headers["X-Amz-Target"], body: JSON.parse(String(init!.body)) as Record<string, unknown> };
};

describe("request shape", () => {
  it("signs in with USER_PASSWORD_AUTH against the region's endpoint", async () => {
    reply(200, { AuthenticationResult: { IdToken: "i", RefreshToken: "r", ExpiresIn: 3600 } });
    expect(await signIn("a@x.com", "pw")).toEqual({ kind: "ok", tokens: { idToken: "i", refreshToken: "r", expiresInSeconds: 3600 } });
    expect(sent()).toEqual({
      url: "https://cognito-idp.eu-west-1.amazonaws.com/",
      target: "AWSCognitoIdentityProviderService.InitiateAuth",
      body: { ClientId: "testclientid", AuthFlow: "USER_PASSWORD_AUTH", AuthParameters: { USERNAME: "a@x.com", PASSWORD: "pw" } },
    });
  });

  it("refreshes with REFRESH_TOKEN_AUTH", async () => {
    reply(200, { AuthenticationResult: { IdToken: "i", ExpiresIn: 60 } });
    await refreshSession("rt");
    expect(sent().body).toMatchObject({ AuthFlow: "REFRESH_TOKEN_AUTH", AuthParameters: { REFRESH_TOKEN: "rt" } });
  });

  it("asks for a code with ForgotPassword", async () => {
    reply(200, { CodeDeliveryDetails: {} });
    expect(await forgotPassword("a@x.com")).toEqual({ kind: "ok" });
    expect(sent()).toMatchObject({ target: "AWSCognitoIdentityProviderService.ForgotPassword", body: { ClientId: "testclientid", Username: "a@x.com" } });
  });

  it("sets the new password with ConfirmForgotPassword", async () => {
    reply(200, {});
    expect(await confirmForgotPassword("a@x.com", "123456", "New-pass-1")).toEqual({ kind: "ok" });
    expect(sent()).toMatchObject({
      target: "AWSCognitoIdentityProviderService.ConfirmForgotPassword",
      body: { Username: "a@x.com", ConfirmationCode: "123456", Password: "New-pass-1" },
    });
  });

  it("has no sign-up call", async () => {
    const module = await import("./cognito");
    expect(Object.keys(module).filter((name) => /sign.?up/i.test(name))).toEqual([]);
  });
});

describe("error mapping", () => {
  it.each([
    ["NotAuthorizedException", "not-authorized"],
    ["com.amazonaws#NotAuthorizedException", "not-authorized"],
    ["UserNotConfirmedException", "not-confirmed"],
    ["LimitExceededException", "rate-limited"],
    ["TooManyRequestsException", "rate-limited"],
    ["SomethingNew", "error"],
  ])("sign-in %s is %s", async (type, kind) => {
    refused(type);
    expect(await signIn("a@x.com", "pw")).toEqual({ kind });
  });

  it.each([
    ["CodeMismatchException", "code-mismatch"],
    ["ExpiredCodeException", "code-expired"],
    ["InvalidPasswordException", "invalid-password"],
    ["LimitExceededException", "rate-limited"],
    ["UserNotFoundException", "code-mismatch"],
  ])("confirm %s is %s", async (type, kind) => {
    refused(type);
    expect(await confirmForgotPassword("a@x.com", "1", "p")).toEqual({ kind });
  });

  it("reports a network failure and an unreadable answer", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    expect(await signIn("a", "b")).toEqual({ kind: "network" });
    fetchMock.mockResolvedValue(new Response("<html>", { status: 502 }));
    expect(await signIn("a", "b")).toEqual({ kind: "error" });
  });
});

describe("no answer tells an unknown email apart", () => {
  it.each(["UserNotFoundException", "InvalidParameterException", "NotAuthorizedException", "UserNotConfirmedException"])(
    "ForgotPassword answers ok on %s, as it does for a known email",
    async (type) => {
      refused(type);
      expect(await forgotPassword("nobody@x.com")).toEqual({ kind: "ok" });
    },
  );

  it("sign-in gives a wrong email and a wrong password the same failure", async () => {
    refused("NotAuthorizedException");
    const wrongPassword = await signIn("known@x.com", "bad");
    refused("NotAuthorizedException");
    expect(await signIn("unknown@x.com", "bad")).toEqual(wrongPassword);
  });

  it("never carries Cognito's text into a failure", async () => {
    refused("CodeMismatchException");
    expect(JSON.stringify(await confirmForgotPassword("a", "1", "p"))).not.toContain("raw Cognito");
  });
});
