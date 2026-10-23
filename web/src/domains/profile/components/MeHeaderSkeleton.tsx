import { SkeletonBar } from "../../../shared/ui/Skeleton";

// The three lines under the Avatar have one height each, in the loaded header and in its skeleton, so nothing
// moves when the answer arrives: the name (text-3xl, line height 1.25), the email (text-sm) and the Streak line.
// MeHeader takes the type classes from here, and each height below is that type's line height, so the two cannot drift.
export const NAME_TEXT = "text-3xl leading-tight font-bold";
export const EMAIL_TEXT = "text-sm font-semibold text-muted";
const NAME_LINE = "h-[2.34rem]";
const EMAIL_LINE = "h-5";
export const STREAK_LINE = "h-6";
export const COLUMN = "flex flex-col items-center gap-2 pb-4 text-center";

/** One skeleton line at a loaded line's height: a pulsing bar, or just the space while the skeleton is still hidden. */
function Line({ height, width, show }: { height: string; width: string; show: boolean }) {
  return show ? <SkeletonBar className={`${height} ${width}`} /> : <span className={`block ${height}`} />;
}

/** The header's shape while `GET /me` loads: the Avatar circle and three lines, at the loaded sizes. */
export function MeHeaderSkeleton({ showBars, hasHome }: { showBars: boolean; hasHome: boolean }) {
  return (
    <div aria-hidden="true" className={COLUMN}>
      <span className={`block size-20 rounded-pill ${showBars ? "bg-muted/20 motion-safe:animate-pulse" : ""}`} />
      <div className={`mt-1 flex w-full justify-center ${NAME_LINE}`}>
        <Line height={NAME_LINE} width="w-1/2" show={showBars} />
      </div>
      <div className={`flex w-full justify-center ${EMAIL_LINE}`}>
        <Line height={EMAIL_LINE} width="w-2/3" show={showBars} />
      </div>
      {hasHome && (
        <div className={`flex w-full justify-center ${STREAK_LINE}`}>
          <Line height={STREAK_LINE} width="w-1/4" show={showBars} />
        </div>
      )}
    </div>
  );
}
