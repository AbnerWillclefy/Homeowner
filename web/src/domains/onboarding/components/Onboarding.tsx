import { useEffect, useRef, useState, type ReactNode } from "react";
import type { OnboardingPosition, OnboardingStep } from "../api/api";
import { useSession } from "../../../app/components/SessionProvider";
import { CreateHome } from "../../home/components/CreateHome";
import { useI18n, type MessageKey } from "../../../shared/i18n";
import { BaselineFields, PreferenceFields, ProfileStatus, RestrictionFields } from "../../profile/components/ProfileSections";
import { useProfile, type ProfileState } from "../../profile/hooks/useProfile";
import { EnableReminders } from "../../push/components/EnableReminders";
import { InstallSteps } from "../../push/components/InstallSteps";
import { Button } from "../../../shared/ui/Button";
import { allBaselineDaysSet } from "../logic/baselineComplete";
import { OnboardingLayout } from "./OnboardingLayout";
import { progress } from "../logic/steps";
import type { OnboardingProblem } from "../logic/onboardingState";
import { useWalk } from "../hooks/useWalk";

interface Props {
  /** The step the server says to show. */
  position: OnboardingPosition;
  onPosition(position: OnboardingPosition): void;
}

const HEADING_KEY: Record<OnboardingStep, MessageKey> = {
  install: "onboarding.install.heading",
  reminders: "onboarding.reminders.heading",
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

/** What a step shows: its body, and the Next button when it has one. */
interface StepView {
  body: ReactNode;
  next?: NextSpec;
}

/**
 * The walk a new User takes instead of the dashboard: install, reminders, Baseline, Restrictions,
 * Preferences, then the Home. Each step is a short heading and its fields. It shares the session's one push hook (so the launch
 * re-subscribe runs once) and owns the one profile hook of the flow, so the profile lists are fetched once.
 */
export function Onboarding({ position, onPosition }: Props) {
  const { t } = useI18n();
  const { push, steps, onHomeFinished } = useSession();
  const profile = useProfile();
  const walk = useWalk(position, steps, onPosition);
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

  function remindersStep(): StepView {
    const { availability, reminders } = push;
    if (availability.kind === "unsupported") {
      return {
        body: <p>{t("onboarding.reminders.unsupported")}</p>,
        next: { label: "onboarding.reminders.continue", primary: true, onClick: goNext },
      };
    }
    if (availability.kind === "needs-install") {
      return {
        body: <p>{t("onboarding.reminders.needsInstall")}</p>,
        next: { label: "onboarding.reminders.notNow", onClick: goNext },
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
    };
  }

  const views: Record<OnboardingStep, () => StepView> = {
    install: () => ({
      body: <InstallSteps showHeading={false} />,
      next: { label: "onboarding.install.done", onClick: goNext },
    }),

    reminders: remindersStep,

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

    preferences: () =>
      profileStep((loaded) => (
        <PreferenceFields profile={loaded.profile} categories={loaded.categories} onChange={profile.setPreference} />
      )),

    // POST /home completes this step on the server, so there is no Next here.
    home: () => ({
      body: (
        <CreateHome
          showHeading={false}
          onSaved={() => {
            onPosition("done");
            onHomeFinished(null);
          }}
          onRecovered={(_home, choresDropped) => {
            onPosition("done");
            onHomeFinished(choresDropped ? "chores-dropped" : "plain");
          }}
        />
      ),
    }),
  };

  const { body, next } = views[current]();

  const failed = walk.advance.kind === "failed" ? walk.advance : null;

  return (
    <OnboardingLayout
      step={step}
      total={total}
      heading={t(HEADING_KEY[current])}
      headingRef={headingRef}
      onBack={walk.canGoBack ? walk.back : undefined}
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
      fullWidth
      disabled={disabled}
      pending={saving}
      onClick={onClick}
    >
      {t(label)}
    </Button>
  );
}
