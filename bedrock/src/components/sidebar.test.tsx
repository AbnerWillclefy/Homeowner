import { cleanup, render, screen, within } from "@testing-library/react";
import { Home, Settings } from "lucide-react";
import { afterEach, expect, it } from "vitest";
import { Sidebar, SidebarBrand } from "./sidebar";

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

it("shows the item label as a tooltip on focus", async () => {
  render(<Sidebar label="Primary" groups={[{ label: "Main", items: [{ href: "/", label: "Overview", icon: Home }] }]} />);
  screen.getByRole("link", { name: "Overview" }).focus();
  expect((await screen.findByRole("tooltip")).textContent).toBe("Overview");
});

const bills = (badge?: { count: number; label: string }) => (
  <Sidebar label="Primary" groups={[{ label: "Main", items: [{ href: "/b", label: "Bills", icon: Home, badge }] }]} />
);

it("shows the badge count and puts its label in the link name", () => {
  render(bills({ count: 12, label: "12 bills open" }));
  const link = screen.getByRole("link", { name: "Bills, 12 bills open" });
  expect(link.textContent).toBe("Bills9+, 12 bills open");
});

it("renders no badge for a count of 0 or no badge", () => {
  render(bills({ count: 0, label: "none" }));
  expect(screen.getByRole("link").textContent).toBe("Bills");
  cleanup();
  render(bills());
  expect(screen.getByRole("link").textContent).toBe("Bills");
});

it("renders the brand and the note between the groups and the footer", () => {
  render(
    <Sidebar
      label="Primary"
      brand={<SidebarBrand name="Homeowner" />}
      groups={[{ label: "Main", items: [{ href: "/", label: "Overview", icon: Home }] }]}
      note="Updated 2 h ago"
      footer={[{ href: "/s", label: "Settings", icon: Settings }]}
    />,
  );
  expect(screen.getByText("Homeowner")).toBeTruthy();
  const note = screen.getByText("Updated 2 h ago");
  const [overview, settings] = [screen.getByRole("link", { name: "Overview" }), screen.getByRole("link", { name: "Settings" })];
  expect(overview.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(note.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
