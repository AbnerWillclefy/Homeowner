import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { DescriptionList } from "../components/description-list";
import { Amount } from "./amount";

afterEach(cleanup);

// Lives in finance/ because Core files, tests included, may not import Finance (layers.test.ts).
it("masks an Amount placed in a value when hide values is on", () => {
  render(<DescriptionList items={[{ label: "Renda", value: <Amount cents={123456} size="sm" hidden hiddenLabel="Valor oculto" /> }]} />);
  expect(screen.getByText("Valor oculto")).toBeTruthy();
  expect(screen.queryByText(/1\.234,56/)).toBeNull();
});

it("shows the figure when values are not hidden", () => {
  render(<DescriptionList items={[{ label: "Renda", value: <Amount cents={123456} size="sm" /> }]} />);
  expect(screen.getByText(/1\.234,56/)).toBeTruthy();
});
