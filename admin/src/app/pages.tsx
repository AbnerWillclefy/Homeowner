import type { ReactNode } from "react";
import { OverviewPage } from "../domains/overview/OverviewPage";
import { AiPage } from "../domains/ai/AiPage";
import { FlowPage } from "../domains/flow/FlowPage";

export interface Page {
  /** Empty for the index page. */
  path: string;
  label: string;
  element: ReactNode;
}

// The one table of pages: the nav and the routes both read it.
export const PAGES: Page[] = [
  { path: "", label: "Overview", element: <OverviewPage /> },
  { path: "ai", label: "AI usage", element: <AiPage /> },
  { path: "flow", label: "Flow", element: <FlowPage /> },
];
