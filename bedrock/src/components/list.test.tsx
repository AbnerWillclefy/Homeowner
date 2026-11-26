import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { List, Row } from "./list";

const longTitle = "Transferência recebida de Maria Aparecida dos Santos Oliveira";
const longCaption = "Itaú · 23/11 · conta corrente compartilhada com a família";

it("keeps a long title and caption on one line", () => {
  render(
    <List>
      <Row title={longTitle} caption={longCaption} />
    </List>,
  );
  for (const text of [longTitle, longCaption]) {
    const el = screen.getByText(text);
    expect(el.className).toContain("truncate");
    expect(el.className).not.toMatch(/whitespace-normal|overflow-wrap/);
  }
});

it("is 64px tall with a leading element and 56px tall without, on the 8px grid", () => {
  render(
    <List>
      <Row leading={<span>L</span>} title="With" />
      <Row title="Plain" />
    </List>,
  );
  const [withLead, plain] = screen.getAllByRole("listitem");
  const classes = (el: Element) => el.className.split(" ");
  expect(classes(withLead)).toEqual(expect.arrayContaining(["min-h-16", "py-2", "px-4"]));
  expect(classes(withLead)).not.toContain("min-h-14");
  expect(classes(plain)).toEqual(expect.arrayContaining(["min-h-14", "py-2", "px-4"]));
  expect(classes(plain)).not.toContain("min-h-16");
});

it.each([
  ["button", <button key="b" type="button" />],
  ["link", <a key="a" href="#x" />],
] as const)("asChild makes the %s the row, with no wrapper", (role, child) => {
  render(
    <List>
      <Row asChild title="Title" caption="Caption" leading={<span>L</span>}>
        {child}
      </Row>
    </List>,
  );
  const el = screen.getByRole(role, { name: /Title/ });
  expect(screen.getAllByRole(role)).toHaveLength(1);
  expect(el.parentElement).toBe(screen.getByRole("listitem"));
  expect(el.className).toContain("grid-cols-");
  expect(el.className).toContain("min-h-16");
});
