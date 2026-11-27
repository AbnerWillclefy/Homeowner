// @vitest-environment jsdom
import { createElement } from "react";
import { expect, it } from "vitest";
import { AppDialog } from "./AppDialog";
import { mountWithI18n } from "./testing";

const { render } = mountWithI18n();

it("draws the artboards' dark scrim behind the dialog, not a wash of the text colour", () => {
  render(createElement(AppDialog, { onDismiss: () => {}, title: "Title", description: undefined, children: "body" }));
  const scrim = document.querySelector('[data-slot="scrim"]');
  expect(scrim).not.toBeNull();
  expect(scrim!.className).toContain("bg-scrim");
  expect(scrim!.className).not.toContain("bg-text");
});
