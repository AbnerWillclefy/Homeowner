import type { ReactNode } from "react";
import { MeHeaderSkeleton } from "../../domains/profile/components/MeHeaderSkeleton";
import { ProfileSkeleton } from "../../domains/profile/components/ProfileSkeleton";
import { useI18n } from "../../shared/i18n";
import { SkeletonCard } from "../../shared/ui/Skeleton";
import { SkeletonHeader } from "../../shared/ui/SkeletonHeader";
import { useShell } from "./ShellContext";

// What shows while a screen without a skeleton of its own loads. They live here, in the main bundle, so they are
// there before the screen's chunk is.

/** Me: the header's shape, then the three profile cards. The Streak line is reserved only for a Resident with a Home, as MeHeader does. */
export function MeFallback() {
  const { home } = useShell();
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <MeHeaderSkeleton showBars hasHome={home.state.kind === "ready"} />
      <ProfileSkeleton />
    </div>
  );
}

/** The edit screen: a title and one card for the form. */
export function MeEditFallback() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <SkeletonHeader withLine={false} />
      <SkeletonCard className="h-40" />
    </div>
  );
}

/** Onboarding's gradient frame, the one the screen draws, so nothing jumps when the step arrives. */
export function OnboardingFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-linear-to-b from-welcome-from to-welcome-to pt-[env(safe-area-inset-top)] text-text">
      <div className="onboarding-x mx-auto w-full max-w-lg pt-6">{children}</div>
    </div>
  );
}

/** The plain loading line the Guard also shows while onboarding loads. The page status says it aloud, so this is hidden from screen readers. */
export function OnboardingFallback() {
  const { t } = useI18n();
  return (
    <p aria-hidden="true" className="my-0 text-muted">
      {t("onboarding.loading")}
    </p>
  );
}
