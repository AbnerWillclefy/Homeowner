import { SkeletonBar } from "../../../shared/ui/Skeleton";

// The three lines under the Avatar have one height each, in the loaded header and in its skeleton, so nothing
// moves when the answer arrives: the name (text-3xl, line height 1.25), the email (text-sm) and the Streak line.
// MeHeader takes the type classes from here, and each height below is that type's line height, so the two cannot drift.
export const NAME_TEXT = "text-3xl leading-tight font-bold";
export const EMAIL_TEXT = "text-sm font-semibold text-muted";
const NAME_LINE = "h-[2.34rem]";
const EMAIL_LINE = "h-5";
export const STREAK_LINE = "h-6";
export const COLUMN = "flex flex-col gap-2 pb-4";

/** One skeleton line at a loaded line's height: a pulsing bar, or just the space while the skeleton is still hidden. */
function Line({ height, width, show }: { height: string; width: string; show: boolean }) {
  return show ? <SkeletonBar className={`${height} ${width}`} /> : <span className={`block ${height}`} />;
}

/** The header's shape while `GET /me` loads: the Avatar circle (Bedrock's 72px `lg`) and three lines, at the loaded sizes. */
export function MeHeaderSkeleton({ showBars, hasHome }: { showBars: boolean; hasHome: boolean }) {
  return (
    <div aria-hidden="true" className={COLUMN}>
      <div className="flex items-center gap-4">
        <span className={`block size-18 shrink-0 rounded-pill ${showBars ? "bg-muted/20 motion-safe:animate-pulse" : ""}`} />
        <div className="flex flex-1 flex-col">
          <div className={NAME_LINE}>
            <Line height={NAME_LINE} width="w-1/2" show={showBars} />
          </div>
          <div className={EMAIL_LINE}>
            <Line height={EMAIL_LINE} width="w-2/3" show={showBars} />
          </div>
        </div>
      </div>
      {hasHome && <Line height={STREAK_LINE} width="w-1/4" show={showBars} />}
    </div>
  );
}
