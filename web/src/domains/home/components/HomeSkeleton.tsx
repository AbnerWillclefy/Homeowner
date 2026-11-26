import { List } from "@homeowner/bedrock";
import { SkeletonBar } from "../../../shared/ui/Skeleton";
import { TabBody } from "../../../app/components/TabBody";
import { SkeletonHeader } from "../../../shared/ui/SkeletonHeader";
import { ChoresSkeleton } from "../../chores/components/ChoresSkeleton";
import { DayPlanSkeleton, HeroSkeleton } from "../../dayplan/components/DayPlanSkeleton";
import { ResidentRowSkeleton, ResidentRowsSkeleton } from "../../residents/components/ResidentRowSkeleton";

/** The Home tab while its Home loads: the header, the Residents list and the settings and Leave rows. */
export function HomeSkeleton() {
  return (
    <div aria-hidden="true">
      <SkeletonHeader withLine={false} />
      <TabBody>
      <List>
        <ResidentRowsSkeleton />
      </List>
      <List>
        <ResidentRowSkeleton />
        <ResidentRowSkeleton />
      </List>
      </TabBody>
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
      <TabBody>
        <ChoresSkeleton />
      </TabBody>
    </div>
  );
}
