import { useId, useState, type ReactNode } from "react";

/**
 * A heading-less disclosure: a native button toggling a region. The region stays mounted (with `hidden`) so its text
 * is still in the document, and Enter and Space come from the button.
 */
export function Collapsible({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 items-center gap-2 rounded-control border border-border bg-surface-raised px-3 font-semibold text-text"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" className={open ? "rotate-90" : ""}>
          <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {title}
      </button>
      <div id={id} data-collapsible-region hidden={!open}>
        {children}
      </div>
    </div>
  );
}
