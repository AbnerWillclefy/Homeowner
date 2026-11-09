import { Check, X } from "lucide-react";
import { useI18n, type MessageKey } from "../../../shared/i18n";
import { AppDialog } from "../../../shared/ui/AppDialog";
import { Button } from "../../../shared/ui/Button";
import type { VoiceAction } from "../api/api";
import type { Voice, VoiceState } from "../hooks/useVoice";
import { actionLabel } from "../logic/label";

const STATUS: Partial<Record<VoiceState["kind"], MessageKey>> = {
  listening: "voice.listening",
  working: "voice.working",
  applying: "voice.applying",
  review: "voice.review",
};
const MESSAGE: Record<string, MessageKey> = { nothing: "voice.nothing", split: "voice.split", unavailable: "voice.unavailable" };

/** The voice panel: what is heard, the understood actions to confirm or remove, and what each result was. */
export function VoicePanel({ voice }: { voice: Voice }) {
  const { t, locale } = useI18n();
  const { state } = voice;
  const label = (action: VoiceAction) => actionLabel(action, t, locale);
  const statusKey = state.kind === "message" ? MESSAGE[state.message] : STATUS[state.kind];
  const sendable = state.kind === "review" ? state.actions.filter((a) => a.kind !== "choice").length : 0;

  return (
    <AppDialog
      onDismiss={voice.close}
      title={t("voice.mic")}
      footer={
        <>
          {state.kind === "message" && (
            <Button onClick={voice.open}>{t("voice.again")}</Button>
          )}
          {state.kind === "review" && (
            <Button onClick={() => void voice.confirm()} disabled={sendable === 0}>
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
        {state.kind === "review" && state.actions.length === 0 && t("voice.empty")}
      </p>
      {state.kind === "review" && (
        <ul className="mt-4 flex flex-col gap-3">
          {state.actions.map((action, index) => (
            <li key={index} className="flex items-center justify-between gap-3 rounded-card border border-border p-3">
              <span className="min-w-0 [overflow-wrap:anywhere]">{label(action)}</span>
              <Button variant="secondary" aria-label={t("voice.remove", { action: label(action) })} onClick={() => voice.remove(index)}>
                <X aria-hidden="true" size={20} />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {state.kind === "results" && (
        <ul className="mt-4 flex flex-col gap-3">
          {state.actions.map((action, index) => {
            const ok = state.results[index]?.kind === "ok";
            return (
              <li key={index} className="flex items-start gap-3 rounded-card border border-border p-3">
                {ok ? <Check aria-hidden="true" size={20} className="mt-0.5 shrink-0" /> : <X aria-hidden="true" size={20} className="mt-0.5 shrink-0" />}
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {label(action)}
                  <span className="block font-semibold">{t(ok ? "voice.result.ok" : "voice.result.failed")}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </AppDialog>
  );
}
