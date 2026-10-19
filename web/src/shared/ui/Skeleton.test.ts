import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SkeletonBar, SkeletonCard, SkeletonPill, SkeletonTile } from "./Skeleton";

const render = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);
const classesOf = (markup: string) => /class="([^"]*)"/.exec(markup)?.[1].split(/\s+/) ?? [];

describe("Skeleton", () => {
  it("hides a card, and so everything in it, from screen readers", () => {
    expect(render(createElement(SkeletonCard, null, createElement(SkeletonBar)))).toMatch(/^<div[^>]*aria-hidden="true"/);
  });

  it("fills every part with the muted token at low opacity, not a palette colour", () => {
    for (const part of [SkeletonBar, SkeletonPill, SkeletonTile]) {
      expect(classesOf(render(createElement(part)))).toContain("bg-muted/20");
    }
  });

  it("shapes bars and pills as pills and tiles as rounded squares", () => {
    expect(classesOf(render(createElement(SkeletonBar)))).toContain("rounded-pill");
    expect(classesOf(render(createElement(SkeletonPill)))).toContain("rounded-pill");
    expect(classesOf(render(createElement(SkeletonTile)))).toContain("rounded-control");
  });

  it("pulses only when motion is allowed", () => {
    const classes = [SkeletonBar, SkeletonPill, SkeletonTile].flatMap((part) => classesOf(render(createElement(part))));
    expect(classes).toContain("motion-safe:animate-pulse");
    expect(classes).not.toContain("animate-pulse");
  });

  it("takes the size from the class it is given", () => {
    expect(classesOf(render(createElement(SkeletonBar, { className: "h-4 w-1/2" })))).toEqual(
      expect.arrayContaining(["h-4", "w-1/2"]),
    );
  });
});
