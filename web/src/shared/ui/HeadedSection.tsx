import { useId, type ReactNode } from "react";

/** A group on a tab: an h3 naming a section. The heading id comes from `useId`, so two groups never share one. */
export function HeadedSection({ title, children }: { title: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h3 id={id} className="my-0 text-xl leading-snug font-bold [overflow-wrap:anywhere]">
        {title}
      </h3>
      {children}
    </section>
  );
}
