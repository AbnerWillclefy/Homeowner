import { SkeletonBar, SkeletonCard, SkeletonTile } from "../../../shared/ui/Skeleton";

function SectionSkeleton({ rows }: { rows: number }) {
  return (
    <SkeletonCard>
      <div className="flex items-center gap-3">
        <SkeletonTile />
        <SkeletonBar className="h-5 w-1/2" />
      </div>
      <SkeletonBar className="h-4 w-4/5" />
      {Array.from({ length: rows }, (_, row) => (
        <SkeletonBar key={row} className="h-11 w-full" />
      ))}
    </SkeletonCard>
  );
}

/** The Me tab while the details load: the Baseline, Preferences and Restrictions cards. */
export function ProfileSkeleton() {
  return (
    <>
      <SectionSkeleton rows={3} />
      <SectionSkeleton rows={3} />
      <SectionSkeleton rows={3} />
    </>
  );
}
