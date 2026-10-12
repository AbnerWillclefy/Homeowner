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

  it("appends the caller's classes", () => {
    expect(classesOf(render({ className: "mt-4 w-full" }))).toEqual(expect.arrayContaining(["mt-4", "w-full"]));
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
