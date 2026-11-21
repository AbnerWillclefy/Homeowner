import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

/** Size comes from className. The 300ms delay and 500ms minimum belong to the app. */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn("rounded-sm bg-surface-hover motion-safe:animate-[pulse_1.6s_ease-in-out_infinite]", className)}
      {...props}
    />
  );
}
