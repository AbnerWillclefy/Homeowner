import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it } from "vitest";
import { SearchField } from "./search-field";

function Harness({ initial = "" }: { initial?: string }) {
  const [v, setV] = useState(initial);
  return <SearchField label="Search" clearLabel="Clear search" value={v} onValueChange={setV} />;
}

it("has a programmatic label", () => {
  render(<Harness />);
  expect(screen.getByRole("searchbox", { name: "Search" })).toBeTruthy();
});

it("shows the clear button only with text", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  await user.type(screen.getByRole("searchbox"), "rent");
  expect(screen.getByRole("button", { name: "Clear search" })).toBeTruthy();
});

it("clearing empties the field and returns focus to it", async () => {
  const user = userEvent.setup();
  render(<Harness initial="rent" />);
  await user.click(screen.getByRole("button", { name: "Clear search" }));
  const field = screen.getByRole("searchbox") as HTMLInputElement;
  expect(field.value).toBe("");
  expect(document.activeElement).toBe(field);
});

it("Escape clears the text", async () => {
  const user = userEvent.setup();
  render(<Harness initial="rent" />);
  await user.click(screen.getByRole("searchbox"));
  await user.keyboard("{Escape}");
  expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
});
