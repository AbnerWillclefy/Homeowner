import { SkeletonBar } from "./Skeleton";

interface Props {
  withLine?: boolean;
}

/** The shape of a `PageHeader`: a title bar and a line under it, with the same space below. */
export function SkeletonHeader({ withLine = true }: Props) {
  return (
    <div aria-hidden="true" className="mb-8 flex flex-col gap-3">
      <SkeletonBar className="h-8 w-2/3" />
      {withLine && <SkeletonBar className="h-5 w-1/3" />}
    </div>
  );
}
