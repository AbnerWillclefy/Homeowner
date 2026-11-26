import { Streak as StreakChip } from "@homeowner/bedrock/home";
import { useState } from "react";
import { useI18n } from "../../../shared/i18n";
import { AppDialog } from "../../../shared/ui/AppDialog";
import { Button } from "../../../shared/ui/Button";
import { SkeletonPill } from "../../../shared/ui/Skeleton";
import { useDelayedFlag } from "../../../shared/ui/useDelayedFlag";
import type { Streak } from "../api/api";
import { streakButtonLabel } from "../logic/streakButtonLabel";
import { StreakDialog } from "./StreakDialog";

/**
 * The Resident's current Streak as Bedrock's Streak chip (a flame, or a pause on a Drained day, with its number), in Today's header Streak slot. Tapping it opens a
 * dialog that says how a Streak works. Calm at every number: neutral colours at 0 as at 100 (ADR 0003, DESIGN.md).
 * During the first load it holds an empty box of its own size (a pulsing pill after 300ms), so the bar does not
 * reflow when the number arrives; when the Streak could not be read it is absent, and the bar's slot keeps the
 * width. The open state is local: a refetch while the dialog is open updates the number in place and never closes it.
 */
export function StreakButton({ streak, loading, paused = false }: { streak: Streak | null; loading: boolean; paused?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  // The bar sits above every page's `PageLoading`, so the wait is not announced here (the flame is secondary); the
  // placeholder shows after 300ms and goes away for good on any answer.
  const showSkeleton = useDelayedFlag(loading);
  if (loading) {
    return (
      <div aria-hidden="true" className="flex h-11 w-16 items-center">
        {showSkeleton && <SkeletonPill className="w-full" />}
      </div>
    );
  }
  if (!streak) return null;
  // ADR 0014 rule 1: a Completion grows the Streak even on a Drained day, so only a day that has not grown is paused.
  const isPaused = paused && !streak.todayGrew;

  return (
    <AppDialog
      open={open}
      onDismiss={() => setOpen(false)}
      title={t("streak.dialog.title")}
      size="centered"
      trigger={
        <StreakChip
          days={streak.current}
          paused={isPaused && streak.current > 0}
          label={streakButtonLabel(t, streak.current, isPaused)}
          onClick={() => setOpen(true)}
        />
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
