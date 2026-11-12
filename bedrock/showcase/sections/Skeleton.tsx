import { Skeleton } from "../../src";
import { Section } from "../Section";

export default function SkeletonSection() {
  return (
    <Section name="Skeleton">
      <div aria-busy className="flex max-w-md flex-col gap-2 rounded-lg border border-border bg-surface p-4">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    </Section>
  );
}
