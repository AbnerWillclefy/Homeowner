import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ButtonRow } from "./ButtonRow";

type Props = Parameters<typeof ButtonRow>[0];

const cancel = createElement("button", null, "Cancelar");
const save = createElement("button", null, "Salvar");

function render(props: Props): string {
  return renderToStaticMarkup(createElement(ButtonRow, props));
}

/** The classes of the innermost div that wraps the given label. */
function groupClasses(markup: string, label: string): string[] {
  const matches = [...markup.matchAll(/<div class="([^"]*)">((?:(?!<div).)*)<\/div>/g)];
  const group = matches.find((m) => m[2].includes(`>${label}<`));
  return group?.[1].split(/\s+/) ?? [];
}

describe("ButtonRow start and end", () => {
  it("renders the start group before the end group, so the primary is last", () => {
    const markup = render({ start: cancel, end: save });
    expect(markup.indexOf("Cancelar")).toBeGreaterThan(-1);
    expect(markup.indexOf("Cancelar")).toBeLessThan(markup.indexOf("Salvar"));
    expect(markup.lastIndexOf("<button")).toBeGreaterThan(markup.indexOf("Cancelar"));
  });

  it("pushes the end group to the right and keeps it right-aligned when it wraps", () => {
    expect(groupClasses(render({ start: cancel, end: save }), "Salvar")).toEqual(
      expect.arrayContaining(["ms-auto", "justify-end"]),
    );
  });

  it("puts a lone end button at the right", () => {
    const markup = render({ end: save });
    expect(markup).not.toContain("Cancelar");
    expect(groupClasses(markup, "Salvar")).toContain("ms-auto");
  });

  it("lets a lone start button sit on the left", () => {
    expect(groupClasses(render({ start: cancel }), "Cancelar")).not.toContain("ms-auto");
  });

  it("stacks both groups, each button full width, when even the end group does not fit", () => {
    const markup = render({ start: cancel, end: save });
    for (const label of ["Cancelar", "Salvar"]) {
      const classes = groupClasses(markup, label);
      expect(classes).toContain("@max-[14rem]:flex-col");
      expect(classes).toContain("@max-[14rem]:w-full");
      expect(classes).toContain("@max-[14rem]:*:w-full");
    }
  });

  it("fills its container and measures it for the container query", () => {
    const row = /^<div class="([^"]*)"/.exec(render({ start: cancel, end: save }))?.[1].split(/\s+/);
    expect(row).toEqual(expect.arrayContaining(["w-full", "@container", "flex-wrap"]));
  });
});

describe("ButtonRow children", () => {
  it("still renders children as a wrapping row", () => {
    const markup = render({ children: save, className: "mt-4" });
    expect(markup).toContain("flex-wrap");
    expect(markup).toContain("mt-4");
    expect(markup).toContain("Salvar");
  });

  it("leaves a children-only row without the container, so existing callers lay out as before", () => {
    const markup = render({ children: save });
    expect(markup).not.toContain("@container");
    expect(markup).not.toContain("w-full");
  });

  it("still stacks children with stretch", () => {
    expect(render({ stretch: true, children: save })).toContain("flex-col");
  });
});
