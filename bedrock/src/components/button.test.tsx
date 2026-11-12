import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "./button";
import { Switch } from "./switch";

afterEach(cleanup);

describe("Button", () => {
  it("defaults to type=button and a loading button is inert and busy", async () => {
    const submit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(
      <form onSubmit={submit}>
        <Button loading>Salvar</Button>
      </form>,
    );
    const b = screen.getByRole("button", { name: "Salvar" }) as HTMLButtonElement;
    expect(b.type).toBe("button");
    expect(b.disabled).toBe(true);
    expect(b.getAttribute("aria-busy")).toBe("true");
    await userEvent.click(b);
    expect(submit).not.toHaveBeenCalled();
  });

  it("asChild renders the child instead of a button", () => {
    render(
      <Button asChild>
        <a href="/x">Abrir</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Abrir" })).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("Switch", () => {
  it("is named by its label and Space toggles it", async () => {
    const onChange = vi.fn();
    render(<Switch label="Avisos" onCheckedChange={onChange} />);
    screen.getByRole("switch", { name: "Avisos" }).focus();
    await userEvent.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
