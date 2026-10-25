import { config } from "../../../shared/config";
import { SkeletonBar,SkeletonCard, SkeletonPill, SkeletonTile } from "../../../shared/ui/Skeleton";
import { SkeletonHeader } from "../../../shared/ui/SkeletonHeader";
import { CheckInSkeleton } from "../../checkin/components/CheckInSkeleton";
import { ChoresSkeleton } from "../../chores/components/ChoresSkeleton";
import { DayPlanSkeleton } from "../../dayplan/components/DayPlanSkeleton";
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
      <SkeletonHeader />
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

/**
 * The shape of `ReplanButton`: its `mb-6` wrapper, a full-width button, and the status paragraph with its own
 * classes and no text, so it takes the same text-relative height as the real one.
 */
function ReplanSkeleton() {
  return (
    <div data-skeleton="replan" className="mb-6">
      <SkeletonPill className="w-full" />
      <p className="mt-2 mb-0 text-muted" />
    </div>
  );
}

/**
 * Today's final layout, for the wait before its reads answer (the Home, then the Check-in, Day Plan and Streak):
 * the header with the Streak button placeholder, the Replan block when Replan is enabled, the Check-in card, and the
 * Tasks section with its heading, the folded explanation card and the Task cards. Spaced as `HomeDay` spaces them,
 * by structure and `rem`, so pt-BR and the largest text size grow it as they grow the page.
 */
export function TodaySkeleton() {
  return (
    <div aria-hidden="true">
      <SkeletonHeader aside />
      {config.replanEnabled && <ReplanSkeleton />}
      <section>
        <CheckInSkeleton />
      </section>
      <section>
        <DayPlanSkeleton explanation />
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
