const encode = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString("base64url");

/**
 * An unsigned ID token that looks like Cognito's. The app only decodes the payload (emailFromIdToken) and
 * never verifies it, so seeded sessions and the Cognito fake's sign-in tokens can share this one function.
 * `exp` is in epoch seconds, like a real JWT.
 */
export function makeIdToken({ email, sub, exp }: { email: string; sub: string; exp: number }): string {
  return [encode({ alg: "none", typ: "JWT" }), encode({ email, sub, exp }), "e2e-signature"].join(".");
}
