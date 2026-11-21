import { render, screen } from "@testing-library/react";
import { Home } from "lucide-react";
import { expect, it } from "vitest";
import { BottomBar } from "./bottom-bar";

it("never truncates a tab label", () => {
  render(<BottomBar label="Nav" items={[{ href: "#a", label: "Lançamentos", icon: Home, current: true }]} />);
  const cls = screen.getByText("Lançamentos").className;
  expect(cls).not.toContain("truncate");
  expect(cls).toContain("whitespace-nowrap");
});
