import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ListRow } from "./list-row";

afterEach(cleanup);

it("fills the consumer's button with the title and the amount", () => {
  render(
    <ListRow asChild title="Mercado" cents={-18990}>
      <button type="button" />
    </ListRow>,
  );
  const button = screen.getByRole("button");
  expect(button.textContent).toContain("Mercado");
  expect(button.textContent).toMatch(/189/);
});

it("shows the hidden label instead of the digits", () => {
  render(<ListRow title="Mercado" cents={-18990} hidden hiddenLabel="Valor oculto" />);
  expect(screen.getByText("Valor oculto")).toBeTruthy();
  expect(document.body.textContent).not.toMatch(/189/);
});
