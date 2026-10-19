import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, type ButtonVariant } from "./Button";

type Props = Parameters<typeof Button>[0];

function render(props: Props = {}, child: ReactNode = "Save"): string {
  return renderToStaticMarkup(createElement(Button, props, child));
}

function classesOf(markup: string): string[] {
  return /class="([^"]*)"/.exec(markup)?.[1].split(/\s+/) ?? [];
}

describe("Button", () => {
  it("renders a button that does not submit forms by default", () => {
    expect(render()).toMatch(/^<button type="button"/);
  });

  it("keeps an explicit type", () => {
    expect(render({ type: "submit" })).toMatch(/^<button type="submit"/);
  });

  it("renders its children", () => {
    expect(render({}, "Sign out")).toContain(">Sign out</button>");
  });

  it("is primary unless told otherwise", () => {
    expect(classesOf(render())).toContain("bg-accent");
  });

  const pills: [ButtonVariant, string][] = [
    ["primary", "bg-accent"],
    ["secondary", "bg-surface-raised"],
    ["danger", "border-danger"],
  ];
  it.each(pills)("draws the %s variant as a bordered pill", (variant, marker) => {
    const classes = classesOf(render({ variant }));
    expect(classes).toEqual(expect.arrayContaining(["rounded-pill", "border", "disabled:border-dashed", marker]));
  });

  it("gives danger a thick edge so it is not told apart by colour alone", () => {
    expect(classesOf(render({ variant: "danger" }))).toContain("border-2");
  });

  it("draws the link variant as underlined text without a border", () => {
    const classes = classesOf(render({ variant: "link" }));
    expect(classes).toEqual(expect.arrayContaining(["underline", "text-accent"]));
    expect(classes).not.toContain("border");
  });

  it("draws the ghost variant with a transparent border", () => {
    expect(classesOf(render({ variant: "ghost" }))).toContain("border-transparent");
  });

  it.each<ButtonVariant>(["primary", "secondary", "danger", "link", "ghost"])(
    "keeps the 44px touch target on %s",
    (variant) => {
      expect(classesOf(render({ variant }))).toEqual(expect.arrayContaining(["min-h-11", "min-w-11"]));
    },
  );

  it("makes an icon button square", () => {
    expect(classesOf(render({ icon: true }))).toEqual(expect.arrayContaining(["size-11", "px-0"]));
  });

  it("spans its container with fullWidth", () => {
    expect(classesOf(render({ fullWidth: true }))).toContain("w-full");
  });

  it("keeps its natural width by default", () => {
    expect(classesOf(render())).not.toContain("w-full");
  });

  it("appends the caller's classes", () => {
    expect(classesOf(render({ className: "mt-4" }))).toContain("mt-4");
  });

  it("forwards native attributes", () => {
    const markup = render({ disabled: true, "aria-busy": true });
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('aria-busy="true"');
  });

  it("lends its look to the child with asChild, without a button type", () => {
    const markup = render({ asChild: true, variant: "secondary" }, createElement("a", { href: "/home" }, "Home"));
    expect(markup).toMatch(/^<a /);
    expect(markup).not.toContain("type=");
    expect(classesOf(markup)).toContain("bg-surface-raised");
  });
});

describe("Button pending", () => {
  const slotOf = (markup: string) => /<span[^>]*data-slot="leading"[^>]*>/.exec(markup)?.[0];
  const icon = createElement("svg", { "data-testid": "icon" });

  it("disables the button and marks it busy", () => {
    const markup = render({ pending: true });
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('aria-busy="true"');
  });

  it("keeps the label in place, hidden under the spinner, so the width does not change", () => {
    expect(render({ pending: true }, "Salvar")).toContain('<span class="opacity-0">Salvar</span>');
  });

  it("centres the spinner over a button without a leading icon", () => {
    const markup = render({ pending: true });
    expect(classesOf(markup)).toContain("relative");
    expect(markup).toMatch(/<span[^>]*class="absolute inset-0[^"]*"><svg/);
  });

  it("shows a decorative spinner that turns only when motion is allowed", () => {
    const svg = /<svg[^>]*>/.exec(render({ pending: true }))?.[0] ?? "";
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain("motion-safe:animate-spin");
    expect(svg.replace("motion-safe:animate-spin", "")).not.toContain("animate-spin");
  });

  it("is neither disabled nor busy while idle", () => {
    const markup = render({ pending: false });
    expect(markup).not.toContain('disabled=""');
    expect(markup).not.toContain("aria-busy");
    expect(markup).not.toContain("<svg");
  });

  it("leaves no empty space before the label while idle", () => {
    expect(render({ pending: false })).not.toContain("<span");
  });

  it("swaps the leading icon for the spinner in the same slot", () => {
    const idle = render({ pending: false, leadingIcon: icon });
    const busy = render({ pending: true, leadingIcon: icon });
    expect(idle).toContain("data-testid");
    expect(busy).not.toContain("data-testid");
    expect(slotOf(idle)).toBe(slotOf(busy));
  });

  it("renders a button that never passes pending exactly as before", () => {
    const markup = render();
    expect(markup).not.toContain("data-slot");
    expect(markup).not.toContain("<span");
    expect(markup).not.toContain("aria-busy");
  });

  it("shows a leading icon without pending", () => {
    expect(render({ leadingIcon: icon })).toContain("data-testid");
  });

  it("ignores pending with asChild, since a link cannot be busy", () => {
    const markup = render({ asChild: true, pending: true }, createElement("a", { href: "/home" }, "Home"));
    expect(markup).not.toContain("aria-busy");
    expect(markup).not.toContain('disabled=""');
    expect(markup).not.toContain("<svg");
  });
});
