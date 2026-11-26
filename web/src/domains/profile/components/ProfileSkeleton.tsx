import { SkeletonBar, SkeletonCard } from "../../../shared/ui/Skeleton";

/** Me's profile rows while the details load: the Baseline, Preferences and Restrictions rows. */
export function ProfileSkeleton() {
  return (
    <SkeletonCard>
      {Array.from({ length: 3 }, (_, row) => (
        <SkeletonBar key={row} className="h-11 w-full" />
      ))}
    </SkeletonCard>
  );
}
