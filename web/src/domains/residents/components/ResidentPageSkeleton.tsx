import { SkeletonBar, SkeletonCard, SkeletonTile } from "../../../shared/ui/Skeleton";
import { HEADER_COLUMN, NAME_BAR, NAME_HEIGHT, STAT_GRID } from "./pageLayout";

function DayGroupSkeleton({ cards }: { cards: number }) {
  return (
    <div className="flex flex-col gap-3">
      <SkeletonBar className="h-6 w-1/4" />
      {Array.from({ length: cards }, (_, card) => (
        <SkeletonCard key={card} className="flex-row items-center">
          <SkeletonTile />
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <SkeletonBar className="h-5 w-2/3" />
            <SkeletonBar className="h-4 w-1/2" />
          </span>
        </SkeletonCard>
      ))}
    </div>
  );
}

/**
 * The Resident page while it loads: the header (round Avatar, a name bar, two stat tiles) and two day groups, at
 * the loaded sizes. It takes its space at once and is `invisible` until the page says the wait passed 300ms, so
 * the layout is the same whether it shows or not.
 */
export function ResidentPageSkeleton({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" data-testid="resident-skeleton" className={`flex flex-col gap-4 ${className}`}>
      <div className={HEADER_COLUMN}>
        <span className="block size-20 rounded-pill bg-muted/20 motion-safe:animate-pulse" />
        <div className={`mt-1 flex w-full justify-center ${NAME_HEIGHT}`}>
          <SkeletonBar className={`${NAME_BAR} w-1/2`} />
        </div>
      </div>
      <div className={STAT_GRID}>
        {[0, 1].map((tile) => (
          <SkeletonCard key={tile} className="gap-1">
            <SkeletonBar className={`${NAME_BAR} w-1/3`} />
            <SkeletonBar className="h-5 w-3/4" />
          </SkeletonCard>
        ))}
      </div>
      <SkeletonBar className="h-7 w-1/3" />
      <DayGroupSkeleton cards={2} />
      <DayGroupSkeleton cards={1} />
    </div>
  );
}
