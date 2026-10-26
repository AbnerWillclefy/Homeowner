import type { ReactNode } from "react";
import { Placeholder } from "./Placeholder";

export interface Page {
  /** Empty for the index page. */
  path: string;
  label: string;
  element: ReactNode;
}

// The one table of pages: the nav and the routes both read it. Placeholders until #326 (AI usage), #330 and #331 (Flow).
export const PAGES: Page[] = [
  { path: "", label: "Overview", element: <Placeholder title="Overview" note="The overview arrives with the usage pages." /> },
  { path: "ai", label: "AI usage", element: <Placeholder title="AI usage" note="Coming soon." /> },
  { path: "flow", label: "Flow", element: <Placeholder title="Flow" note="Coming soon." /> },
];
