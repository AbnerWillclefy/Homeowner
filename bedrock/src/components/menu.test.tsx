import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pencil, Trash2 } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Menu } from "./menu";

// Stands in for (min-width: 768px), the value of --bp-tablet.
function stubViewport(wide: boolean) {
  vi.stubGlobal("matchMedia", () => ({ matches: wide, addEventListener() {}, removeEventListener() {} }));
}

afterEach(() => vi.unstubAllGlobals());

function setup() {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  render(
    <Menu
      label="Mais ações"
      closeLabel="Fechar"
      items={[
        { label: "Excluir", icon: Trash2, onSelect: onDelete, danger: true },
        { label: "Editar", icon: Pencil, onSelect: onEdit },
      ]}
    />,
  );
  return { onEdit, onDelete };
}

describe("Menu", () => {
  it("wide: opens with the keyboard, ArrowDown and Enter run an item, focus returns to the trigger", async () => {
    stubViewport(true);
    const { onEdit, onDelete } = setup();
    const trigger = screen.getByRole("button", { name: "Mais ações" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    // The danger item was passed first but renders last.
    expect(screen.getAllByRole("menuitem").map((e) => e.textContent)).toEqual(["Editar", "Excluir"]);
    // Opening from the keyboard highlights the first item; ArrowDown moves to the next.
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onDelete).toHaveBeenCalledOnce();
    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("narrow: the trigger opens the Sheet with the items as 48px row buttons", async () => {
    stubViewport(false);
    const { onEdit } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Mais ações" }));
    expect(screen.getByRole("dialog", { name: "Mais ações" })).toBeTruthy();
    const edit = screen.getByRole("button", { name: "Editar" });
    expect(screen.getByRole("button", { name: "Excluir" })).toBeTruthy();
    expect(edit.className).toContain("h-control-lg");
    await userEvent.click(edit);
    expect(onEdit).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
