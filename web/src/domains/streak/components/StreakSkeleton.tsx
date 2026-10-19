import { SkeletonBar, SkeletonCard, SkeletonTile } from "../../../shared/ui/Skeleton";

/** The shape of the Streak card: the flame tile and two lines. A section, like the real card, so the spacing matches. */
export function StreakSkeleton() {
  return (
    <section aria-hidden="true">
      <SkeletonCard>
        <div className="flex items-center gap-4">
          <SkeletonTile />
          <div className="flex flex-1 flex-col gap-2">
            <SkeletonBar className="h-3.5 w-1/3" />
            <SkeletonBar className="h-5 w-1/2" />
          </div>
        </div>
      </SkeletonCard>
    </section>
  );
}
