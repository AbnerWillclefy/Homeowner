import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CookingPot } from "lucide-react";
import { expect, it, vi } from "vitest";
import { ChoreTag } from "./chore-tag";
import { Effort } from "./effort";
import { Energy } from "./energy";
import { Streak } from "./streak";
import { TaskCard } from "./task-card";

const kitchen = { tone: "kitchen", icon: CookingPot } as const;

it("ChoreTag writes the Category name and hides the icon", () => {
  const { container } = render(<ChoreTag category={kitchen} label="Cozinha" />);
  expect(screen.getByText("Cozinha")).toBeTruthy();
  expect(container.querySelector("svg")?.closest("[aria-hidden]")).toBeTruthy();
});

it("Effort, Energy and Streak are named by their label prop", () => {
  render(
    <>
      <Effort level={3} name="Médio" label="Esforço: médio" />
      <Energy level={3} name="Normal" label="Energia: normal. Mudar" />
      <Streak days={6} paused label="Sequência pausada: 6 dias" />
    </>,
  );
  expect(screen.getByText("Esforço: médio")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Energia: normal. Mudar" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Sequência pausada: 6 dias" }).textContent).toBe("6");
});

it("TaskCard keeps its open button and its actions separate, and runs each", async () => {
  const open = vi.fn();
  const accept = vi.fn();
  render(
    <TaskCard
      category={kitchen} categoryLabel="Cozinha" name="Lavar a louça" why="Leve."
      effort={{ level: 2, name: "Leve", label: "Esforço: leve" }}
      onOpen={open}
      actions={[{ label: "Recusar Lavar a louça", onClick: vi.fn(), variant: "secondary" }, { label: "Aceitar Lavar a louça", onClick: accept }]}
    />,
  );
  expect(screen.getByRole("heading", { name: "Lavar a louça" })).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Aceitar Lavar a louça" }));
  await userEvent.click(screen.getByRole("button", { name: "Lavar a louça" }));
  expect(accept).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Lavar a louça" }).closest("article")?.querySelectorAll("article button button")).toHaveLength(0);
});
