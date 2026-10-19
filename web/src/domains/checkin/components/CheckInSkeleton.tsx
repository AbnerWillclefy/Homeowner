import { SkeletonBar, SkeletonCard, SkeletonPill } from "../../../shared/ui/Skeleton";

/** The shape of the Check-in card: the question on the left and its button on the right. */
export function CheckInSkeleton() {
  return (
    <SkeletonCard>
      <div className="flex items-center gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <SkeletonBar className="h-5 w-2/3" />
          <SkeletonBar className="h-4 w-1/3" />
        </div>
        <SkeletonPill className="w-28" />
      </div>
    </SkeletonCard>
  );
}
