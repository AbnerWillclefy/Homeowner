import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useMonthParam } from "./useMonthParam";

function Probe() {
  const { setMonth } = useMonthParam();
  return (
    <>
      <button onClick={() => setMonth("2029-11")}>past</button>
      <button onClick={() => setMonth("2030-01")}>now</button>
      <output>{useLocation().search}</output>
    </>
  );
}

beforeEach(() => vi.useFakeTimers({ toFake: ["Date"], now: new Date("2030-01-10T15:00:00Z") }));
afterEach(() => vi.useRealTimers());

it("keeps the other params when the month changes, and drops only ?month for this month", async () => {
  render(<MemoryRouter initialEntries={["/?card=s2"]}><Probe /></MemoryRouter>);
  await userEvent.click(screen.getByText("past"));
  expect(screen.getByRole("status").textContent).toBe("?card=s2&month=2029-11");
  await userEvent.click(screen.getByText("now"));
  expect(screen.getByRole("status").textContent).toBe("?card=s2");
});
