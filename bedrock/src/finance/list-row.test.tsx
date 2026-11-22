import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Check } from "lucide-react";
import axe from "axe-core";
import { afterEach, expect, it, vi } from "vitest";
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

const action = (extra = {}) => ({ label: "Marcar Aluguel como paga", icon: Check, onClick: () => {}, ...extra });

it("puts the action beside the link, not inside it", () => {
  render(
    <ListRow asChild title="Aluguel" cents={-250000} action={action()}>
      <a href="#rent" />
    </ListRow>,
  );
  const link = screen.getByRole("link");
  const button = screen.getByRole("button", { name: "Marcar Aluguel como paga" });
  expect(screen.getAllByRole("button")).toHaveLength(1);
  expect(link.contains(button)).toBe(false);
});

it("calls onClick without following the link", () => {
  const onClick = vi.fn();
  const follow = vi.fn();
  render(
    <div onClick={follow}>
      <ListRow asChild title="Aluguel" cents={-250000} action={action({ onClick })}>
        <a href="#rent" onClick={follow} />
      </ListRow>
    </div>,
  );
  fireEvent.click(screen.getByRole("button"));
  expect(onClick).toHaveBeenCalledOnce();
  expect(follow).toHaveBeenCalledTimes(1); // only the wrapper's bubble from the button, never the link's own handler
});

it("shows loading as busy and disabled", () => {
  render(<ListRow title="Aluguel" cents={-250000} action={action({ loading: true })} />);
  const button = screen.getByRole("button");
  expect(button.getAttribute("aria-busy")).toBe("true");
  expect((button as HTMLButtonElement).disabled).toBe(true);
});

it("names the action for assistive tech while the visible text stays short", () => {
  render(<ListRow title="Aluguel" cents={-250000} action={action({ label: "Marcar paga", name: "Marcar paga: Aluguel" })} />);
  const button = screen.getByRole("button", { name: "Marcar paga: Aluguel" });
  expect(button.textContent).toBe("Marcar paga");
});

it("renders a row without an action as its own root", () => {
  const { container } = render(
    <ListRow asChild title="Aluguel" cents={-250000}>
      <a href="#rent" />
    </ListRow>,
  );
  expect(container.firstElementChild).toBe(screen.getByRole("link"));
});

it("has no axe violations with an action", async () => {
  const { container } = render(
    <ul>
      <li>
        <ListRow asChild title="Aluguel" cents={-250000} action={action()}>
          <a href="#rent" />
        </ListRow>
      </li>
    </ul>,
  );
  expect((await axe.run(container, { rules: { region: { enabled: false } } })).violations).toEqual([]);
});
