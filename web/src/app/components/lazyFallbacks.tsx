import type { ReactNode } from "react";
import { MeHeaderSkeleton } from "../../domains/profile/components/MeHeaderSkeleton";
import { ProfileSkeleton } from "../../domains/profile/components/ProfileSkeleton";
import { BackToHome } from "../../domains/residents/components/BackToHome";
import { ResidentPageSkeleton } from "../../domains/residents/components/ResidentPageSkeleton";
import { useI18n } from "../../shared/i18n";
import { SkeletonBar, SkeletonPill } from "../../shared/ui/Skeleton";
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

/** A Resident's page: the back link, then the page's skeleton. ResidentRoute shows the same pair once loaded, so nothing jumps. */
export function ResidentFallback() {
  return (
    <>
      <BackToHome />
      <ResidentPageSkeleton />
    </>
  );
}

/** The edit screen: the Back link, the title, the photo and the name field, at roughly the loaded sizes. */
export function MeEditFallback() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <SkeletonPill className="w-24" />
      <SkeletonHeader withLine={false} />
      <div className="flex flex-col items-center gap-3">
        <SkeletonBar className="h-5 w-12" />
        <span className="block size-20 rounded-pill bg-muted/20 motion-safe:animate-pulse" />
        <SkeletonPill className="w-40" />
      </div>
      <SkeletonBar className="h-5 w-16" />
      <SkeletonPill className="w-full" />
      <SkeletonPill className="w-full" />
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
