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

/**
 * The shape of the folded explanation card (`CollapsibleCard` closed): its head row, an icon tile and a title
 * line, and the gap `DaySummary` leaves below it.
 */
function ExplanationSkeleton() {
  return (
    <SkeletonCard data-skeleton="explanation" className="mb-3 flex-row items-center gap-3">
      <SkeletonTile />
      <SkeletonBar className="h-5 flex-1" />
    </SkeletonCard>
  );
}

/**
 * What Today's Day Plan section shows while its first load runs: a group heading and three Task cards. With
 * `explanation` the folded explanation card sits between them, as it does on a planned day; Today's whole-page
 * skeleton passes it, a Retry's does not.
 */
export function DayPlanSkeleton({ explanation = false }: { explanation?: boolean }) {
  return (
    <div aria-hidden="true" data-testid="day-plan-skeleton" className="flex flex-col gap-3">
      <SkeletonBar className="mb-1 h-6 w-1/2" />
      {explanation && <ExplanationSkeleton />}
      <TaskCardSkeleton />
      <TaskCardSkeleton />
      <TaskCardSkeleton />
    </div>
  );
}
