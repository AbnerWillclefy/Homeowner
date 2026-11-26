import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import { Choice, ChoiceGroup } from "./choice-group";

function Harness({ onChange = () => {} }: { onChange?: (v: string) => void }) {
  const [v, setV] = useState<string | undefined>("low");
  return (
    <ChoiceGroup label="Energy" value={v} onValueChange={(n) => { setV(n); onChange(n); }}>
      <Choice value="low" label="Low" hint="Rest day" />
      <Choice value="high" label="High" />
      <Choice value="off" label="Off" disabled />
    </ChoiceGroup>
  );
}

it("names the group and each radio, and checks the current value", () => {
  render(<Harness />);
  expect(screen.getByRole("radiogroup", { name: "Energy" })).toBeTruthy();
  expect((screen.getByRole("radio", { name: /Low/ }) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole("radio", { name: "High" }) as HTMLInputElement).checked).toBe(false);
});

it("calls onValueChange when another choice is tapped", async () => {
  const onChange = vi.fn();
  render(<Harness onChange={onChange} />);
  await userEvent.click(screen.getByText("High"));
  expect(onChange).toHaveBeenCalledWith("high");
  expect((screen.getByRole("radio", { name: "High" }) as HTMLInputElement).checked).toBe(true);
});

it("shows the check icon only on the selected choice, and ignores a disabled one", async () => {
  const onChange = vi.fn();
  const { container } = render(<Harness onChange={onChange} />);
  expect(container.querySelectorAll("svg")).toHaveLength(1);
  await userEvent.click(screen.getByText("Off"));
  expect(onChange).not.toHaveBeenCalled();
});

it("refuses a Choice outside a group", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect(() => render(<Choice value="a" label="A" />)).toThrow();
});

it("draws the leading visual without adding it to the radio's name", () => {
  render(
    <ChoiceGroup label="Q" value={undefined} onValueChange={() => {}}>
      <Choice value="a" label="Alta" leading={<svg data-testid="ico" />} />
    </ChoiceGroup>,
  );
  expect(screen.getByTestId("ico")).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Alta" })).toBeTruthy();
});

it("trades the surface for the hero's dark wash on a hero card, and inverts the checked choice", () => {
  const { container } = render(
    <ChoiceGroup label="Q" value="b" onValueChange={() => {}} onHero>
      <Choice value="a" label="A" />
      <Choice value="b" label="B" />
    </ChoiceGroup>,
  );
  const [open, picked] = container.querySelectorAll("label");
  expect(open.className).toContain("bg-[rgb(0_0_0/0.24)]");
  expect(open.className).not.toContain("bg-surface");
  expect(picked.className).toContain("bg-on-hero");
});
