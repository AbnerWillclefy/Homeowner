import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { StepIndicator } from "./step-indicator";

it("writes the label and the step name as text", () => {
  render(<StepIndicator label="Passo 2 de 5" current={2} total={5} name="Energia base" />);
  expect(screen.getByText("Passo 2 de 5").textContent).toContain("Energia base");
});

it("draws one hidden segment per step, the done ones and the current in brand", () => {
  const { container } = render(<StepIndicator label="Passo 2 de 5" current={2} total={5} />);
  const track = container.querySelector("[aria-hidden]")!;
  const segments = [...track.children];
  expect(segments).toHaveLength(5);
  expect(segments.map((s) => s.className.includes("bg-brand"))).toEqual([true, true, false, false, false]);
});
