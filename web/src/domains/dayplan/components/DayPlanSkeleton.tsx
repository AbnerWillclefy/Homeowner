import { SkeletonBar, SkeletonCard, SkeletonPill, SkeletonTile } from "../../../shared/ui/Skeleton";

/** The shape of a Task card: the Category tile and two text bars, a fact bar, and a right-aligned button. */
function TaskCardSkeleton() {
  return (
    <SkeletonCard data-skeleton="task">
      <div className="flex items-center gap-3">
        <SkeletonTile />
        <div className="flex flex-1 flex-col gap-2">
          <SkeletonBar className="h-3.5 w-1/3" />
          <SkeletonBar className="h-5 w-2/3" />
        </div>
      </div>
      <SkeletonBar className="h-4 w-1/2" />
      <div className="flex justify-end">
        <SkeletonPill />
      </div>
    </SkeletonCard>
  );
}

/** The one muted line of `DaySummary`: one text line high (1.5rem), and the space `PlanView` leaves below it. */
function SummarySkeleton() {
  return (
    <div data-skeleton="summary" className="mb-6">
      <SkeletonBar className="h-6 w-3/4" />
    </div>
  );
}

/**
 * What Today's Day Plan section shows while its first load runs: three Task cards under the page header (which
 * Today draws itself). With `summary` the one-line summary sits above them, as it does on a planned day; Today's
 * whole-page skeleton passes it, a Retry's does not.
 */
export function DayPlanSkeleton({ summary = false }: { summary?: boolean }) {
  return (
    <div aria-hidden="true" data-testid="day-plan-skeleton">
      {summary && <SummarySkeleton />}
      <div className="flex flex-col gap-3">
        <TaskCardSkeleton />
        <TaskCardSkeleton />
        <TaskCardSkeleton />
      </div>
    </div>
  );
}
