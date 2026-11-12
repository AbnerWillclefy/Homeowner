import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ChartTooltipContent } from "../components/chart";
import { isOverPace, PaceChart } from "./pace-chart";

it("is over pace only strictly above the line", () => {
  // Day 10 of 30 with a 30000 limit: the line, drawn from day 1, is at 9310.34.
  expect(isOverPace({ day: 10, cents: 9310 }, 30000, 30)).toBe(false);
  expect(isOverPace({ day: 10, cents: 9311 }, 30000, 30)).toBe(true);
  expect(isOverPace({ day: 10, cents: 9000 }, 30000, 30)).toBe(false);
});

const chart = (axes = false) => (
  <PaceChart
    days={30}
    limitCents={30000}
    spent={[
      { day: 1, cents: 1000 },
      { day: 10, cents: 8000 },
    ]}
    label="R$ 20 abaixo do ritmo"
    markerLabel="R$ 20 abaixo"
    axes={axes}
    alternative={
      <table>
        <caption>Gasto</caption>
        <thead>
          <tr>
            <th>Dia</th>
            <th>Gasto</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>10</td>
            <td>R$ 80,00</td>
          </tr>
        </tbody>
      </table>
    }
  />
);

it("labels the chart with the conclusion and keeps the table outside the image", () => {
  render(chart());
  const img = screen.getByRole("img", { name: "R$ 20 abaixo do ritmo" });
  const table = screen.getByRole("table", { hidden: true });
  expect(img.contains(table)).toBe(false);
  expect(img.querySelector("svg")).toBeTruthy();
  // No accessibility layer (role="application", tab-reachable) inside role="img"; the tooltip's tabindex="-1" is not tab-reachable.
  expect(img.querySelector("[role=application], [tabindex='0']")).toBeNull();
});

it("draws the marker text and the axes only when asked", () => {
  const { container, rerender } = render(chart());
  expect(container.textContent).toContain("R$ 20 abaixo");
  expect(container.querySelector(".recharts-yAxis")).toBeNull();
  rerender(chart(true));
  expect(container.querySelector(".recharts-yAxis")).toBeTruthy();
});

it("formats the tooltip value through the prop", () => {
  render(<ChartTooltipContent active label="10" payload={[{ value: 8000 }]} formatValue={(v) => `<${v}>`} />);
  expect(screen.getByText("<8000>")).toBeTruthy();
});
