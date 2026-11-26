import { PageHeader, type PageHeaderProps } from "@homeowner/bedrock";
import { PageFetchingSlot } from "../../shared/ui/PageLoading";

/**
 * A tab's head (the design's `hm-head`: 24px above, 8px below): Bedrock's `PageHeader` (the screen's one `h1`, where
 * focus lands on navigation) plus the refresh indicator web keeps at the end of the tools, so the title never moves
 * when a page refetches. `refresh={false}` leaves the indicator out, for a tab that carries it elsewhere.
 */
export function TabHeader({ tools, refresh = true, ...props }: PageHeaderProps & { refresh?: boolean }) {
  return (
    <div className="pt-6 pb-2">
      <PageHeader
        {...props}
        tools={
          refresh ? (
            <>
              <PageFetchingSlot />
              {tools}
            </>
          ) : (
            tools
          )
        }
      />
    </div>
  );
}
