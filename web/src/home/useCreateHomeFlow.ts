import { useMemo, useState } from "react";
import { proposeChores } from "../api/catalog";
import type { FailureReason, FieldCodes, Home, HomeSettings } from "../api/home";
import { initialAnswers, toRequestBody, type AnswersState } from "../catalog/answers";
import {
  afterQuestions,
  errorsStillApply,
  itemsFromProposals,
  type ReviewItem,
  type Reviewed,
} from "../catalog/review";
import { useI18n } from "../i18n";
import { useStableHandlers } from "../components/ui/useStableHandlers";
import { useSubmitOnce } from "../components/ui/useSubmitOnce";
import { createHomeSubmitter } from "./createHomeSubmit";
import { createOrLoad } from "./createOrLoad";

export type Step = "settings" | "questions" | "review";

/** What the questionnaire step is doing. A failure keeps the typed answers. */
export type SuggestStatus =
  | { kind: "idle" }
  | { kind: "working" }
  /** Changed answers would discard edits; waiting for the Resident to say so. */
  | { kind: "confirming" }
  | { kind: "invalid"; fields: FieldCodes }
  | { kind: "failed"; reason: FailureReason };

import type { CreateStatus } from "./createHomeSubmit";

export type { CreateStatus };

interface Handlers {
  onSaved(home: Home): void;
  /** The person already had a Home. `choresDropped` is true when reviewed Chores were not added to it. */
  onRecovered(home: Home, choresDropped: boolean): void;
}

/**
 * The state of creating a Home in steps: settings, questionnaire, review, then one save. The typed values
 * live here and are never reset by a failure, so a retry sends exactly what was typed. Nothing is saved
 * until the final step; proposals are advice.
 */
export function useCreateHomeFlow(initial: HomeSettings, { onSaved, onRecovered }: Handlers) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>("settings");
  const [settings, setSettings] = useState<HomeSettings>(initial);
  const [settingsErrors, setSettingsErrors] = useState<FieldCodes>({});
  const [answers, setAnswersState] = useState<AnswersState>(initialAnswers);
  const [suggest, setSuggest] = useState<SuggestStatus>({ kind: "idle" });
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [reviewed, setReviewed] = useState<Reviewed | null>(null);
  const [itemErrors, setItemErrors] = useState<Record<number, FieldCodes>>({});
  const [tooMany, setTooMany] = useState(false);
  const [create, setCreate] = useState<CreateStatus>({ kind: "idle" });

  function changeSettings(field: keyof HomeSettings, value: string) {
    setSettings((current) => ({ ...current, [field]: value }));
    setSettingsErrors(({ [field]: _fixed, ...rest }) => rest);
  }

  function setAnswers(next: AnswersState) {
    setAnswersState(next);
    setSuggest((current) => (current.kind === "working" ? current : { kind: "idle" }));
  }

  // Guarded, so a double Enter on the questionnaire asks the Catalog once.
  const { run: propose } = useSubmitOnce(async (key: string) => {
    setSuggest({ kind: "working" });
    const result = await proposeChores(toRequestBody(answers));
    if (result.kind === "ok") {
      setItems(itemsFromProposals(result.proposals, t));
      setReviewed({ proposedFor: key, edited: false });
      setItemErrors({});
      setTooMany(false);
      setSuggest({ kind: "idle" });
      setStep("review");
    } else if (result.kind === "invalid") {
      setSuggest({ kind: "invalid", fields: result.fields });
    } else {
      setSuggest({ kind: "failed", reason: result.kind });
    }
  });

  /** Continue from the questionnaire: keep the reviewed list, ask before discarding edits, or propose. */
  function continueFromQuestions() {
    if (suggest.kind === "working") return;
    const key = JSON.stringify(toRequestBody(answers));
    const next = afterQuestions(key, reviewed);
    if (next === "review") setStep("review");
    else if (next === "confirm") setSuggest({ kind: "confirming" });
    else void propose(key);
  }

  function confirmRegenerate() {
    void propose(JSON.stringify(toRequestBody(answers)));
  }

  function cancelRegenerate() {
    setSuggest({ kind: "idle" });
  }

  /** Go on without suggestions: the Home is created with no Chores, and they can be added from the Catalog. */
  function skip() {
    setItems([]);
    setItemErrors({});
    setTooMany(false);
    setReviewed({ proposedFor: null, edited: false });
    setStep("review");
  }

  // Skipping would throw away a suggested list, so it is only offered before one exists.
  const canSkip = reviewed === null || reviewed.proposedFor === null;

  function changeItems(next: ReviewItem[]) {
    setItemErrors((errors) => errorsStillApply(errors, items, next));
    setItems(next);
    setReviewed((current) => (current ? { ...current, edited: true } : current));
  }

  // The guard lives in the submitter, so a second tap in the same tick is ignored, not only a disabled button.
  const stable = useStableHandlers({ getSettings: () => settings, getItems: () => items, onSaved, onRecovered });
  const submitter = useMemo(
    () =>
      createHomeSubmitter({
        create: (home, chores) => createOrLoad(home, undefined, chores),
        getSettings: stable.getSettings,
        getItems: stable.getItems,
        onStatus: setCreate,
        onInvalid: (split) => {
          setSettingsErrors(split.settings);
          setItemErrors(split.byItem);
          setTooMany(split.tooMany);
          // The Home's own fields are on the first step; everything else is on this one.
          if (Object.keys(split.settings).length > 0) setStep("settings");
        },
        onSaved: stable.onSaved,
        onRecovered: stable.onRecovered,
      }),
    [stable],
  );
  const submit = () => submitter();

  const hasItemErrors = tooMany || Object.keys(itemErrors).length > 0;

  return {
    step,
    setStep,
    settings,
    settingsErrors,
    changeSettings,
    answers,
    setAnswers,
    suggest,
    continueFromQuestions,
    confirmRegenerate,
    cancelRegenerate,
    skip,
    canSkip,
    items,
    itemErrors,
    tooMany,
    hasItemErrors,
    changeItems,
    create,
    submit,
  };
}
