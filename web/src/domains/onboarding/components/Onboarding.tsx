import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { stepPath } from "../../../app/logic/routes";
import { getOnboarding, type OnboardingPosition } from "../api/api";
import type { OnboardingScreen } from "../logic/screens";
import { useSession } from "../../../app/components/SessionProvider";
import type { Home } from "../../home/api/api";
import { CreateHome } from "../../home/components/CreateHome";
import { useHomeCreated } from "../../home/hooks/useHome";
import type { RecoveredNotice } from "../../home/logic/recovered";
import { useI18n, type MessageKey } from "../../../shared/i18n";
import { BaselineFields, PreferenceFields, ProfileStatus, RestrictionFields } from "../../profile/components/ProfileSections";
import { useProfile, type ProfileState } from "../../profile/hooks/useProfile";
import { EnableReminders } from "../../push/components/EnableReminders";
import { InstallSteps } from "../../push/components/InstallSteps";
import { Button } from "@homeowner/bedrock";
import { allBaselineDaysSet } from "../logic/baselineComplete";
import { OnboardingLayout } from "./OnboardingLayout";
import { effectiveStep, progress } from "../logic/steps";
import type { OnboardingProblem } from "../logic/onboardingState";
import { useWalk } from "../hooks/useWalk";

interface Props {
  /** The step the server says to show. */
  position: OnboardingPosition;
  onPosition(position: OnboardingPosition): void;
}

const HEADING_KEY: Record<OnboardingScreen, MessageKey> = {
  finish: "onboarding.reminders.heading",
  baseline: "onboarding.baseline.heading",
  restrictions: "onboarding.restrictions.heading",
  preferences: "onboarding.preferences.heading",
  home: "onboarding.home.heading",
};

const ADVANCE_FAILED_KEY: Record<OnboardingProblem, MessageKey> = {
  offline: "onboarding.advance.offline",
  error: "onboarding.advance.error",
  "not-signed-in": "onboarding.advance.notSignedIn",
};

type ProfileReady = Extract<ProfileState, { kind: "ready" }>;

interface NextSpec {
  label: MessageKey;
  onClick(): void;
  primary?: boolean;
  disabled?: boolean;
}

/** What a screen shows: its body, the Next button when it has one, and whether the Resident may skip it. */
interface StepView {
  body: ReactNode;
  next?: NextSpec;
  skippable?: boolean;
}

/**
 * The walk a new User takes instead of the dashboard: five screens, the Home (not for a joiner), Baseline,
 * Restrictions, Preferences, then one that installs (iOS in a tab only) and asks for reminders. Each is a heading and its fields. It shares the session's one push hook (so the launch
 * re-subscribe runs once) and owns the one profile hook of the flow, so the profile lists are fetched once.
 */
export function Onboarding({ position, onPosition }: Props) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const setCreatedHome = useHomeCreated();
  const { push, steps, onHomeFinished } = useSession();
  const profile = useProfile();
  // The Home's recovered notice waits here until the walk ends.
  const pendingNotice = useRef<RecoveredNotice | null>(null);
  const moveTo = (next: OnboardingPosition) => {
    onPosition(next);
    if (next === "done") onHomeFinished(pendingNotice.current);
  };
  const walk = useWalk(position, steps, moveTo);
  const [baselineIncomplete, setBaselineIncomplete] = useState(false);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const arrived = useRef(false);
  const { current } = walk;
  // Each step replaces the last, so move the reader to the new heading (not on the very first render).
  useEffect(() => {
    if (arrived.current) headingRef.current?.focus();
    arrived.current = true;
    setBaselineIncomplete(false);
  }, [current]);

  if (current === "done") return null;

  const { step, total } = progress(steps, current);
  const saving = walk.advance.kind === "saving";
  const ready = profile.state.kind === "ready";

  const goNext = () => void walk.next();

  // The Home goes into the cache before the walk moves on: the launch reads cached "none" for it and for everything
  // under it, and the Shell would show that on mount (ADR 0016). The walk advances even if the cache update fails.
  // The notice waits for the end of the walk, so the start choice does not show mid-onboarding.
  async function finishHome(home: Home, notice: RecoveredNotice | null) {
    try {
      await setCreatedHome(home);
    } finally {
      pendingNotice.current = notice;
      // The server keeps progress that is further on than `home` (POST /home is monotonic): take its position, and
      // guess the next step only when it cannot be read.
      const result = await getOnboarding();
      const stored: OnboardingPosition = result.kind === "ok" ? result.step : "baseline";
      const after = effectiveStep(steps, stored);
      moveTo(stored);
      // Same tick as the position, like the walk's Next: the guard must see both together.
      if (after !== "done") navigate(stepPath(after));
    }
  }

  function nextFromBaseline() {
    if (profile.state.kind !== "ready" || !allBaselineDaysSet(profile.state.profile.baseline)) {
      return setBaselineIncomplete(true);
    }
    setBaselineIncomplete(false);
    void walk.next();
  }

  // A step that edits the Profile: its status line, its fields once loaded, and Next held back until ready.
  function profileStep(
    fields: (loaded: ProfileReady) => ReactNode,
    onNext: () => void = goNext,
    extra: ReactNode = null,
  ): StepView {
    return {
      body: (
        <>
          {profile.state.kind === "loading" && <p role="status">{t("profile.loading")}</p>}
          <ProfileStatus state={profile.state} retry={profile.retry} />
          {profile.state.kind === "ready" && fields(profile.state)}
          {extra}
        </>
      ),
      next: { label: "onboarding.next", primary: true, disabled: !ready, onClick: onNext },
    };
  }

  // Install and reminders are one screen, so the one PUT {"step":"reminders"} moves past both.
  function finishStep(): StepView {
    const { availability, reminders } = push;
    if (availability.kind === "unsupported") {
      return {
        body: <p>{t("onboarding.reminders.unsupported")}</p>,
        next: { label: "onboarding.reminders.continue", primary: true, onClick: goNext },
        skippable: true,
      };
    }
    if (availability.kind === "needs-install") {
      return {
        body: (
          <>
            <InstallSteps showHeading={false} />
            <p>{t("onboarding.reminders.needsInstall")}</p>
          </>
        ),
        next: { label: "onboarding.reminders.notNow", onClick: goNext },
        skippable: true,
      };
    }
    const on = reminders.kind === "on";
    return {
      // Permission is asked only from the enable tap, never on mount.
      body: (
        <>
          <Intro text={t("onboarding.reminders.intro")} />
          {on ? <p role="status">{t("reminders.on")}</p> : <EnableReminders reminders={reminders} onEnable={push.enable} />}
        </>
      ),
      next: { label: on ? "onboarding.reminders.continue" : "onboarding.reminders.notNow", primary: on, onClick: goNext },
      skippable: true,
    };
  }

  const views: Record<OnboardingScreen, () => StepView> = {
    finish: finishStep,

    baseline: () =>
      profileStep(
        (loaded) => (
          <>
            <Intro text={t("onboarding.baseline.intro")} />
            <BaselineFields baseline={loaded.profile.baseline} onSave={profile.setBaseline} />
          </>
        ),
        nextFromBaseline,
        baselineIncomplete && <p role="alert">{t("onboarding.baseline.incomplete")}</p>,
      ),

    restrictions: () =>
      profileStep((loaded) => (
        <RestrictionFields
          restrictions={loaded.profile.restrictions}
          demands={loaded.demands}
          onChange={profile.setRestricted}
        />
      )),

    preferences: () => ({
      ...profileStep((loaded) => (
        <PreferenceFields profile={loaded.profile} categories={loaded.categories} onChange={profile.setPreference} />
      )),
      skippable: true,
    }),

    // POST /home completes this step on the server, so there is no Next here.
    home: () => ({
      body: (
        <CreateHome
          showHeading={false}
          onSaved={(home) => void finishHome(home, null)}
          onRecovered={(home, choresDropped) => void finishHome(home, choresDropped ? "chores-dropped" : "plain")}
        />
      ),
    }),
  };

  const { body, next, skippable } = views[current]();

  const failed = walk.advance.kind === "failed" ? walk.advance : null;

  return (
    <OnboardingLayout
      step={step}
      total={total}
      heading={t(HEADING_KEY[current])}
      headingRef={headingRef}
      onBack={walk.canGoBack ? walk.back : undefined}
      onSkip={skippable ? goNext : undefined}
      disabled={saving}
      failure={
        failed
          ? {
              message: t(ADVANCE_FAILED_KEY[failed.problem]),
              onRetry: next?.onClick ?? goNext,
            }
          : undefined
      }
      actions={next && <NextButton {...next} saving={saving} />}
    >
      {body}
    </OnboardingLayout>
  );
}

/** A line under the heading saying what the step is for. */
function Intro({ text }: { text: string }) {
  return <p className="mt-0 mb-4 text-muted">{text}</p>;
}

function NextButton({
  label,
  saving,
  onClick,
  primary = false,
  disabled = false,
}: NextSpec & { saving: boolean }) {
  const { t } = useI18n();
  return (
    <Button
      variant={primary ? "primary" : "secondary"}
      size="lg"
      className="w-full"
      disabled={disabled}
      loading={saving}
      onClick={onClick}
    >
      {t(label)}
    </Button>
  );
}
