import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { withReport } from "./loadingReports";
import { useDelayedFlag } from "./useDelayedFlag";

interface PageLoadingValue {
  report(id: string, loading: boolean): void;
  /** Some section has been loading for over 300ms: skeletons may show, and the status has its text. */
  show: boolean;
  reportFetching(id: string, fetching: boolean): void;
  /** Some section is refreshing data that is already on screen. */
  fetching: boolean;
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
  const [fetchingIds, setFetchingIds] = useState<ReadonlySet<string>>(new Set());
  const reportFetching = useCallback(
    (id: string, isFetching: boolean) => setFetchingIds((current) => withReport(current, id, isFetching)),
    [],
  );
  const fetching = fetchingIds.size > 0;
  const value = useMemo(() => ({ report, show, reportFetching, fetching }), [report, show, reportFetching, fetching]);

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
 * showing the content. Must be used inside a `PageLoading`.
 */
export function useReportFirstLoad(loading: boolean): boolean {
  const page = useContext(PageLoadingContext);
  if (!page) throw new Error("useReportFirstLoad must be used inside <PageLoading>");
  const id = useId();
  const { report } = page;

  useEffect(() => {
    report(id, loading);
    return () => report(id, false);
  }, [report, id, loading]);

  return page.show && loading;
}

/**
 * A section calls this with whether it is refreshing data that is already on screen, for example
 * `isFetching && data !== undefined`. The page header shows one indicator however many sections report.
 * Must be used inside a `PageLoading`.
 */
export function useReportFetching(fetching: boolean): void {
  const page = useContext(PageLoadingContext);
  if (!page) throw new Error("useReportFetching must be used inside <PageLoading>");
  const id = useId();
  const { reportFetching } = page;

  useEffect(() => {
    reportFetching(id, fetching);
    return () => reportFetching(id, false);
  }, [reportFetching, id, fetching]);
}

/** Whether the page is refreshing, or null outside a `PageLoading` (the header then has no slot). */
export function usePageFetchingOptional(): boolean | null {
  return useContext(PageLoadingContext)?.fetching ?? null;
}
