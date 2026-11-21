import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "../testing";
import { SignIn } from "./SignIn";

beforeEach(() => localStorage.clear());

describe("SignIn", () => {
  it("offers sign-in and forgot password in pt-BR, and no way to sign up", () => {
    const { container } = renderApp(<SignIn onForgot={() => {}} />, { signedIn: false });
    expect(screen.getByRole("button", { name: "Entrar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Esqueci a senha" })).toBeTruthy();
    expect(container.textContent).not.toMatch(/cadastr|criar conta|sign up|register/i);
    expect(container.querySelector("a")).toBeNull();
  });

  it("says the same thing for any wrong credentials, without naming the email", async () => {
    const { auth } = renderApp(<SignIn onForgot={() => {}} />, { signedIn: false, locale: "en" });
    vi.mocked(auth.signIn).mockResolvedValue({ kind: "not-authorized" });
    await userEvent.type(screen.getByLabelText("Email"), "nobody@x.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("The email or password is wrong.");
    expect(alert.textContent).not.toContain("nobody@x.com");
  });
});
