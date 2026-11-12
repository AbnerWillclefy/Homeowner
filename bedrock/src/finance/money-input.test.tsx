import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import { MoneyInput } from "./money-input";

function Harness({ spy, error, initial = null }: { spy: (c: number | null) => void; error?: string; initial?: number | null }) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <MoneyInput
      label="Amount"
      value={value}
      error={error}
      onValueChange={(c) => {
        spy(c);
        setValue(c);
      }}
    />
  );
}

const field = () => screen.getByRole("textbox", { name: "Amount" }) as HTMLInputElement;

it("typing 1.234,56 yields 123456 and blur formats it", async () => {
  const spy = vi.fn();
  const user = userEvent.setup();
  render(<Harness spy={spy} />);
  await user.type(field(), "1.234,56");
  expect(spy).toHaveBeenLastCalledWith(123456);
  await user.tab();
  expect(field().value).toBe("1.234,56");
});

it("blur reformats a plain amount to two decimals", async () => {
  const user = userEvent.setup();
  render(<Harness spy={() => {}} />);
  await user.type(field(), "1234.5");
  await user.tab();
  expect(field().value).toBe("1.234,50");
});

it("pasting R$ 1,234.56 yields 123456", async () => {
  const spy = vi.fn();
  const user = userEvent.setup();
  render(<Harness spy={spy} />);
  await user.click(field());
  await user.paste("R$ 1,234.56");
  expect(spy).toHaveBeenLastCalledWith(123456);
});

it("clearing the field yields null", async () => {
  const spy = vi.fn();
  const user = userEvent.setup();
  render(<Harness spy={spy} initial={500} />);
  expect(field().value).toBe("5,00");
  await user.clear(field());
  expect(spy).toHaveBeenLastCalledWith(null);
});

it("negative input yields null", async () => {
  const spy = vi.fn();
  const user = userEvent.setup();
  render(<Harness spy={spy} />);
  await user.type(field(), "-5");
  expect(spy).toHaveBeenLastCalledWith(null);
});

it("an error is tied to the field and announced", () => {
  render(<Harness spy={() => {}} error="Enter an amount above zero." />);
  const described = screen.getByRole("textbox", { description: /Enter an amount above zero/ });
  expect(described.getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByRole("alert").textContent).toContain("Enter an amount above zero.");
});

it("reformats the shown amount when the locale changes", () => {
  const { rerender } = render(<MoneyInput label="Amount" value={123456} locale="pt-BR" onValueChange={() => {}} />);
  expect(field().value).toBe("1.234,56");
  rerender(<MoneyInput label="Amount" value={123456} locale="en" onValueChange={() => {}} />);
  expect(field().value).toBe("1,234.56");
});

it("hides the currency prefix from assistive technology", () => {
  render(<Harness spy={() => {}} />);
  expect(screen.getByText("R$").getAttribute("aria-hidden")).toBe("true");
});

it("a parent that clears the value on submit empties the focused field", async () => {
  function Form() {
    const [value, setValue] = useState<number | null>(null);
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setValue(null);
        }}
      >
        <MoneyInput label="Amount" value={value} onValueChange={setValue} />
      </form>
    );
  }
  const user = userEvent.setup();
  render(<Form />);
  await user.type(field(), "12,50{Enter}");
  expect(field().value).toBe("");
});
