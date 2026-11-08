import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useI18n } from "../../../shared/i18n";
import { nextTab } from "../logic/nextTab";

const VIEWS = ["spending", "bills", "settings"] as const;
export type FinanceView = (typeof VIEWS)[number];

/**
 * The Finances views as an ARIA tablist (arrow keys, Home, End). Every panel stays mounted and only hidden, so a
 * picked month or a half-typed income survives a switch, as a collapsed card's body does.
 */
export function FinanceTabs({ panels }: { panels: Record<FinanceView, ReactNode> }) {
  const { t } = useI18n();
  const id = useId();
  const [view, setView] = useState<FinanceView>("spending");
  const tabs = useRef<Partial<Record<FinanceView, HTMLButtonElement | null>>>({});

  function onKeyDown(event: KeyboardEvent) {
    const to = nextTab(VIEWS, view, event.key);
    if (!to) return;
    event.preventDefault();
    setView(to);
    tabs.current[to]?.focus();
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label={t("finances.title")}
        onKeyDown={onKeyDown}
        // Whole tabs wrap to a second row at the largest text; a label never breaks inside a word.
        className="flex flex-wrap gap-1 rounded-card border border-border bg-surface-raised p-1"
      >
        {VIEWS.map((v) => (
          <button
            key={v}
            ref={(el) => {
              tabs.current[v] = el;
            }}
            type="button"
            role="tab"
            id={`${id}-${v}-tab`}
            aria-selected={view === v}
            aria-controls={`${id}-${v}`}
            tabIndex={view === v ? 0 : -1}
            onClick={() => setView(v)}
            className={`min-h-11 grow basis-auto rounded-pill border-0 px-3 py-1 font-[inherit] font-semibold motion-safe:transition-colors motion-safe:duration-150 ${
              view === v ? "bg-accent text-accent-contrast" : "bg-transparent text-muted"
            }`}
          >
            {t(`finances.view.${v}`)}
          </button>
        ))}
      </div>
      {VIEWS.map((v) => (
        <div
          key={v}
          role="tabpanel"
          id={`${id}-${v}`}
          aria-labelledby={`${id}-${v}-tab`}
          hidden={view !== v}
          className="flex flex-col gap-8 *:mt-0"
        >
          {panels[v]}
        </div>
      ))}
    </div>
  );
}
