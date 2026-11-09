import { Check, X } from "lucide-react";
import { useI18n, type MessageKey } from "../../../shared/i18n";
import { AppDialog } from "../../../shared/ui/AppDialog";
import { Button } from "../../../shared/ui/Button";
import { RADIO_CARD } from "../../../shared/ui/radioCard";
import type { VoiceAction } from "../api/api";
import type { Voice, VoiceMessage, VoiceState } from "../hooks/useVoice";
import { canConfirm, FEW_LEFT } from "../logic/candidates";
import { failureKey } from "../logic/failure";
import { actionLabel } from "../logic/label";

const STATUS: Partial<Record<VoiceState["kind"], MessageKey>> = {
  listening: "voice.listening",
  working: "voice.working",
  applying: "voice.applying",
  review: "voice.review",
};
const MESSAGE: Record<VoiceMessage, MessageKey> = {
  nothing: "voice.nothing",
  split: "voice.split",
  unavailable: "voice.unavailable",
  error: "voice.error",
  failed: "voice.failed",
  limit: "voice.limit",
  device: "voice.device",
  permission: "voice.permission",
};
// Speaking again cannot fix these: voice is off, used up, missing on this device, or retried with the same words.
const NO_AGAIN: VoiceMessage[] = ["unavailable", "limit", "device", "failed"];

/** The voice panel: what is heard, the understood actions to confirm or remove, and what each result was. */
export function VoicePanel({ voice }: { voice: Voice }) {
  const { t, locale } = useI18n();
  const { state } = voice;
  const label = (action: VoiceAction) => actionLabel(action, t, locale);
  const statusKey = state.kind === "message" ? MESSAGE[state.message] : STATUS[state.kind];
  const review = state.kind === "review" ? state : null;
  const waitingForPick = review?.actions.some((a) => a.kind === "choice") ?? false;
  const canSend = review ? canConfirm(review.actions) : false;

  return (
    <AppDialog
      onDismiss={voice.close}
      title={t("voice.mic")}
      footer={
        <>
          {state.kind === "message" && state.message === "failed" && <Button onClick={voice.retry}>{t("voice.retry")}</Button>}
          {state.kind === "message" && !NO_AGAIN.includes(state.message) && <Button onClick={voice.open}>{t("voice.again")}</Button>}
          {review && (
            <Button onClick={() => void voice.confirm()} disabled={!canSend} aria-describedby="voice-confirm-reason">
              {t("voice.confirm")}
            </Button>
          )}
          <Button variant="secondary" onClick={voice.close}>
            {t("voice.close")}
          </Button>
        </>
      }
    >
      {/* Polite, always in the page, so a change of state is read out without moving focus. */}
      <p role="status" aria-live="polite" className="mt-2">
        {statusKey && t(statusKey)}
        {review && review.actions.length === 0 && t("voice.empty")}
      </p>
      {review && (
        <>
          {/* The reason Confirm is off, in text and tied to the button. */}
          <p id="voice-confirm-reason" className="mt-2 font-semibold">
            {waitingForPick && t("voice.pickFirst")}
          </p>
          {review.remaining <= FEW_LEFT && <p className="mt-2">{t("voice.left", { count: review.remaining })}</p>}
          <ul className="mt-4 flex flex-col gap-3">
            {review.actions.map((action, index) => (
              <li key={index} className="flex items-center justify-between gap-3 rounded-card border border-border p-3">
                {action.kind === "choice" ? (
                  <fieldset className="min-w-0 flex-1">
                    <legend className="mb-2 font-semibold">{t("voice.action.choice")}</legend>
                    <div className="flex flex-col gap-2">
                      {action.candidates.map((candidate, c) => (
                        // Buttons, not radios: an arrow key in a radio group would pick, and a pick cannot be switched.
                        <button key={c} type="button" className={`${RADIO_CARD} w-full text-left`} onClick={() => voice.choose(index, c)}>
                          <span className="min-w-0 [overflow-wrap:anywhere]">{label(candidate)}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                ) : (
                  <span className="min-w-0 [overflow-wrap:anywhere]">{label(action)}</span>
                )}
                <Button variant="secondary" aria-label={t("voice.remove", { action: label(action) })} onClick={() => voice.remove(index)}>
                  <X aria-hidden="true" size={20} />
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      {state.kind === "results" && (
        <ul className="mt-4 flex flex-col gap-3">
          {state.actions.map((action, index) => {
            const result = state.results[index];
            const failed = result?.kind === "failed" ? result : null;
            return (
              <li key={index} className="flex items-start gap-3 rounded-card border border-border p-3">
                {failed ? <X aria-hidden="true" size={20} className="mt-0.5 shrink-0" /> : <Check aria-hidden="true" size={20} className="mt-0.5 shrink-0" />}
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {label(action)}
                  <span className="block font-semibold">{t(failed ? "voice.result.failed" : "voice.result.ok")}</span>
                  {failed && <span className="block">{t(failureKey(action, failed.reason))}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </AppDialog>
  );
}
