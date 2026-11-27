import { Check, CircleCheck, CircleX, Mic, Pencil, Plus, X, type LucideIcon } from "lucide-react";
import { Button, List, Sheet } from "@homeowner/bedrock";
import { useI18n, type MessageKey } from "../../../shared/i18n";
import { RADIO_CARD } from "../../../shared/ui/radioCard";
import type { VoiceAction } from "../api/api";
import type { Voice, VoiceMessage, VoiceState } from "../hooks/useVoice";
import { canConfirm } from "../logic/candidates";
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

// What each proposal does, as the icon in its row's tile; the words beside it always say the same.
const ICONS: Record<Exclude<VoiceAction["kind"], "choice">, LucideIcon> = {
  create_chore: Plus,
  edit_chore: Pencil,
  accept: CircleCheck,
  take: CircleCheck,
  complete: CircleCheck,
  refuse: CircleX,
};
const TILE = "grid size-10 shrink-0 place-items-center rounded-md";
const ROW = "flex min-h-16 items-center gap-4 px-4 py-2";

/**
 * The voice Sheet: what is heard, the understood actions to confirm or remove, and what each result was. It always
 * says how many commands are left today once it knows (the read on open, then each answer); a failed read says
 * nothing rather than "0". Only the frame and layout are here: the states and messages come from `useVoice`.
 */
export function VoicePanel({ voice }: { voice: Voice }) {
  const { t, locale } = useI18n();
  const { state, remaining } = voice;
  const label = (action: VoiceAction) => actionLabel(action, t, locale);
  const statusKey = state.kind === "message" ? MESSAGE[state.message] : STATUS[state.kind];
  const review = state.kind === "review" ? state : null;
  const waitingForPick = review?.actions.some((a) => a.kind === "choice") ?? false;
  const canSend = review ? canConfirm(review.actions) : false;

  const footer = review ? (
    <>
      <Button size="lg" onClick={() => void voice.confirm()} disabled={!canSend} aria-describedby="voice-confirm-reason">
        {t("voice.confirm", { count: review.actions.length })}
      </Button>
      <Button size="lg" variant="ghost" icon={Mic} onClick={voice.open}>
        {t("voice.again")}
      </Button>
    </>
  ) : state.kind === "message" ? (
    <>
      {state.message === "failed" && (
        <Button size="lg" onClick={voice.retry}>
          {t("voice.retry")}
        </Button>
      )}
      {!NO_AGAIN.includes(state.message) && (
        <Button size="lg" icon={Mic} onClick={voice.open}>
          {t("voice.again")}
        </Button>
      )}
    </>
  ) : state.kind === "results" ? (
    <Button size="lg" variant="secondary" onClick={voice.close}>
      {t("voice.close")}
    </Button>
  ) : undefined;

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && voice.close()}
      title={t("voice.mic")}
      subtitle={remaining === null ? undefined : t("voice.left", { count: remaining })}
      closeLabel={t("voice.close")}
      dismissible={state.kind !== "applying"}
      footer={footer}
    >
      <div className="flex flex-col gap-4 pb-4">
        {state.kind === "listening" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <button
              type="button"
              onClick={voice.stop}
              aria-label={t("voice.stop")}
              className="grid size-18 cursor-pointer place-items-center rounded-full border border-transparent bg-brand text-on-brand outline-none hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <Mic aria-hidden="true" className="size-8" />
            </button>
          </div>
        )}
        {/* Polite, always in the page, so a change of state is read out without moving focus. */}
        <p role="status" aria-live="polite" className="body my-0 text-center">
          {statusKey && t(statusKey)}
          {review && review.actions.length === 0 && t("voice.empty")}
        </p>
        {state.kind === "listening" && <p className="body my-0 text-center text-text-muted">{t("voice.example")}</p>}
        {review && (
          <>
            {/* The reason Confirm is off, in text and tied to the button. */}
            <p id="voice-confirm-reason" className="body-strong my-0 empty:hidden">
              {waitingForPick && t("voice.pickFirst")}
            </p>
            <List>
              {review.actions.map((action, index) => (
                <li key={index} className={ROW}>
                  {action.kind === "choice" ? (
                    <fieldset className="m-0 min-w-0 flex-1 border-0 p-0">
                      <legend className="body-strong mb-2 p-0">{t("voice.action.choice")}</legend>
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
                    <>
                      <ActionTile kind={action.kind} />
                      <span className="body-strong min-w-0 flex-1 [overflow-wrap:anywhere]">{label(action)}</span>
                    </>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => voice.remove(index)}>
                    <X className="size-4" aria-hidden />
                    <span className="sr-only">{t("voice.remove", { action: label(action) })}</span>
                  </Button>
                </li>
              ))}
            </List>
          </>
        )}
        {state.kind === "results" && (
          <List>
            {state.actions.map((action, index) => {
              const result = state.results[index];
              const failed = result?.kind === "failed" ? result : null;
              return (
                <li key={index} className={ROW}>
                  <span className={`${TILE} ${failed ? "bg-surface-hover text-text-muted" : "bg-brand-soft text-brand"}`}>
                    {failed ? <X aria-hidden="true" className="size-4" /> : <Check aria-hidden="true" className="size-4" />}
                  </span>
                  <span className="body-strong min-w-0 [overflow-wrap:anywhere]">
                    {label(action)}
                    <span className="caption block text-text-muted">{t(failed ? "voice.result.failed" : "voice.result.ok")}</span>
                    {failed && <span className="caption block text-text-muted">{t(failureKey(action, failed.reason))}</span>}
                  </span>
                </li>
              );
            })}
          </List>
        )}
      </div>
    </Sheet>
  );
}

function ActionTile({ kind }: { kind: Exclude<VoiceAction["kind"], "choice"> }) {
  const Icon = ICONS[kind];
  return (
    <span aria-hidden className={`${TILE} ${kind === "refuse" ? "bg-surface-hover text-text-muted" : "bg-brand-soft text-brand"}`}>
      <Icon className="size-5" />
    </span>
  );
}
