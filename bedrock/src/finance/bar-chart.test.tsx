import { render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { BarChart } from "./bar-chart";

vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));

it("draws the limit line even when every bar is under it", () => {
  const { container } = render(
    <BarChart
      data={[
        { label: "1", cents: 8000 },
        { label: "2", cents: 12000 },
      ]}
      targetCents={15000}
      label="Dentro do limite"
      legend={{ daily: "Dia", average: "Média", target: "Limite" }}
      alternative={<table />}
    />,
  );
  expect(container.querySelector(".recharts-reference-line")).toBeTruthy();
});
