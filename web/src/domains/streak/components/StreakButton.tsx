import { Flame } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../../../shared/i18n";
import { AppDialog } from "../../../shared/ui/AppDialog";
import { Button } from "../../../shared/ui/Button";
import { useReportFirstLoad } from "../../../shared/ui/PageLoading";
import { SkeletonPill } from "../../../shared/ui/Skeleton";
import type { Streak } from "../api/api";
import { streakButtonLabel } from "../logic/streakButtonLabel";
import { StreakDialog } from "./StreakDialog";

/**
 * The Resident's current Streak as a small flame with its number, at the end of Today's header. Tapping it opens a
 * dialog that says how a Streak works. Calm at every number: neutral colours at 0 as at 100 (ADR 0003, DESIGN.md).
 * During a slow first load it holds an empty box of its own size (a pulsing pill after 300ms), so the greeting does
 * not reflow when the number arrives; when the Streak could not be read it is absent, with no space reserved. The
 * open state is local: a refetch while the dialog is open updates the number in place and never closes it.
 */
export function StreakButton({ streak, loading }: { streak: Streak | null; loading: boolean }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  // The page's one status announces the wait; the placeholder shows after 300ms and goes away for good on any answer.
  const showSkeleton = useReportFirstLoad(loading);
  if (loading) {
    return (
      <div aria-hidden="true" className="flex h-11 w-16 items-center">
        {showSkeleton && <SkeletonPill className="w-full" />}
      </div>
    );
  }
  if (!streak) return null;

  return (
    <AppDialog
      open={open}
      onDismiss={() => setOpen(false)}
      title={t("streak.dialog.title")}
      size="centered"
      trigger={
        <Button
          variant="ghost"
          aria-label={streakButtonLabel(t, streak.current)}
          onClick={() => setOpen(true)}
          className="min-w-16 gap-1 px-2!"
        >
          <Flame aria-hidden="true" size={20} />
          <span className="font-bold tabular-nums">{new Intl.NumberFormat(locale).format(streak.current)}</span>
        </Button>
      }
      footer={
        <Button variant="secondary" fullWidth onClick={() => setOpen(false)}>
          {t("streak.close")}
        </Button>
      }
    >
      <StreakDialog streak={streak} />
    </AppDialog>
  );
}
