import type { ReactNode } from "react";
import { OverviewPage } from "../domains/overview/OverviewPage";
import { AiPage } from "../domains/ai/AiPage";
import { FlowPage } from "../domains/flow/FlowPage";

export interface Page {
  /** Empty for the index page. */
  path: string;
  label: string;
  /** The inside of a 24px stroked icon, decorative. */
  icon: ReactNode;
  element: ReactNode;
}

// The one table of pages: the nav and the routes both read it.
export const PAGES: Page[] = [
  {
    path: "",
    label: "Overview",
    icon: <path d="M4 4h6v8H4zM14 4h6v4h-6zM14 12h6v8h-6zM4 16h6v4H4z" />,
    element: <OverviewPage />,
  },
  {
    path: "ai",
    label: "AI usage",
    icon: <path d="M6 6h12v12H6zM10 10h4v4h-4zM9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />,
    element: <AiPage />,
  },
  { path: "flow", label: "Flow", icon: <path d="M3 4h18l-7 8v6l-4 2v-8z" />, element: <FlowPage /> },
];
