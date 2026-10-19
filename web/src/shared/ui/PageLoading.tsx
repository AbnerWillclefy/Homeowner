import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { withReport } from "./loadingReports";
import { useDelayedFlag } from "./useDelayedFlag";

interface PageLoadingValue {
  report(id: string, loading: boolean): void;
  /** Some section has been loading for over 300ms: skeletons may show, and the status has its text. */
  show: boolean;
}

const PageLoadingContext = createContext<PageLoadingValue | null>(null);

/**
 * One polite status for a whole page. It renders a single always-mounted, visually hidden `role="status"` region
 * whose text is `message` while any section that reports to it has been loading for over 300ms, and empty
 * otherwise. The region never unmounts, so a page whose sections load one after the other (Today: Home, then
 * Check-in, Day Plan and Streak) is announced once, and the skeletons it shows are `aria-hidden`.
 */
export function PageLoading({ message, children }: { message: string; children: ReactNode }) {
  const [loading, setLoading] = useState<ReadonlySet<string>>(new Set());
  const show = useDelayedFlag(loading.size > 0);
  const report = useCallback((id: string, isLoading: boolean) => setLoading((current) => withReport(current, id, isLoading)), []);
  const value = useMemo(() => ({ report, show }), [report, show]);

  return (
    <PageLoadingContext value={value}>
      {children}
      <div role="status" className="sr-only">
        {show ? message : ""}
      </div>
    </PageLoadingContext>
  );
}

/**
 * A section calls this with whether its first data is still loading, and shows its skeleton when the result is
 * true. Reports only the first load: pass false once content is on screen, so a reload after an action keeps
 * showing the content. Without a `PageLoading` around it, the section times its own skeleton.
 */
export function useReportFirstLoad(loading: boolean): boolean {
  const page = useContext(PageLoadingContext);
  const own = useDelayedFlag(loading);
  const id = useId();
  const report = page?.report;

  useEffect(() => {
    report?.(id, loading);
  }, [report, id, loading]);
  useEffect(() => () => report?.(id, false), [report, id]);

  return page ? page.show && loading : own;
}
