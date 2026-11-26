import { SkeletonBar } from "./Skeleton";

interface Props {
  withLine?: boolean;
}

/** The shape of a `TabHeader`: a title bar as tall as its refresh slot and a line under it, with the same space below. */
export function SkeletonHeader({ withLine = true }: Props) {
  return (
    <div aria-hidden="true" className="mb-6 flex flex-col gap-3">
      <SkeletonBar className="h-[calc(1.875rem*1.25)] w-2/3" />
      {withLine && <SkeletonBar className="h-5 w-1/3" />}
    </div>
  );
}
