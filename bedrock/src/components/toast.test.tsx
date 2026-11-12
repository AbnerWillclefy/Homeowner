import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Toast, ToastProvider } from "./toast";

// jsdom lacks pointer capture, which Radix Toast reads on pointer events.
Element.prototype.hasPointerCapture ??= () => false;

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

const undo = { label: "Desfazer", altText: "Desfazer a alteração", onClick: vi.fn() };

const setup = (props: Partial<Parameters<typeof Toast>[0]> = {}) => {
  const onOpenChange = vi.fn();
  render(
    <ToastProvider label="Notificações">
      <Toast open onOpenChange={onOpenChange} tone="positive" title="Salvo" closeLabel="Fechar" {...props} />
    </ToastProvider>,
  );
  return onOpenChange;
};

it("closes a toast without an action after 5 seconds", () => {
  const onOpenChange = setup();
  act(() => void vi.advanceTimersByTime(5000));
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

it("keeps a toast with an action on screen (WCAG 2.2.1: the Resident must be able to reach it)", () => {
  const onOpenChange = setup({ action: undo });
  act(() => void vi.advanceTimersByTime(60_000));
  expect(screen.getByText("Salvo")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Desfazer" })).toBeTruthy();
  expect(onOpenChange).not.toHaveBeenCalled();
});

it("dismisses with Escape from the focused toast", async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime, delay: null });
  const onOpenChange = setup({ action: undo });
  act(() => screen.getByRole("listitem").focus());
  await user.keyboard("{Escape}");
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

it("names the viewport and close button from props, and the action is a button", async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime, delay: null });
  setup({ action: undo });
  expect(screen.getByRole("region", { name: "Notificações" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Fechar" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Desfazer" }));
  expect(undo.onClick).toHaveBeenCalled();
});

it.each([
  ["positive", "svg.text-positive", 1],
  ["danger", "svg.text-danger", 1],
  ["neutral", "svg.size-5", 0],
] as const)("%s tone renders its icon: %i", (tone, selector, count) => {
  setup({ tone });
  expect(screen.getByRole("listitem").querySelectorAll(selector)).toHaveLength(count);
});
