import { Suspense, type ComponentType, type ReactNode } from "react";
import { useI18n, type MessageKey } from "../../shared/i18n";
import { PageLoading, useReportFirstLoad } from "../../shared/ui/PageLoading";
import { ChunkErrorBoundary } from "./ChunkErrorBoundary";

/** Draws the skeleton once the wait has passed 300ms, by the same rule as a loaded page's first data load. */
function DelayedSkeleton({ skeleton }: { skeleton: ReactNode }) {
  const show = useReportFirstLoad(true);
  return show ? <div data-testid="lazy-skeleton">{skeleton}</div> : null;
}

interface Props {
  /** The page's loading message, announced politely once the wait passes 300ms. */
  message: MessageKey;
  /** The page's own skeleton. Its component is imported statically by the caller, so it is there before the chunk. */
  skeleton: ReactNode;
  /** Put around the fallback and the failure alert when the screen brings no frame of its own (onboarding). */
  frame?: ComponentType<{ children: ReactNode }>;
  children: ReactNode;
}

/**
 * The boundary for one lazy screen: its page skeleton while the chunk loads (after 300ms, never a full-screen
 * spinner) and an alert with Retry if the chunk cannot load. Give each route's element its own `key`, and one of
 * these: in a router transition React keeps the old screen up instead of showing the fallback of a boundary that
 * was already mounted, so a boundary shared by two routes would leave the previous tab on screen.
 */
export function LazyPage({ message, skeleton, frame: Frame, children }: Props) {
  const { t } = useI18n();
  const fallback = (
    <PageLoading message={t(message)}>
      <DelayedSkeleton skeleton={skeleton} />
    </PageLoading>
  );
  return (
    <ChunkErrorBoundary frame={Frame}>
      <Suspense fallback={Frame ? <Frame>{fallback}</Frame> : fallback}>{children}</Suspense>
    </ChunkErrorBoundary>
  );
}

/** A dialog's boundary: nothing while its code loads, and nothing if it cannot load. */
export function LazyDialog({ children }: { children: ReactNode }) {
  return (
    <ChunkErrorBoundary quiet>
      <Suspense fallback={null}>{children}</Suspense>
    </ChunkErrorBoundary>
  );
}
