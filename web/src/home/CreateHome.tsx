import { useEffect, useMemo, useRef, type FormEvent } from "react";
import type { Home } from "./api";
import { Questionnaire } from "../catalog/Questionnaire";
import { ReviewList } from "../catalog/ReviewList";
import { ButtonRow } from "../shared/ui/ButtonRow";
import { useI18n, type MessageKey } from "../i18n";
import { Button } from "../shared/ui/Button";
import { DEFAULT_ALLOCATION_TIME } from "./allocationTimes";
import { browserTimezone, browserTimezones } from "./browserTimezones";
import { SAVE_FAILURE_KEY } from "./failureMessages";
import { HomeFields } from "./HomeFields";
import { defaultTimezone, timezoneOptions } from "./timezones";
import { useCreateHomeFlow, type Step } from "./useCreateHomeFlow";

interface Props {
  onSaved(home: Home): void;
  /** The person already had a Home, and it was loaded instead of a new one made. */
  onRecovered(home: Home, choresDropped: boolean): void;
}

const STEPS: readonly Step[] = ["settings", "questions", "review"];

const SUGGEST_FAILURE_KEY = {
  offline: "catalog.questions.offline",
  error: "catalog.questions.error",
  "not-signed-in": "home.notSignedIn",
} as const satisfies Record<string, MessageKey>;

/**
 * For a signed-in User with no Home, in three steps: timezone and Allocation time,
 * the questions the Catalog turns into suggested Chores, and a review where those can be edited or removed.
 * Nothing is saved until the last step, which creates the Home and the reviewed Chores together.
 */
export function CreateHome({ onSaved, onRecovered }: Props) {
  const { t } = useI18n();
  const zones = useMemo(() => browserTimezones(), []);
  const options = useMemo(() => timezoneOptions(zones), [zones]);
  const initial = useMemo(
    () => ({
      timezone: defaultTimezone(zones, browserTimezone()),
      allocationTime: DEFAULT_ALLOCATION_TIME,
    }),
    [zones],
  );
  const flow = useCreateHomeFlow(initial, { onSaved, onRecovered });
  const { step } = flow;
  const stepRef = useRef<HTMLParagraphElement>(null);
  const arrived = useRef(false);

  // Each step replaces the last, so move the reader to the new one (not on the very first render).
  useEffect(() => {
    if (arrived.current) stepRef.current?.focus();
    arrived.current = true;
  }, [step]);

  const stepLine = (
    <p ref={stepRef} tabIndex={-1} className="text-muted">
      {t("home.create.step", {
        step: STEPS.indexOf(step) + 1,
        total: STEPS.length,
      })}
    </p>
  );

  if (step === "settings") {
    const onSubmit = (event: FormEvent) => {
      event.preventDefault();
      flow.setStep("questions");
    };
    return (
      <section aria-labelledby="create-home-heading">
        {stepLine}
        <h2 id="create-home-heading">{t("home.create.heading")}</h2>
        <form onSubmit={onSubmit} noValidate className="flex flex-col">
          <HomeFields
            idPrefix="create-home"
            values={flow.settings}
            timezones={options}
            fieldErrors={flow.settingsErrors}
            disabled={false}
            onChange={flow.changeSettings}
          />
          {Object.keys(flow.settingsErrors).length > 0 && (
            <p role="alert" className="text-danger">
              {t("home.invalid.summary")}
            </p>
          )}
          <Button type="submit" className="mt-6">
            {t("home.create.next")}
          </Button>
        </form>
      </section>
    );
  }

  if (step === "questions") {
    const working = flow.suggest.kind === "working";
    const onSubmit = (event: FormEvent) => {
      event.preventDefault();
      flow.continueFromQuestions();
    };
    return (
      <section aria-labelledby="create-questions-heading">
        {stepLine}
        <h2 id="create-questions-heading">{t("catalog.questions.heading")}</h2>
        <form onSubmit={onSubmit} noValidate>
          <Questionnaire
            idPrefix="create-questions"
            value={flow.answers}
            onChange={flow.setAnswers}
            errors={flow.suggest.kind === "invalid" ? flow.suggest.fields : {}}
            disabled={working}
          />

          {flow.suggest.kind === "invalid" && (
            <p role="alert" className="text-danger">
              {t("catalog.questions.invalid")}
            </p>
          )}
          {flow.suggest.kind === "failed" && (
            <p role="alert" className="text-danger">
              {t(SUGGEST_FAILURE_KEY[flow.suggest.reason])}
            </p>
          )}

          {flow.suggest.kind === "confirming" ? (
            <div role="group" aria-labelledby="create-regenerate-prompt">
              <p id="create-regenerate-prompt">
                {t("catalog.regenerate.prompt")}
              </p>
              <ButtonRow>
                <Button variant="secondary" onClick={flow.cancelRegenerate}>
                  {t("catalog.regenerate.cancel")}
                </Button>
                <Button onClick={flow.confirmRegenerate}>
                  {t("catalog.regenerate.confirm")}
                </Button>
              </ButtonRow>
            </div>
          ) : (
            <ButtonRow className="mt-2">
              <Button
                variant="secondary"
                disabled={working}
                onClick={() => flow.setStep("settings")}
              >
                {t("home.create.back")}
              </Button>
              <Button type="submit" disabled={working} aria-busy={working}>
                {t(
                  working
                    ? "catalog.questions.submitting"
                    : "catalog.questions.submit",
                )}
              </Button>
              {flow.canSkip && (
                <Button
                  variant="secondary"
                  disabled={working}
                  onClick={flow.skip}
                >
                  {t("catalog.questions.skip")}
                </Button>
              )}
            </ButtonRow>
          )}
        </form>
      </section>
    );
  }

  const saving = flow.create.kind === "saving";
  return (
    <>
      {stepLine}
      <ReviewList
        items={flow.items}
        errors={flow.itemErrors}
        tooMany={flow.tooMany}
        onChange={flow.changeItems}
        disabled={saving}
      />
      {flow.hasItemErrors && (
        <p role="alert" className="text-danger">
          {t("home.invalid.summary")}
        </p>
      )}
      {flow.create.kind === "failed" && (
        <p role="alert" className="text-danger">
          {t(SAVE_FAILURE_KEY[flow.create.reason])}
        </p>
      )}
      <ButtonRow className="mt-2">
        <Button
          variant="secondary"
          disabled={saving}
          onClick={() => flow.setStep("questions")}
        >
          {t("home.create.back")}
        </Button>
        <Button
          disabled={saving}
          aria-busy={saving}
          onClick={() => void flow.submit()}
        >
          {t(saving ? "home.create.submitting" : "home.create.submit")}
        </Button>
      </ButtonRow>
    </>
  );
}
