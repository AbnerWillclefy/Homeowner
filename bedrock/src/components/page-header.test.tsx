import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Plus } from "lucide-react";
import { createRef } from "react";
import { expect, it, vi } from "vitest";
import { PageHeader } from "./page-header";

it("renders exactly one h1 with the given id, and the ref points at it", () => {
  const ref = createRef<HTMLHeadingElement>();
  render(<PageHeader title="Contas" subtitle="3 contas" id="top" headingRef={ref} />);
  const h1 = screen.getAllByRole("heading");
  expect(h1).toHaveLength(1);
  expect(h1[0].id).toBe("top");
  expect(ref.current).toBe(h1[0]);
  expect(h1[0].tabIndex).toBe(-1);
  expect(screen.getByText("3 contas")).toBeTruthy();
});

it("shows the period, tools, action and trailing slots, and the action is named by its label", async () => {
  const onClick = vi.fn();
  render(<PageHeader title="Contas" period={<p>Novembro</p>} tools={<button>Filtro</button>} trailing={<button>Olho</button>} action={{ label: "Nova conta", icon: Plus, onClick }} />);
  for (const t of ["Novembro", "Filtro", "Olho"]) expect(screen.getByText(t)).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Nova conta" }));
  expect(onClick).toHaveBeenCalledOnce();
});
