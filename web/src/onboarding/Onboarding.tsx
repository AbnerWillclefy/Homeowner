import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { OnboardingPosition, OnboardingStep } from "../api/onboarding";
import { CreateHome } from "../home/CreateHome";
import type { RecoveredNotice } from "../home/HomeSection";
import { useI18n, type MessageKey } from "../i18n";
import { BaselineFields, PreferenceFields, ProfileStatus, RestrictionFields } from "../profile/ProfileSections";
import { useProfile } from "../profile/useProfile";
import { EnableReminders } from "../push/EnableReminders";
import { InstallSteps } from "../push/InstallSteps";
import { usePush } from "../push/usePush";
import { allBaselineDaysSet } from "./baselineComplete";
import { progress, stepsFor } from "./steps";
import type { OnboardingProblem } from "./useOnboarding";
import { useWalk } from "./useWalk";

interface Props {
  /** The step the server says to show. */
  position: OnboardingPosition;
  onPosition(position: OnboardingPosition): void;
  /** The Home exists now, made here or found already made in another tab. */
  onHomeFinished(recovered: RecoveredNotice | null): void;
}

const HEADING_KEY: Record<OnboardingStep, MessageKey> = {
  install: "onboarding.install.heading",
  reminders: "onboarding.reminders.heading",
  baseline: "onboarding.baseline.heading",
  restrictions: "onboarding.restrictions.heading",
  preferences: "onboarding.preferences.heading",
  home: "onboarding.home.heading",
};

const WHY_KEY: Record<OnboardingStep, MessageKey> = {
  install: "onboarding.install.why",
  reminders: "onboarding.reminders.why",
  baseline: "onboarding.baseline.why",
  restrictions: "onboarding.restrictions.why",
  preferences: "onboarding.preferences.why",
  home: "onboarding.home.why",
};

const ADVANCE_FAILED_KEY: Record<OnboardingProblem, MessageKey> = {
  offline: "onboarding.advance.offline",
  error: "onboarding.advance.error",
  "not-signed-in": "onboarding.advance.notSignedIn",
};

/**
 * The walk a new User takes instead of the dashboard: install, reminders, Baseline, Restrictions,
 * Preferences, then the Home. Each step says why it matters. It owns the one push hook and the one profile
 * hook of the flow, so the launch re-subscribe runs once and the profile lists are fetched once.
 */
export function Onboarding({ position, onPosition, onHomeFinished }: Props) {
  const { t } = useI18n();
  const push = usePush();
  const profile = useProfile();
  const steps = useMemo(() => stepsFor(push.availability), [push.availability]);
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

  function nextFromBaseline() {
    if (profile.state.kind !== "ready" || !allBaselineDaysSet(profile.state.profile.baseline)) {
      return setBaselineIncomplete(true);
    }
    setBaselineIncomplete(false);
    void walk.next();
  }

  let body: ReactNode;
  let nextButton: ReactNode = null;

  switch (current) {
    case "install":
      body = <InstallSteps showHeading={false} />;
      nextButton = <NextButton label="onboarding.install.done" saving={saving} onClick={() => void walk.next()} />;
      break;

    case "reminders":
      if (push.availability.kind === "unsupported") {
        body = <p>{t("onboarding.reminders.unsupported")}</p>;
        nextButton = <NextButton label="onboarding.reminders.continue" saving={saving} onClick={() => void walk.next()} primary />;
      } else if (push.availability.kind === "needs-install") {
        body = <p>{t("onboarding.reminders.needsInstall")}</p>;
        nextButton = <NextButton label="onboarding.reminders.notNow" saving={saving} onClick={() => void walk.next()} />;
      } else if (push.reminders.kind === "on") {
        body = <p role="status">{t("reminders.on")}</p>;
        nextButton = <NextButton label="onboarding.reminders.continue" saving={saving} onClick={() => void walk.next()} primary />;
      } else {
        // Permission is asked only from this tap, never on mount.
        body = <EnableReminders reminders={push.reminders} onEnable={push.enable} />;
        nextButton = <NextButton label="onboarding.reminders.notNow" saving={saving} onClick={() => void walk.next()} />;
      }
      break;

    case "baseline":
      body = (
        <>
          <ProfileStatus state={profile.state} save={profile.save} retry={profile.retry} />
          {profile.state.kind === "ready" && (
            <BaselineFields baseline={profile.state.profile.baseline} onSave={profile.setBaseline} />
          )}
          {baselineIncomplete && <p role="alert">{t("onboarding.baseline.incomplete")}</p>}
        </>
      );
      nextButton = <NextButton label="onboarding.next" saving={saving} disabled={!ready} onClick={nextFromBaseline} primary />;
      break;

    case "restrictions":
      body = (
        <>
          <ProfileStatus state={profile.state} save={profile.save} retry={profile.retry} />
          {profile.state.kind === "ready" && (
            <RestrictionFields
              restrictions={profile.state.profile.restrictions}
              demands={profile.state.demands}
              onChange={profile.setRestricted}
            />
          )}
        </>
      );
      nextButton = <NextButton label="onboarding.next" saving={saving} disabled={!ready} onClick={() => void walk.next()} primary />;
      break;

    case "preferences":
      body = (
        <>
          <ProfileStatus state={profile.state} save={profile.save} retry={profile.retry} />
          {profile.state.kind === "ready" && (
            <PreferenceFields
              profile={profile.state.profile}
              categories={profile.state.categories}
              onChange={profile.setPreference}
            />
          )}
        </>
      );
      nextButton = <NextButton label="onboarding.next" saving={saving} disabled={!ready} onClick={() => void walk.next()} primary />;
      break;

    case "home":
      // POST /home completes this step on the server, so there is no Next here.
      body = (
        <CreateHome
          onSaved={() => {
            onPosition("done");
            onHomeFinished(null);
          }}
          onRecovered={(_home, choresDropped) => {
            onPosition("done");
            onHomeFinished(choresDropped ? "chores-dropped" : "plain");
          }}
        />
      );
      break;
  }

  return (
    <section aria-labelledby="onboarding-heading">
      <p className="text-muted">{t("onboarding.progress", { step, total })}</p>
      <h2 id="onboarding-heading" ref={headingRef} tabIndex={-1}>
        {t(HEADING_KEY[current])}
      </h2>
      <p>{t(WHY_KEY[current])}</p>

      {body}

      {walk.advance.kind === "failed" && <p role="alert">{t(ADVANCE_FAILED_KEY[walk.advance.problem])}</p>}

      {walk.canGoBack && (
        <button type="button" className="btn" disabled={saving} onClick={walk.back}>
          {t("onboarding.back")}
        </button>
      )}
      {nextButton}
    </section>
  );
}

function NextButton({
  label,
  saving,
  onClick,
  primary = false,
  disabled = false,
}: {
  label: MessageKey;
  saving: boolean;
  onClick(): void;
  primary?: boolean;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <button type="button" className={primary ? "btn btn-primary" : "btn"} disabled={saving || disabled} onClick={onClick}>
      {saving ? t("onboarding.saving") : t(label)}
    </button>
  );
}
