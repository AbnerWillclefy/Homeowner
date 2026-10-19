import { SkeletonBar, SkeletonCard, SkeletonPill, SkeletonTile } from "../../../shared/ui/Skeleton";

/** The shape of a Task card: the Category tile and two text bars, a fact bar, and a right-aligned button. */
function TaskCardSkeleton() {
  return (
    <SkeletonCard>
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

/** What Today's Day Plan section shows while its first load runs: a group heading and three Task cards. */
export function DayPlanSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      <SkeletonBar className="mb-1 h-6 w-1/2" />
      <TaskCardSkeleton />
      <TaskCardSkeleton />
      <TaskCardSkeleton />
    </div>
  );
}
