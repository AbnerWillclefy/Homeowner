import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { FirstLoadSettledContext } from "./FirstLoadSettledContext";
import { FetchingIndicator } from "./FetchingIndicator";
import { withReport } from "./loadingReports";
import { useDelayedFlag } from "./useDelayedFlag";

type Report = (id: string, on: boolean) => void;

interface PageLoadingValue {
  report: Report;
  /** Some section has been loading for over 300ms: skeletons may show, and the status has its text. */
  show: boolean;
  reportFetching: Report;
  /** Some section is refreshing data that is already on screen. */
  fetching: boolean;
}

const PageLoadingContext = createContext<PageLoadingValue | null>(null);

/** The ids of the sections reporting true right now: `active` is whether any does. */
function useReportSet(): { active: boolean; report: Report } {
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());
  const report = useCallback<Report>((id, on) => setIds((current) => withReport(current, id, on)), []);
  return { active: ids.size > 0, report };
}

/**
 * Tells the app, once per mount, that this page's first load has settled: the loading set is empty. The check waits
 * a tick and is cancelled if a section reports loading again, so a hand-over between sections (the Home, then the
 * Check-in, Day Plan and Streak) is not mistaken for the end. A page whose data was cached never reports loading,
 * so it settles after the first effect pass. Failures count: a failed section reports false.
 */
function useReportFirstSettle(active: boolean) {
  const onSettled = useContext(FirstLoadSettledContext);
  const latest = useRef(onSettled);
  latest.current = onSettled;
  const fired = useRef(false);

  useEffect(() => {
    if (active || fired.current) return;
    const timer = setTimeout(() => {
      fired.current = true;
      latest.current();
    }, 0);
    return () => clearTimeout(timer);
  }, [active]);
}

/** Reports `on` under this component's own id for as long as it is mounted, and false after. */
function useRegisterReport(hook: string, pick: (page: PageLoadingValue) => Report, on: boolean): PageLoadingValue {
  const page = useContext(PageLoadingContext);
  if (!page) throw new Error(`${hook} must be used inside <PageLoading>`);
  const id = useId();
  const report = pick(page);

  useEffect(() => {
    report(id, on);
    return () => report(id, false);
  }, [report, id, on]);

  return page;
}

/**
 * One polite status for a whole page. It renders a single always-mounted, visually hidden `role="status"` region
 * whose text is `message` while any section that reports to it has been loading for over 300ms, and empty
 * otherwise. The region never unmounts, so a page whose sections load one after the other (Today: Home, then
 * Check-in, Day Plan and Streak) is announced once, and the skeletons it shows are `aria-hidden`.
 */
export function PageLoading({ message, children }: { message: string; children: ReactNode }) {
  const loading = useReportSet();
  useReportFirstSettle(loading.active);
  const fetching = useReportSet();
  const show = useDelayedFlag(loading.active);
  const report = loading.report;
  const reportFetching = fetching.report;
  const isFetching = fetching.active;
  const value = useMemo(
    () => ({ report, show, reportFetching, fetching: isFetching }),
    [report, show, reportFetching, isFetching],
  );

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
  const page = useRegisterReport("useReportFirstLoad", (p) => p.report, loading);
  return page.show && loading;
}

/**
 * A section calls this with whether it is refreshing data that is already on screen, for example
 * `isFetching && data !== undefined`. The page header shows one indicator however many sections report.
 * Must be used inside a `PageLoading`.
 */
export function useReportFetching(fetching: boolean): void {
  useRegisterReport("useReportFetching", (p) => p.reportFetching, fetching);
}

/**
 * The refresh indicator's place in the page header: a slot as tall as the title's first line (text-3xl at
 * leading-tight) that centres the 1rem spinner, so the title never moves. Renders nothing outside a `PageLoading`.
 */
export function PageFetchingSlot() {
  const page = useContext(PageLoadingContext);
  if (!page) return null;
  return (
    <span data-slot="fetching" className="flex h-[calc(1.875rem*1.25)] w-4 shrink-0 items-center justify-center">
      <FetchingIndicator active={page.fetching} />
    </span>
  );
}
