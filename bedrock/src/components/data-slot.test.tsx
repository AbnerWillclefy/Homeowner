import { render } from "@testing-library/react";
import { Check } from "lucide-react";
import type { ReactElement } from "react";
import { expect, it } from "vitest";
import { BottomBar } from "./bottom-bar";
import { Card } from "./card";
import { Choice, ChoiceGroup } from "./choice-group";
import { Dialog } from "./dialog";
import { Input } from "./input";
import { List, Row } from "./list";
import { PageHeader } from "./page-header";
import { SearchField } from "./search-field";
import { SegmentedControl } from "./segmented-control";
import { Sheet } from "./sheet";
import { StepIndicator } from "./step-indicator";
import { Toast, ToastProvider } from "./toast";

// Radix Toast reads pointer capture, which jsdom lacks.
Element.prototype.hasPointerCapture ??= () => false;

const noop = () => {};
const cases: [string, ReactElement][] = [
  ["list", <List key="x"><Row title="t" /></List>],
  ["row", <List key="x"><Row title="t" /></List>],
  ["page-header", <PageHeader key="x" title="t" action={{ label: "a", icon: Check, onClick: noop }} />],
  ["sheet", <Sheet key="x" open onOpenChange={noop} title="t" closeLabel="c">x</Sheet>],
  ["dialog", <Dialog key="x" open onOpenChange={noop} title="t" description="d" cancelLabel="n" confirmLabel="y" onConfirm={noop} />],
  ["search-field", <SearchField key="x" label="l" clearLabel="c" value="" onValueChange={noop} />],
  ["field", <Input key="x" label="l" />],
  ["segmented-control", <SegmentedControl key="x" label="l" options={[{ value: "a", label: "A" }, { value: "b", label: "B" }]} value="a" onValueChange={noop} />],
  ["toast", <ToastProvider key="x" label="n"><Toast open onOpenChange={noop} tone="neutral" title="t" closeLabel="c" /></ToastProvider>],
  ["choice-group", <ChoiceGroup key="x" label="l" value="a" onValueChange={noop}><Choice value="a" label="A" /></ChoiceGroup>],
  ["step-indicator", <StepIndicator key="x" label="Passo 1 de 5" current={1} total={5} />],
  ["card", <Card key="x">x</Card>],
  ["bottom-bar", <BottomBar key="x" label="n" items={[{ href: "/", label: "Home", icon: Check }]} />],
];

it.each(cases)("renders data-slot=%s on its root", (slot, ui) => {
  render(ui);
  expect(document.querySelector(`[data-slot="${slot}"]`)).not.toBeNull();
});
