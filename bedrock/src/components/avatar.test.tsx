import { fireEvent, render } from "@testing-library/react";
import { expect, it } from "vitest";
import { Avatar } from "./avatar";

const root = (c: HTMLElement) => c.firstElementChild as HTMLElement;

it("is decorative: aria-hidden and an empty alt", () => {
  const { container } = render(<Avatar src="/a.png" />);
  expect(root(container).getAttribute("aria-hidden")).toBe("true");
  expect(container.querySelector("img")!.getAttribute("alt")).toBe("");
});

it("falls back to the initials, in the given fill and ink, when the photo fails", () => {
  const { container } = render(<Avatar src="/a.png" initials="AB" fillClass="bg-x" inkClass="text-y" />);
  fireEvent.error(container.querySelector("img")!);
  expect(container.querySelector("img")).toBeNull();
  expect(root(container).textContent).toBe("AB");
  expect(root(container).className).toContain("bg-x");
  expect(root(container).className).toContain("text-y");
});

it("tries a new photo url after the previous one failed", () => {
  const { container, rerender } = render(<Avatar src="/a.png" initials="AB" />);
  fireEvent.error(container.querySelector("img")!);
  rerender(<Avatar src="/b.png" initials="AB" />);
  expect(container.querySelector("img")!.getAttribute("src")).toBe("/b.png");
});

it("shows the person icon with neither photo nor initials", () => {
  const { container } = render(<Avatar />);
  expect(container.querySelector("svg")).not.toBeNull();
  expect(root(container).textContent).toBe("");
});
