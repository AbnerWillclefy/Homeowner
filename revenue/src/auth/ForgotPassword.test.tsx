import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "../testing";
import { confirmForgotPassword, forgotPassword } from "./cognito";
import { ForgotPassword } from "./ForgotPassword";

vi.mock("./cognito", () => ({ forgotPassword: vi.fn(), confirmForgotPassword: vi.fn() }));
const send = vi.mocked(forgotPassword);
const confirm = vi.mocked(confirmForgotPassword);

beforeEach(() => {
  localStorage.clear();
  send.mockReset();
  confirm.mockReset();
});

async function toCodeStep() {
  send.mockResolvedValue({ kind: "ok" });
  renderApp(<ForgotPassword onBack={() => {}} />, { locale: "en" });
  await userEvent.type(screen.getByLabelText("Email"), "a@b.c");
  await userEvent.click(screen.getByRole("button", { name: /send code/i }));
  await screen.findByLabelText(/^code/i);
}

async function submitCode() {
  await userEvent.type(screen.getByLabelText(/^code/i), "123456");
  await userEvent.type(screen.getByLabelText(/new password/i), "Passw0rd!x");
  await userEvent.click(screen.getByRole("button", { name: "Change password" }));
}

describe("ForgotPassword", () => {
  it("moves from email to code to done", async () => {
    await toCodeStep();
    confirm.mockResolvedValue({ kind: "ok" });
    await submitCode();
    expect(await screen.findByText("Password changed. Sign in with the new password.")).toBeTruthy();
    expect(confirm).toHaveBeenCalledWith("a@b.c", "123456", "Passw0rd!x");
  });

  it("shows the mismatch message, and Request another code clears it and returns to email", async () => {
    await toCodeStep();
    confirm.mockResolvedValue({ kind: "code-mismatch" });
    await submitCode();
    expect(await screen.findByText("That code is wrong. Check your email and try again.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /new code/i }));
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.queryByText("That code is wrong. Check your email and try again.")).toBeNull();
  });

  it("falls back to the generic message for an unknown failure kind", async () => {
    await toCodeStep();
    confirm.mockResolvedValue({ kind: "error" });
    await submitCode();
    expect(await screen.findByText("Could not finish. Try again.")).toBeTruthy();
  });
});
