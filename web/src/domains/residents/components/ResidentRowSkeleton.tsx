import { SkeletonBar } from "../../../shared/ui/Skeleton";

/** The two placeholder rows (`li`, for inside the `List`) that keep the Residents list the height of the common two-person Home. */
export function ResidentRowsSkeleton({ className = "" }: { className?: string }) {
  return (
    <>
      <ResidentRowSkeleton className={className} />
      <ResidentRowSkeleton className={className} />
    </>
  );
}

/** A Residents row while the list loads: a round Avatar and two lines, at a real Row's height (4rem). */
export function ResidentRowSkeleton({ className = "" }: { className?: string }) {
  return (
    // The grid sits on a child, as a Row's does, so the List's divider adds to the li and not into its height.
    <li aria-hidden="true" className={`my-0 ${className}`}>
      <div className="flex min-h-16 items-center gap-4 px-4 py-2">
        <span className="block size-11 shrink-0 rounded-pill bg-muted/20 motion-safe:animate-pulse" />
        <span className="flex min-w-0 flex-1 flex-col gap-2">
          <SkeletonBar className="h-4 w-1/3" />
          <SkeletonBar className="h-3 w-1/2" />
        </span>
      </div>
    </li>
  );
}
