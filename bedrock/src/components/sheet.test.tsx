import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "./dialog";
import { Sheet } from "./sheet";

// Stands in for (min-width: 768px), the value of --bp-tablet.
function stubViewport(wide: boolean) {
  vi.stubGlobal("matchMedia", () => ({ matches: wide, addEventListener() {}, removeEventListener() {} }));
}

afterEach(() => vi.unstubAllGlobals());

const drawer = () => document.querySelector("[data-vaul-drawer]");

describe("Sheet", () => {
  it("renders the side panel at or above the tablet breakpoint", () => {
    stubViewport(true);
    render(
      <Sheet open onOpenChange={() => {}} title="Filtros" closeLabel="Fechar">
        corpo
      </Sheet>,
    );
    expect(screen.getByRole("dialog", { name: "Filtros" })).toBeTruthy();
    expect(drawer()).toBeNull();
  });

  it("renders the vaul drawer below it", () => {
    stubViewport(false);
    render(
      <Sheet open onOpenChange={() => {}} title="Filtros" closeLabel="Fechar">
        corpo
      </Sheet>,
    );
    expect(drawer()).not.toBeNull();
    expect(screen.getByRole("button", { name: "Fechar" })).toBeTruthy();
  });

  it("stops the bottom drawer's slide-in animation under reduced motion", () => {
    stubViewport(false);
    render(
      <Sheet open onOpenChange={() => {}} title="Filtros" closeLabel="Fechar">
        corpo
      </Sheet>,
    );
    expect(screen.getByRole("dialog", { name: "Filtros" }).className).toContain("motion-reduce:animate-none!");
  });

  it.each([true, false])("Escape closes it (wide: %s)", async (wide) => {
    stubViewport(wide);
    const onOpenChange = vi.fn();
    render(
      <Sheet open onOpenChange={onOpenChange} title="Filtros" closeLabel="Fechar">
        corpo
      </Sheet>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("swaps panel for drawer when the viewport crosses the breakpoint, staying open", () => {
    let matches = true;
    let listener = () => {};
    vi.stubGlobal("matchMedia", () => ({
      get matches() {
        return matches;
      },
      addEventListener: (_: string, l: () => void) => (listener = l),
      removeEventListener() {},
    }));
    const onOpenChange = vi.fn();
    render(
      <Sheet open onOpenChange={onOpenChange} title="Filtros" closeLabel="Fechar">
        corpo
      </Sheet>,
    );
    expect(drawer()).toBeNull();
    act(() => {
      matches = false;
      listener();
    });
    expect(drawer()).not.toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("returns focus to the trigger from the side panel", async () => {
    stubViewport(true);
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <Sheet open={open} onOpenChange={setOpen} title="Filtros" closeLabel="Fechar" trigger={<button>Abrir</button>}>
          corpo
        </Sheet>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Abrir" });
    await userEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it.each([true, false])("returns focus to returnFocusRef when opened without a trigger (wide: %s)", async (wide) => {
    stubViewport(wide);
    function Harness() {
      const [open, setOpen] = useState(false);
      const ref = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={ref} onClick={() => setOpen(true)}>
            Abrir
          </button>
          <Sheet open={open} onOpenChange={setOpen} title="Filtros" closeLabel="Fechar" returnFocusRef={ref}>
            corpo
          </Sheet>
        </>
      );
    }
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Abrir" }));
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Abrir" })));
  });
});

describe("Dialog", () => {
  it("confirm calls onConfirm and Escape closes it", async () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    render(
      <Dialog
        open
        onOpenChange={onOpenChange}
        title="Excluir?"
        description="Não dá para desfazer."
        cancelLabel="Cancelar"
        confirmLabel="Excluir"
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByRole("alertdialog", { name: "Excluir?" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(onConfirm).toHaveBeenCalled();
    onOpenChange.mockClear();
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
