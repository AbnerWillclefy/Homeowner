import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { RecoveredNotice } from "../home/recovered";
import { useInvite } from "../invite/PendingInviteProvider";
import type { JoinOutcome } from "../invite/useJoinInvite";
import { stepsFor } from "../onboarding/steps";
import { useOnboarding } from "../onboarding/useOnboarding";
import { usePush } from "../push/usePush";
import type { FlowNotice } from "./dialogToShow";

type Onboarding = ReturnType<typeof useOnboarding>;
type Push = ReturnType<typeof usePush>;

interface Session {
  onboarding: Onboarding;
  /** The one push hook: shared by onboarding, the Me tab and the launch re-subscribe. */
  push: Push;
  /** The onboarding steps that apply on this device. */
  steps: ReturnType<typeof stepsFor>;
  /** What to show right after an Invite is dealt with. */
  after: FlowNotice | null;
  /** The start choice is due. */
  choosing: boolean;
  recovered: RecoveredNotice | "no";
  setRecovered(recovered: RecoveredNotice | "no"): void;
  finishJoin(outcome: JoinOutcome): void;
  closeRating(): void;
  decide(): void;
  /** The Home step of onboarding ended, by creating the Home or finding one already made. */
  onHomeFinished(notice: RecoveredNotice | null): void;
}

const SessionContext = createContext<Session | null>(null);

/**
 * State that belongs to a signed-in person and must survive moving between routes (for example from
 * /welcome/home to Today), so it lives above them. Mounted only while signed in: nothing here calls a protected
 * route when signed out, and signing out unmounts it so nothing leaks to the next person on the device.
 * The Home itself is NOT here: it loads inside the Shell, so it is fresh when onboarding ends.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const onboarding = useOnboarding();
  const push = usePush();
  const invite = useInvite();
  const kind = push.availability.kind;
  // Keyed on the kind: `availability` is a fresh object every render.
  const steps = useMemo(() => stepsFor(push.availability), [kind]);
  const [after, setAfter] = useState<FlowNotice | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [recovered, setRecovered] = useState<RecoveredNotice | "no">("no");
  const { clear: clearInvite } = invite;

  const finishJoin = useCallback(
    (outcome: JoinOutcome) => {
      clearInvite();
      setAfter(outcome === "joined" ? "rating" : "already-here");
    },
    [clearInvite],
  );
  const closeRating = useCallback(() => {
    setAfter(null);
    setChoosing(true);
  }, []);
  const decide = useCallback(() => setChoosing(false), []);
  const onHomeFinished = useCallback((notice: RecoveredNotice | null) => {
    setRecovered(notice ?? "no");
    setChoosing(true);
  }, []);

  const value = useMemo<Session>(
    () => ({ onboarding, push, steps, after, choosing, recovered, setRecovered, finishJoin, closeRating, decide, onHomeFinished }),
    [onboarding, push, steps, after, choosing, recovered, finishJoin, closeRating, decide, onHomeFinished],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const value = useContext(SessionContext);
  if (value === null) throw new Error("useSession needs SessionProvider");
  return value;
}

/** For the guard, which runs signed out too. */
export function useOptionalSession(): Session | null {
  return useContext(SessionContext);
}
