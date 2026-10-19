import { SkeletonBar, SkeletonCard, SkeletonPill } from "../../../shared/ui/Skeleton";

function ChoreRowSkeleton() {
  return (
    <SkeletonCard>
      <div className="flex items-center gap-3">
        <SkeletonBar className="h-5 w-1/2" />
      </div>
      <SkeletonBar className="h-4 w-2/3" />
    </SkeletonCard>
  );
}

/** What the Chores list shows while its first load runs: the add buttons, a group heading and Chore cards. */
export function ChoresSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-8">
      <div className="flex gap-3">
        <SkeletonPill className="flex-1" />
        <SkeletonPill className="flex-1" />
      </div>
      <div className="flex flex-col gap-3">
        <SkeletonBar className="mb-1 h-6 w-1/2" />
        <ChoreRowSkeleton />
        <ChoreRowSkeleton />
        <ChoreRowSkeleton />
      </div>
    </div>
  );
}
