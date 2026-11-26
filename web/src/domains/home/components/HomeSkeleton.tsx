import { SkeletonBar,SkeletonCard, SkeletonPill, SkeletonTile } from "../../../shared/ui/Skeleton";
import { SkeletonHeader } from "../../../shared/ui/SkeletonHeader";
import { ChoresSkeleton } from "../../chores/components/ChoresSkeleton";
import { DayPlanSkeleton, HeroSkeleton } from "../../dayplan/components/DayPlanSkeleton";
import { ResidentRowsSkeleton } from "../../residents/components/ResidentRowSkeleton";

function TitledCardSkeleton({ lines }: { lines: number }) {
  return (
    <SkeletonCard>
      <div className="flex items-center gap-3">
        <SkeletonTile />
        <SkeletonBar className="h-5 w-1/2" />
      </div>
      {Array.from({ length: lines }, (_, line) => (
        <SkeletonBar key={line} className={line % 2 === 0 ? "h-4 w-full" : "h-4 w-2/3"} />
      ))}
    </SkeletonCard>
  );
}

/** The Home tab while its Home loads: the header, the Residents card, the Invite card, the folded settings card and the Leave card. */
export function HomeSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <SkeletonHeader withLine={false} />
      <SkeletonCard className="py-1">
        <ResidentRowsSkeleton />
      </SkeletonCard>
      <TitledCardSkeleton lines={2} />
      <TitledCardSkeleton lines={1} />
      <SkeletonCard>
        <SkeletonBar className="h-4 w-2/3" />
        <SkeletonPill className="w-32" />
      </SkeletonCard>
    </div>
  );
}

/** Today's header: a title bar in the row the tools' 2.75rem slots make, so the real header takes its place without moving. */
function TodayHeaderSkeleton() {
  return (
    <div className="mb-6 flex min-h-11 items-center">
      <SkeletonBar className="h-8 w-2/3" />
    </div>
  );
}

/**
 * Today's final layout, for the wait before the Home answers: the header (a title), the hero card's box, the one-line summary and the
 * Task cards. Once the Home is known `HomeDay` draws the real header and this skeleton's cards. Spaced as `HomeDay` spaces
 * them, by structure and `rem`, so pt-BR and the largest text size grow it as they grow the page.
 */
export function TodaySkeleton() {
  return (
    <div aria-hidden="true">
      <TodayHeaderSkeleton />
      <HeroSkeleton />
      <DayPlanSkeleton summary />
    </div>
  );
}

/** Chores while its Home loads: the header and the list. */
export function ChoresPageSkeleton() {
  return (
    <div aria-hidden="true">
      <SkeletonHeader withLine={false} />
      <ChoresSkeleton />
    </div>
  );
}
