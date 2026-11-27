import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { SectionHeading } from "./section-heading";

it("draws the title variant as the 18px section title and the label variant as the muted caption", () => {
  render(
    <>
      <SectionHeading title="Suas tarefas" variant="title" />
      <SectionHeading title="Concluídas hoje" variant="label" />
    </>,
  );
  const title = screen.getByRole("heading", { name: "Suas tarefas" });
  const label = screen.getByRole("heading", { name: "Concluídas hoje" });
  expect(title.className).toContain("section-title");
  expect(title.className).not.toContain("label");
  expect(label.className).toMatch(/(^| )label( |$)/);
  expect(label.className).toContain("text-text-muted");
  expect(label.className).not.toContain("section-title");
});

it("puts the end item in the same row as the heading", () => {
  render(<SectionHeading title="Suas tarefas" variant="title" end={<button>Aceitar todas</button>} />);
  const row = document.querySelector('[data-slot="section-heading"]')!;
  expect(row.contains(screen.getByRole("button", { name: "Aceitar todas" }))).toBe(true);
  expect(row.contains(screen.getByRole("heading"))).toBe(true);
});

it("renders an h2 by default, the asked tag with as, and the id on the heading", () => {
  render(
    <>
      <SectionHeading title="A" variant="label" id="a" />
      <SectionHeading title="B" variant="label" as="h3" />
    </>,
  );
  expect(screen.getByRole("heading", { name: "A", level: 2 }).id).toBe("a");
  expect(screen.getByRole("heading", { name: "B", level: 3 })).toBeTruthy();
});

it("only the title variant has the 8px above it that the artboard's sechead row has", () => {
  render(
    <>
      <SectionHeading title="A" variant="title" />
      <SectionHeading title="B" variant="label" />
    </>,
  );
  const [title, label] = [...document.querySelectorAll('[data-slot="section-heading"]')];
  expect(title.className).toContain("pt-2");
  expect(label.className).not.toContain("pt-2");
});
