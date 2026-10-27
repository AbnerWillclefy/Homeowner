// @vitest-environment jsdom
import { act, createElement, createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { mountWithI18n } from "../../../shared/ui/testing";
import type { PillInput } from "../logic/energyPill";
import { EnergyPill } from "./EnergyPill";

const { render, container } = mountWithI18n();
const box = () => container().firstElementChild as HTMLElement;
const button = () => container().querySelector("button") as HTMLButtonElement;
const show = (input: PillInput) => {
  const onOpen = vi.fn();
  const onRetry = vi.fn();
  render(createElement(EnergyPill, { input, buttonRef: createRef<HTMLButtonElement>(), onOpen, onRetry }));
  return { onOpen, onRetry };
};
const ready = (note: "energy" | "unset", energy: number | null): PillInput => ({ kind: "ready", note, energy, level: null });

describe("EnergyPill", () => {
  it("holds an empty, hidden box of the Streak's size while it loads", () => {
    show({ kind: "loading" });
    expect(box().getAttribute("aria-hidden")).toBe("true");
    expect(box().className).toContain("h-11");
    expect(box().className).toContain("w-16");
    expect(box().querySelector("span")).toBeNull();
  });

  it("draws the pulsing placeholder only after 300ms", () => {
    show({ kind: "loading" });
    act(() => vi.advanceTimersByTime(299));
    expect(box().querySelector("span")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(box().querySelector("span")).not.toBeNull();
  });

  it("is a button with the minimum width and no dashed edge, named with the state", () => {
    show(ready("energy", 5));
    expect(button().className).toContain("min-w-16");
    expect(button().className).not.toContain("border-dashed");
    expect(button().getAttribute("aria-label")).toBe("Energy today: 5. Change Check-in");
  });

  it("mutes the unset state", () => {
    show(ready("unset", null));
    expect(button().className).toContain("text-muted");
    expect(button().textContent).toBe("?");
  });

  it("retries on a tap when the read failed, and does not open the dialog", () => {
    const { onOpen, onRetry } = show({ kind: "failed" });
    act(() => button().click());
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("opens the dialog with the button on a tap in any other state", () => {
    const { onOpen, onRetry } = show(ready("energy", 5));
    act(() => button().click());
    expect(onOpen).toHaveBeenCalledWith(button());
    expect(onRetry).not.toHaveBeenCalled();
  });
});
