import { SkeletonBar, SkeletonTile } from "./Skeleton";

interface Props {
  withLine?: boolean;
  /** A control-sized square at the end of the title bar, for a header with an `aside` (Today's Streak button). */
  aside?: boolean;
}

/** The shape of a `PageHeader`: a title bar and a line under it, with the same space below. */
export function SkeletonHeader({ withLine = true, aside = false }: Props) {
  return (
    <div aria-hidden="true" className="mb-8 flex flex-col gap-3">
      {aside ? (
        <div className="flex items-start justify-between gap-2">
          <SkeletonBar className="mt-0.5 h-8 w-2/3" />
          <SkeletonTile />
        </div>
      ) : (
        <SkeletonBar className="h-8 w-2/3" />
      )}
      {withLine && <SkeletonBar className="h-5 w-1/3" />}
    </div>
  );
}
