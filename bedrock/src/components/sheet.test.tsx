import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "./dialog";
import { Menu } from "./menu";
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

  it.each([true, false])("moves focus into the panel when it opens (wide: %s)", async (wide) => {
    stubViewport(wide);
    render(
      <>
        <button>Abrir</button>
        <Sheet open onOpenChange={() => {}} title="Filtros" closeLabel="Fechar">
          corpo
        </Sheet>
      </>,
    );
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("dialog", { name: "Filtros" })));
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

describe("Sheet slots and modes", () => {
  it.each([true, false])("draws leading and tools in the header (wide: %s)", (wide) => {
    stubViewport(wide);
    render(
      <Sheet open onOpenChange={() => {}} title="Filtros" closeLabel="Fechar" leading={<i data-testid="lead" />} tools={<b data-testid="tool" />}>
        corpo
      </Sheet>,
    );
    const header = screen.getByRole("heading", { name: "Filtros" }).closest("header")!;
    expect(header.contains(screen.getByTestId("lead"))).toBe(true);
    expect(header.contains(screen.getByTestId("tool"))).toBe(true);
  });

  it.each([true, false])("dismissible={false} ignores Escape and disables the close button (wide: %s)", async (wide) => {
    stubViewport(wide);
    const onOpenChange = vi.fn();
    render(
      <Sheet open onOpenChange={onOpenChange} title="Filtros" closeLabel="Fechar" dismissible={false}>
        corpo
      </Sheet>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Fechar" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each([true, false])("closeButton={false} draws no close button, and Escape still closes (wide: %s)", async (wide) => {
    stubViewport(wide);
    const onOpenChange = vi.fn();
    render(
      <Sheet open onOpenChange={onOpenChange} title="Filtros" closeLabel="Fechar" closeButton={false}>
        corpo
      </Sheet>,
    );
    expect(screen.queryByRole("button", { name: "Fechar" })).toBeNull();
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('size="full" sets the 92% height on the drawer, auto does not', () => {
    stubViewport(false);
    const { rerender } = render(
      <Sheet open onOpenChange={() => {}} title="Filtros" closeLabel="Fechar" size="full">
        corpo
      </Sheet>,
    );
    expect(screen.getByRole("dialog").className).toContain("h-[92dvh]");
    rerender(
      <Sheet open onOpenChange={() => {}} title="Filtros" closeLabel="Fechar">
        corpo
      </Sheet>,
    );
    expect(screen.getByRole("dialog").className).not.toContain("h-[92dvh]");
  });

  it.each([true, false])("a Menu item in tools can be chosen with the keyboard (wide: %s)", async (wide) => {
    stubViewport(wide);
    const onSelect = vi.fn();
    render(
      <Sheet open onOpenChange={() => {}} title="Filtros" closeLabel="Fechar" tools={<Menu label="Mais ações" closeLabel="Fechar menu" items={[{ label: "Trocar", onSelect }]} />}>
        corpo
      </Sheet>,
    );
    screen.getByRole("button", { name: "Mais ações" }).focus();
    await userEvent.keyboard("{Enter}");
    const item = await screen.findByRole(wide ? "menuitem" : "button", { name: "Trocar" });
    if (wide) await userEvent.keyboard("{ArrowDown}");
    else for (let i = 0; i < 4 && document.activeElement !== item; i++) await userEvent.tab();
    expect(document.activeElement).toBe(item);
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalled();
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

describe("scrim", () => {
  const scrim = () => document.querySelector('[data-slot="scrim"]');

  it.each([true, false])("the Sheet overlay is the dark scrim token (wide: %s)", (wide) => {
    stubViewport(wide);
    render(<Sheet open onOpenChange={() => {}} title="Filtros" closeLabel="Fechar">corpo</Sheet>);
    expect(scrim()!.className).toContain("bg-scrim");
    expect(scrim()!.className).not.toContain("bg-text/");
  });

  it("the Dialog overlay is the dark scrim token", () => {
    render(<Dialog open onOpenChange={() => {}} title="Excluir?" description="d" cancelLabel="n" confirmLabel="s" onConfirm={() => {}} />);
    expect(scrim()!.className).toContain("bg-scrim");
    expect(scrim()!.className).not.toContain("bg-text/");
  });
});
