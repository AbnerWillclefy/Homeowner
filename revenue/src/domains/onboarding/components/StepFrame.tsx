import type { ReactNode } from "react";

/** The step's `<h1>` and the reason it is asked. The page moves focus here when the step changes. */
export function StepHeading({ title, why }: { title: string; why: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 data-step-heading tabIndex={-1} className="page-title outline-none">{title}</h1>
      <p className="body text-text-muted">{why}</p>
    </div>
  );
}

/** Back on the left, Skip and the main action on the right; they wrap on a narrow screen or large text. */
export function StepActions({ back, children }: { back?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>{back}</div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
