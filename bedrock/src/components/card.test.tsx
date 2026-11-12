import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Card, CardLabel } from "./card";

afterEach(cleanup);

it("puts the arrow cue and the content inside the consumer's link", () => {
  render(
    <Card asChild>
      <a href="#x">
        <CardLabel>Gastos</CardLabel>
      </a>
    </Card>,
  );
  const link = screen.getByRole("link", { name: "Gastos" });
  expect(link.querySelector("svg[aria-hidden]")).not.toBeNull();
});
