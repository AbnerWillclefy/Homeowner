import { Flame, Pencil, UserPen } from "lucide-react";
import { Link } from "react-router";
import { useShell } from "../../../app/components/ShellContext";
import { ME_EDIT_PATH } from "../../../app/logic/routes";
import { useI18n } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { PageFetchingSlot, useReportFetching, useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { COLUMN, EMAIL_TEXT, MeHeaderSkeleton, NAME_TEXT, STREAK_LINE } from "./MeHeaderSkeleton";
import { MeLoadFailed } from "./MeLoadFailed";
import { Avatar } from "../../residents/components/Avatar";
import { useStreak } from "../../streak/hooks/useStreak";
import type { Me } from "../../auth/api/meApi";

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
      {/* The name keeps the middle: the fixed slot on the right shows the refresh indicator, and an empty twin on
          the left of the same width keeps the name centred. */}
      <div className="mt-1 flex w-full items-start gap-2">
        <span aria-hidden="true" className="w-4 shrink-0" />
        <p className={`my-0 min-w-0 flex-1 ${NAME_TEXT} [overflow-wrap:anywhere]`}>{me.name}</p>
        <PageFetchingSlot />
      </div>
      <p className={`my-0 ${EMAIL_TEXT} [overflow-wrap:anywhere]`}>{me.email}</p>
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
  useReportFetching(me.refreshing);

  return (
    <div>
      <h2 className="sr-only">
        {t("me.heading")}
      </h2>
      {loading && <MeHeaderSkeleton showBars={showSkeleton} hasHome={hasHome} />}
      {me.state.kind === "ready" && <Loaded me={me.state.me} hasHome={hasHome} />}
      {me.state.kind === "failed" && <MeLoadFailed className="items-center pb-4 text-center" />}
    </div>
  );
}
