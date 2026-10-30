import type { ReactNode } from "react";
import type { StatusState } from "./thresholds";

/** The design token each state's text and border use (checked for contrast in StatusBadge.test.tsx). */
export const STATUS_TOKEN: Record<StatusState, string> = {
  ok: "accent",
  warn: "warning",
  bad: "danger",
  neutral: "muted",
};

// Literal class names, so Tailwind can see them.
const CLASSES: Record<StatusState, string> = {
  ok: "border-accent text-accent",
  warn: "border-warning text-warning",
  bad: "border-danger text-danger",
  neutral: "border-muted text-muted",
};

// Each state has its own shape, so the badge reads without colour: check, triangle, octagon-cross, dash.
const ICONS: Record<StatusState, ReactNode> = {
  ok: <path d="M3 8.5l3.5 3.5L13 4.5" />,
  warn: <path d="M8 2L14.5 13.5H1.5Z M8 6.5v3 M8 11.5v.5" />,
  bad: <path d="M5.2 1.5h5.6l3.7 3.7v5.6l-3.7 3.7H5.2L1.5 10.8V5.2Z M5.8 5.8l4.4 4.4 M10.2 5.8l-4.4 4.4" />,
  neutral: <path d="M3.5 8h9" />,
};

/** A status pill: always a text label and an icon as well as colour, with a border for forced-colours mode. */
export function StatusBadge({ state, label }: { state: StatusState; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-control border bg-surface-raised px-2 py-0.5 text-xs font-semibold ${CLASSES[state]}`}>
      <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        {ICONS[state]}
      </svg>
      {label}
    </span>
  );
}
