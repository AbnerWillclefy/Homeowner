import { createContext, useCallback, useContext, useEffect, useId, useMemo, useReducer, useRef, type ReactNode } from "react";
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

/**
 * The ids of the sections reporting true right now: `active` is whether any does. The set lives in a ref, updated the
 * moment a section reports, and a counter re-renders; `settled()` reads the same ref, so it never sees a render-old set.
 */
function useReportSet(): { active: boolean; report: Report; settled(): boolean } {
  const ids = useRef<ReadonlySet<string>>(new Set());
  const heard = useRef(false);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const report = useCallback<Report>((id, on) => {
    heard.current = true;
    const next = withReport(ids.current, id, on);
    if (next === ids.current) return;
    ids.current = next;
    rerender();
  }, []);
  // Read during render on purpose: the ref is the one source of truth and the counter only schedules this render.
  const active = ids.current.size > 0;
  const settled = useCallback(() => heard.current && ids.current.size === 0, []);
  return { active, report, settled };
}

/**
 * Tells the app, once per mount, that this page's first load has settled: at least one section has reported and
 * none is loading. The check waits a tick and is cancelled if a section reports loading again, so a hand-over
 * between sections (the Home, then the Check-in, Day Plan and Streak) is not mistaken for the end. A section
 * whose data was cached reports false at once, so that page settles after the first effect pass. Failures count:
 * a failed section reports false. A page with no section that reports (a static onboarding step) never settles,
 * so the launch sync falls back to its timer.
 */
function useReportFirstSettle(active: boolean, settled: () => boolean) {
  const onSettled = useContext(FirstLoadSettledContext);
  const fired = useRef(false);

  useEffect(() => {
    if (active || fired.current) return;
    const timer = setTimeout(() => {
      if (!settled()) return;
      fired.current = true;
      onSettled();
    }, 0);
    return () => clearTimeout(timer);
  }, [active, settled, onSettled]);
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
  useReportFirstSettle(loading.active, loading.settled);
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
