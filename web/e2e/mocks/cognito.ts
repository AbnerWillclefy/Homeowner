import type { Fake, FakeReply, FakeRequest } from "./router";
import { makeIdToken } from "./tokens";

/** The one confirmation code the fake accepts. */
export const CONFIRMATION_CODE = "123456";

const TARGET_PREFIX = "AWSCognitoIdentityProviderService.";
const ACTIONS = new Set(["SignUp", "ConfirmSignUp", "ResendConfirmationCode", "InitiateAuth"]);
const CONTENT_TYPE = "application/x-amz-json-1.1";

interface Policy {
  minimum_length: number;
  require_lowercase: boolean;
  require_uppercase: boolean;
  require_numbers: boolean;
  require_symbols: boolean;
}

/**
 * A small standalone copy of the rule, read from the same VITE_PASSWORD_POLICY JSON the build uses. It does not
 * import the app's passwordPolicy.ts: a test that reuses the app's own rule can never disagree with it.
 */
function meetsPolicy(password: string, policy: Policy): boolean {
  return (
    password.length >= policy.minimum_length &&
    (!policy.require_lowercase || /[a-z]/.test(password)) &&
    (!policy.require_uppercase || /[A-Z]/.test(password)) &&
    (!policy.require_numbers || /[0-9]/.test(password)) &&
    (!policy.require_symbols || /[^A-Za-z0-9\s]/.test(password))
  );
}

interface FakeUser {
  password: string;
  confirmed: boolean;
  sub: string;
}

/** What the fake answered. Never holds a password, so a failure message cannot leak one. */
export interface CognitoCall {
  action: string;
  username: string | null;
  authFlow?: string;
}

export interface FakeCognito extends Fake {
  /** Every supported request the fake answered, in order. */
  requests: CognitoCall[];
  /** The ID token last issued to each email. */
  issuedIdTokens: Map<string, string>;
  addUser(user: { email: string; password: string; confirmed: boolean }): void;
}

const failure = (type: string): FakeReply => ({
  status: 400,
  body: { __type: type, message: "e2e fake" },
  headers: { "content-type": CONTENT_TYPE },
});
const success = (body: unknown): FakeReply => ({ status: 200, body, headers: { "content-type": CONTENT_TYPE } });

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

export function createFakeCognito(options: { region: string; clientId: string; policy: string }): FakeCognito {
  const policy = JSON.parse(options.policy) as Policy;
  const host = `cognito-idp.${options.region}.amazonaws.com`;
  const users = new Map<string, FakeUser>();
  const requests: CognitoCall[] = [];
  const issuedIdTokens = new Map<string, string>();
  let counter = 0;

  function newUser(password: string, confirmed: boolean): FakeUser {
    counter += 1;
    return { password, confirmed, sub: `e2e-sub-${counter}` };
  }

  function signUp(username: string, body: Record<string, unknown>): FakeReply {
    if (users.has(username)) return failure("UsernameExistsException");
    const password = typeof body["Password"] === "string" ? body["Password"] : "";
    if (!meetsPolicy(password, policy)) return failure("InvalidPasswordException");
    const user = newUser(password, false);
    users.set(username, user);
    return success({
      UserConfirmed: false,
      UserSub: user.sub,
      CodeDeliveryDetails: { Destination: "e***@e***", DeliveryMedium: "EMAIL", AttributeName: "email" },
    });
  }

  function confirmSignUp(username: string, body: Record<string, unknown>): FakeReply {
    const user = users.get(username);
    if (!user) return failure("UserNotFoundException");
    if (body["ConfirmationCode"] !== CONFIRMATION_CODE) return failure("CodeMismatchException");
    user.confirmed = true;
    return success({});
  }

  function resend(username: string): FakeReply {
    const user = users.get(username);
    return user && !user.confirmed
      ? success({ CodeDeliveryDetails: { DeliveryMedium: "EMAIL" } })
      : failure("UserNotFoundException");
  }

  function signIn(username: string, password: unknown): FakeReply {
    const user = users.get(username);
    // Cognito does not tell an unknown user from a wrong password, and neither does the fake.
    if (!user || user.password !== password) return failure("NotAuthorizedException");
    if (!user.confirmed) return failure("UserNotConfirmedException");
    const idToken = makeIdToken({ email: username, sub: user.sub, exp: Math.floor(Date.now() / 1000) + 3600 });
    issuedIdTokens.set(username, idToken);
    return success({
      AuthenticationResult: {
        IdToken: idToken,
        AccessToken: `e2e-access-${user.sub}`,
        RefreshToken: `e2e-refresh-${user.sub}`,
        ExpiresIn: 3600,
        TokenType: "Bearer",
      },
    });
  }

  return {
    name: "cognito",
    requests,
    issuedIdTokens,
    matches: (url) => url.hostname === host,
    addUser({ email, password, confirmed }) {
      users.set(email, newUser(password, confirmed));
    },
    handle(request: FakeRequest) {
      const body = asRecord(request.body);
      const target = request.target?.startsWith(TARGET_PREFIX) ? request.target.slice(TARGET_PREFIX.length) : null;
      // Unmocked (the router answers 501 and the test fails): no or unknown target, or a client id other than
      // the build's, which is a real bug worth failing on.
      if (target === null || body["ClientId"] !== options.clientId) return null;

      const params = asRecord(body["AuthParameters"]);
      const rawUsername = target === "InitiateAuth" ? params["USERNAME"] : body["Username"];
      const username = typeof rawUsername === "string" ? rawUsername : "";

      // REFRESH_TOKEN_AUTH is deliberately unmocked: a premature refresh should fail loudly.
      if (target === "InitiateAuth" && body["AuthFlow"] !== "USER_PASSWORD_AUTH") return null;
      if (!ACTIONS.has(target)) return null;

      requests.push(
        target === "InitiateAuth"
          ? { action: target, username, authFlow: "USER_PASSWORD_AUTH" }
          : { action: target, username },
      );
      switch (target) {
        case "SignUp":
          return signUp(username, body);
        case "ConfirmSignUp":
          return confirmSignUp(username, body);
        case "ResendConfirmationCode":
          return resend(username);
        default:
          return signIn(username, params["PASSWORD"]);
      }
    },
  };
}
