import type { ReactNode } from "react";

/** A tab's scroll area (the design's `hm-scroll`): 8px above, 24px below, its blocks 16px apart. Tabs put their top-level blocks directly inside it. */
export function TabBody({ children }: { children: ReactNode }) {
  return <div data-slot="tab-body" className="flex flex-col gap-4 pt-2 pb-6">{children}</div>;
}
