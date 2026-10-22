import { Flame, Pencil, UserPen } from "lucide-react";
import { Link } from "react-router";
import { useShell } from "../../../app/components/ShellContext";
import { ME_EDIT_PATH } from "../../../app/logic/routes";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { SkeletonBar } from "../../../shared/ui/Skeleton";
import { MeLoadFailed } from "./MeLoadFailed";
import { Avatar } from "../../residents/components/Avatar";
import { useStreak } from "../../streak/hooks/useStreak";
import type { Me } from "../../auth/api/meApi";

// The three lines under the Avatar have one height each, in the loaded header and in its skeleton, so nothing
// moves when the answer arrives: the name (text-3xl, line height 1.25), the email (text-sm) and the Streak line.
const NAME_LINE = "h-[2.34rem]";
const EMAIL_LINE = "h-5";
const STREAK_LINE = "h-6";
const COLUMN = "flex flex-col items-center gap-2 pb-4 text-center";

/** The current Streak, only for a Resident with a Home (it is the Home's). A Streak of 0 shows nothing: it is no failure to show. */
function HeaderStreak() {
  const { t } = useI18n();
  const { streak } = useStreak();
  return (
    <p className={`my-0 flex items-center gap-1.5 font-bold ${STREAK_LINE}`}>
      {streak !== null && streak.current > 0 && (
        <>
          <Flame aria-hidden="true" size={18} className="text-accent" />
          {t("streak.days", { count: streak.current })}
        </>
      )}
    </p>
  );
}

function Loaded({ me, hasHome }: { me: Me; hasHome: boolean }) {
  const { t } = useI18n();
  const nothingSet = me.displayName === null && me.photoUrl === null;
  return (
    <div className={COLUMN}>
      <div className="relative">
        <Avatar size="lg" resident={me} />
        {!nothingSet && (
          <Button asChild variant="secondary" icon className="absolute -right-3 -bottom-2">
            <Link to={ME_EDIT_PATH} aria-label={t("me.header.edit")}>
              <Pencil aria-hidden="true" size={18} />
            </Link>
          </Button>
        )}
      </div>
      <p className="mt-1 mb-0 text-3xl leading-tight font-bold [overflow-wrap:anywhere]">{me.name}</p>
      <p className="my-0 text-sm font-semibold text-muted [overflow-wrap:anywhere]">{me.email}</p>
      {hasHome && <HeaderStreak />}
      {nothingSet && (
        <Button asChild variant="link">
          <Link to={ME_EDIT_PATH}>
            <UserPen aria-hidden="true" size={18} />
            {t("me.header.addLink")}
          </Link>
        </Button>
      )}
    </div>
  );
}

/** One skeleton line at a loaded line's height: a pulsing bar, or just the space while the skeleton is still hidden. */
function Line({ height, width, show }: { height: string; width: string; show: boolean }) {
  return show ? <SkeletonBar className={`${height} ${width}`} /> : <span className={`block ${height}`} />;
}

/** The header's shape while `GET /me` loads: the Avatar circle and three lines, at the loaded sizes. */
function Skeleton({ showBars, hasHome }: { showBars: boolean; hasHome: boolean }) {
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

/**
 * The top of Me: the person first. Their Avatar, name (the email's local part until they set one), email and
 * current Streak, with a link to the edit screen: "Add your name and photo" while nothing is set, otherwise a
 * pencil on the Avatar. The tab's h2 stays for screen readers and for focus after navigation; the name is the
 * visible title. While `GET /me` loads there is a skeleton of the same size (after 300ms, like the other
 * sections), and when it fails an inline message with Retry; the cards below never wait on it.
 */
export function MeHeader() {
  const { t } = useI18n();
  const { me, home } = useShell();
  // Only a Resident with a Home has a Streak; reserving its line for anyone else would leave a gap.
  const hasHome = home.state.kind === "ready";
  const loading = me.state.kind === "loading";
  const showSkeleton = useReportFirstLoad(loading);

  return (
    <div>
      <h2 className="sr-only">
        {t("me.heading")}
      </h2>
      {loading && <Skeleton showBars={showSkeleton} hasHome={hasHome} />}
      {me.state.kind === "ready" && <Loaded me={me.state.me} hasHome={hasHome} />}
      {me.state.kind === "failed" && <MeLoadFailed className="items-center pb-4 text-center" />}
    </div>
  );
}
