import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Home } from "lucide-react";
import { afterEach, expect, it, vi } from "vitest";
import { NavLink } from "./nav-link";

// Vitest globals are off, so testing-library does not clean up on its own.
afterEach(cleanup);

const item = { href: "/x", label: "X", icon: Home };

function setup() {
  const onNavigate = vi.fn();
  render(
    <NavLink item={item} onNavigate={onNavigate}>
      X
    </NavLink>,
  );
  return { onNavigate, link: screen.getByRole("link", { name: "X" }) };
}

it("hands a plain click to onNavigate and cancels the browser navigation", () => {
  const { onNavigate, link } = setup();
  // fireEvent returns false when preventDefault ran.
  expect(fireEvent.click(link)).toBe(false);
  expect(onNavigate).toHaveBeenCalledWith("/x");
});

it.each([{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }])(
  "leaves a modified click %o to the browser",
  (init) => {
    const { onNavigate, link } = setup();
    expect(fireEvent.click(link, init)).toBe(true);
    expect(onNavigate).not.toHaveBeenCalled();
  },
);
