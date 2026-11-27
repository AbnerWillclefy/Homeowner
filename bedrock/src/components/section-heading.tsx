import type { ReactNode } from "react";

type SectionHeadingProps = {
  title: string;
  /** `title` is the 18px group heading (Today's "Suas tarefas"); `label` the 12px muted caption ("Concluídas hoje"). Every call site chooses. */
  variant: "title" | "label";
  /** Trailing action or caption in the heading's row, such as "Aceitar todas". */
  end?: ReactNode;
  /** Still a real heading, so screen-reader heading navigation works. */
  as?: "h2" | "h3";
  /** Goes on the heading, so a `<section aria-labelledby>` can name itself by it. */
  id?: string;
};

/** The name of a group of rows on a screen: a heading, with an optional item at the end of its row. */
export function SectionHeading({ title, variant, end, as: Tag = "h2", id }: SectionHeadingProps) {
  const style = variant === "title" ? "section-title font-semibold text-text" : "label text-text-muted";
  // The artboard's `hm-sechead` has 8px above it; a bare `hm-label` has none.
  return (
    <div data-slot="section-heading" className={`flex flex-wrap items-center justify-between gap-x-2 ${variant === "title" ? "pt-2" : ""}`}>
      <Tag id={id} className={`${style} my-0 min-w-0 [overflow-wrap:anywhere]`}>
        {title}
      </Tag>
      {end && <div className="max-w-full">{end}</div>}
    </div>
  );
}

export type { SectionHeadingProps };
