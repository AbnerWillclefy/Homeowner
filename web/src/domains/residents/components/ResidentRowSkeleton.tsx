import { SkeletonBar } from "../../../shared/ui/Skeleton";
import { META_LINE, NAME_LINE, ROW_PADDING } from "./rowLayout";

/** The two placeholder rows that keep the Residents card the height of the common two-person Home. */
export function ResidentRowsSkeleton({ className = "" }: { className?: string }) {
  return (
    <ul aria-hidden="true" className={`m-0 list-none p-0 ${className}`}>
      <ResidentRowSkeleton />
      <ResidentRowSkeleton />
    </ul>
  );
}

/** A Residents card row while the list loads: a round Avatar and two lines, at the real row's height. */
export function ResidentRowSkeleton() {
  return (
    <li className={`flex items-center gap-3 border-t border-border/40 first:border-t-0 ${ROW_PADDING}`}>
      <span className="block size-11 shrink-0 rounded-pill bg-muted/20 motion-safe:animate-pulse" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`flex items-center ${NAME_LINE}`}>
          <SkeletonBar className="h-4 w-1/3" />
        </span>
        <span className={`flex items-center ${META_LINE}`}>
          <SkeletonBar className="h-3 w-1/2" />
        </span>
      </span>
    </li>
  );
}
