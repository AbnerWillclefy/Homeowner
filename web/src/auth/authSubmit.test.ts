import { describe, expect, it, vi } from "vitest";
import type { CognitoFailure, CognitoResult, SignInResult } from "./cognito";
import { createConfirmSubmitter, createSignInSubmitter, createSignUpSubmitter } from "./authSubmit";

const tokens = { idToken: "i", refreshToken: "r", expiresInSeconds: 3600 };

function watch() {
  const busy: boolean[] = [];
  const problems: (CognitoFailure | null)[] = [];
  return { busy, problems, onBusy: (b: boolean) => busy.push(b), onProblem: (p: CognitoFailure | null) => problems.push(p) };
}

describe("sign in submit", () => {
  function setup(result: SignInResult) {
    const logIn = vi.fn(() => Promise.resolve(result));
    const onNeedsConfirm = vi.fn();
    const w = watch();
    return { logIn, onNeedsConfirm, w, submit: createSignInSubmitter({ logIn, onNeedsConfirm, ...w }) };
  }

  it("sends one request for a double click or double Enter in the same tick", async () => {
    const { logIn, submit } = setup({ kind: "ok", tokens });
    await Promise.all([submit("a@b.c", "pw"), submit("a@b.c", "pw")]);
    expect(logIn).toHaveBeenCalledTimes(1);
  });

  it("goes busy while in flight and back to normal after a failure, and the retry sends again", async () => {
    const { logIn, w, submit } = setup({ kind: "not-authorized" });
    await submit("a@b.c", "pw");
    expect(w.busy).toEqual([true, false]);
    expect(w.problems.at(-1)).toEqual({ kind: "not-authorized" });
    await submit("a@b.c", "pw");
    expect(logIn).toHaveBeenCalledTimes(2);
  });

  it("sends an unconfirmed email to the code screen without showing a failure", async () => {
    const { onNeedsConfirm, w, submit } = setup({ kind: "not-confirmed" });
    await submit("a@b.c", "pw");
    expect(onNeedsConfirm).toHaveBeenCalledWith("a@b.c");
    expect(w.problems).toEqual([null]);
  });
});

describe("sign up submit", () => {
  function setup(result: CognitoResult) {
    const register = vi.fn(() => Promise.resolve(result));
    const onRegistered = vi.fn();
    const w = watch();
    return { register, onRegistered, w, submit: createSignUpSubmitter({ register, onRegistered, ...w }) };
  }

  it("registers once for a double click in the same tick", async () => {
    const { register, onRegistered, submit } = setup({ kind: "ok" });
    await Promise.all([submit("a@b.c", "pw"), submit("a@b.c", "pw")]);
    expect(register).toHaveBeenCalledTimes(1);
    expect(onRegistered).toHaveBeenCalledTimes(1);
  });

  it("keeps the failure inline and re-arms after it", async () => {
    const { register, w, submit } = setup({ kind: "already-registered" });
    await submit("a@b.c", "pw");
    expect(w.problems.at(-1)).toEqual({ kind: "already-registered" });
    await submit("a@b.c", "pw");
    expect(register).toHaveBeenCalledTimes(2);
  });
});

describe("confirm submit", () => {
  function setup(confirmResult: CognitoResult, resendResult: CognitoResult = { kind: "ok" }) {
    const confirm = vi.fn(() => Promise.resolve(confirmResult));
    const resend = vi.fn(() => Promise.resolve(resendResult));
    const onConfirmed = vi.fn();
    const onResent = vi.fn();
    const w = watch();
    return { confirm, resend, onConfirmed, onResent, w, form: createConfirmSubmitter({ confirm, resend, onConfirmed, onResent, ...w }) };
  }

  it("confirms once for a double Enter in the same tick", async () => {
    const { confirm, onConfirmed, form } = setup({ kind: "ok" });
    await Promise.all([form.submit("a@b.c", "123456"), form.submit("a@b.c", "123456")]);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(onConfirmed).toHaveBeenCalledTimes(1);
  });

  it("sends one new code for a double tap on resend", async () => {
    const { resend, onResent, form } = setup({ kind: "ok" });
    await Promise.all([form.resend("a@b.c"), form.resend("a@b.c")]);
    expect(resend).toHaveBeenCalledTimes(1);
    expect(onResent).toHaveBeenCalledTimes(1);
  });

  it("holds a submit while a resend is in flight", async () => {
    const { confirm, form } = setup({ kind: "ok" });
    await Promise.all([form.resend("a@b.c"), form.submit("a@b.c", "123456")]);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("keeps a wrong code inline and re-arms", async () => {
    const { confirm, w, form } = setup({ kind: "wrong-code" });
    await form.submit("a@b.c", "000000");
    expect(w.problems.at(-1)).toEqual({ kind: "wrong-code" });
    await form.submit("a@b.c", "111111");
    expect(confirm).toHaveBeenCalledTimes(2);
  });
});
