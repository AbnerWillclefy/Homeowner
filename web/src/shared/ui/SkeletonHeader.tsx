import { SkeletonBar } from "./Skeleton";

interface Props {
  withLine?: boolean;
  /** Matches `PageHeader`'s `tight`. */
  tight?: boolean;
}

/** The shape of a `PageHeader`: a title bar and a line under it, with the same space below. */
export function SkeletonHeader({ withLine = true, tight = false }: Props) {
  return (
    <div aria-hidden="true" className={`flex flex-col gap-3 ${tight ? "mb-3" : "mb-8"}`}>
      <SkeletonBar className="h-8 w-2/3" />
      {withLine && <SkeletonBar className="h-5 w-1/3" />}
    </div>
  );
}
