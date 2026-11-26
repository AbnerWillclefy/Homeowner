import { PageHeader, type PageHeaderProps } from "@homeowner/bedrock";
import { PageFetchingSlot } from "../../shared/ui/PageLoading";

/**
 * A tab's header: Bedrock's `PageHeader` (the screen's one `h1`, where focus lands on navigation) plus the refresh
 * indicator web keeps at the end of the tools, so the title never moves when a page refetches.
 */
export function TabHeader({ tools, ...props }: PageHeaderProps) {
  return (
    <div className="mb-6">
      <PageHeader
        {...props}
        tools={
          <>
            <PageFetchingSlot />
            {tools}
          </>
        }
      />
    </div>
  );
}
