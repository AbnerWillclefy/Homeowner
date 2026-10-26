import { act } from "react";
import { describe, expect, it } from "vitest";
import { mount } from "../testing";
import { Collapsible } from "./Collapsible";

const { render, container } = mount();

const button = () => container().querySelector("button")!;
const region = () => container().querySelector<HTMLElement>("[data-collapsible-region]")!;

describe("Collapsible", () => {
  it("is collapsed by default: aria-expanded false, region hidden but still mounted", async () => {
    await render(
      <Collapsible title="Per day">
        <p>Inside</p>
      </Collapsible>,
    );
    expect(button().textContent).toContain("Per day");
    expect(button().getAttribute("aria-expanded")).toBe("false");
    expect(region().hidden).toBe(true);
    expect(container().textContent).toContain("Inside");
  });

  it("points aria-controls at the region", async () => {
    await render(<Collapsible title="Per day">x</Collapsible>);
    expect(region().id).not.toBe("");
    expect(button().getAttribute("aria-controls")).toBe(region().id);
  });

  it("toggles on a click", async () => {
    await render(<Collapsible title="Per day">x</Collapsible>);
    await act(async () => button().click());
    expect(button().getAttribute("aria-expanded")).toBe("true");
    expect(region().hidden).toBe(false);
    await act(async () => button().click());
    expect(region().hidden).toBe(true);
  });

  it("is a native button, so Enter and Space activate it", async () => {
    await render(<Collapsible title="Per day">x</Collapsible>);
    expect(button().tagName).toBe("BUTTON");
    expect(button().getAttribute("type")).toBe("button");
  });

  it("can start open", async () => {
    await render(
      <Collapsible title="Per day" defaultOpen>
        x
      </Collapsible>,
    );
    expect(button().getAttribute("aria-expanded")).toBe("true");
    expect(region().hidden).toBe(false);
  });
});
