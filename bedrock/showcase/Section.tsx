import { useId, type ReactNode } from "react";

/** The frame every sections/<Component>.tsx renders inside. */
export function Section({ name, children }: { name: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="section-title">
        {name}
      </h2>
      {children}
    </section>
  );
}
