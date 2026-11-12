import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SegmentedControl } from "./segmented-control";

// Vitest globals are off, so testing-library does not clean up on its own.
afterEach(cleanup);

function setup() {
  const onValueChange = vi.fn();
  render(
    <SegmentedControl
      label="L"
      value="a"
      onValueChange={onValueChange}
      options={[
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ]}
    />,
  );
  return onValueChange;
}

it("ignores a press on the active option so one stays selected", () => {
  const onValueChange = setup();
  fireEvent.click(screen.getByRole("radio", { name: "A" }));
  expect(onValueChange).not.toHaveBeenCalled();
});

it("reports another option's value", () => {
  const onValueChange = setup();
  fireEvent.click(screen.getByRole("radio", { name: "B" }));
  expect(onValueChange).toHaveBeenCalledWith("b");
});
