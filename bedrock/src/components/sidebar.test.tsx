import { cleanup, render, screen, within } from "@testing-library/react";
import { Home, Settings } from "lucide-react";
import { afterEach, expect, it } from "vitest";
import { Sidebar } from "./sidebar";

// Vitest globals are off, so testing-library does not clean up on its own.
afterEach(cleanup);

it("marks the current page and names each group list", () => {
  render(
    <Sidebar
      label="Primary"
      groups={[{ label: "Main", items: [{ href: "/", label: "Overview", icon: Home, current: true }] }]}
      footer={[{ href: "/s", label: "Settings", icon: Settings }]}
    />,
  );
  expect(screen.getByRole("link", { name: "Overview" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Settings" }).hasAttribute("aria-current")).toBe(false);
  expect(within(screen.getByRole("list", { name: "Main" })).getAllByRole("link")).toHaveLength(1);
});
