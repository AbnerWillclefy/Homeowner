import { SkeletonBar, SkeletonCard, SkeletonPill, SkeletonTile } from "../../../shared/ui/Skeleton";
import { SkeletonHeader } from "../../../shared/ui/SkeletonHeader";
import { CheckInSkeleton } from "../../checkin/components/CheckInSkeleton";
import { ChoresSkeleton } from "../../chores/components/ChoresSkeleton";
import { DayPlanSkeleton } from "../../dayplan/components/DayPlanSkeleton";
import { ResidentRowSkeleton } from "../../residents/components/ResidentRowSkeleton";
import { StreakSkeleton } from "../../streak/components/StreakSkeleton";

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
      <SkeletonHeader />
      <SkeletonCard className="py-1">
        <ul className="m-0 list-none p-0">
          <ResidentRowSkeleton />
          <ResidentRowSkeleton />
        </ul>
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

/** Today while its Home loads: the greeting, then the Check-in, Streak and Day Plan sections, spaced as `HomeDay` spaces them. */
export function TodaySkeleton() {
  return (
    <div aria-hidden="true">
      <SkeletonHeader />
      <section>
        <CheckInSkeleton />
      </section>
      <StreakSkeleton />
      <section>
        <DayPlanSkeleton />
      </section>
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
