import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useI18n } from "../../../shared/i18n";
import { choresKey } from "../../chores/api/queries";
import { dayPlanKey } from "../../dayplan/api/queries";
import { residentsKey } from "../../residents/api/queries";
import { streakKey } from "../../streak/api/queries";
import { interpret, type VoiceAction } from "../api/api";
import { applyInOrder, type SendResult } from "../logic/apply";
import { sendAction } from "../logic/send";
import { listenOnce, recognitionCtor } from "../logic/speech";

/** What the server accepts; a longer transcript is never sent. */
export const MAX_TRANSCRIPT = 500;

export type VoiceMessage = "nothing" | "split" | "unavailable";

export type VoiceState =
  | { kind: "idle" }
  | { kind: "listening" }
  | { kind: "working" }
  | { kind: "review"; actions: VoiceAction[] }
  | { kind: "applying"; actions: VoiceAction[] }
  | { kind: "results"; actions: VoiceAction[]; results: SendResult[] }
  | { kind: "message"; message: VoiceMessage };

/** The voice panel's state machine: listen once, interpret, review, apply one by one. */
export function useVoice() {
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const [state, setState] = useState<VoiceState>({ kind: "idle" });
  const [isOpen, setOpen] = useState(false);
  const listening = useRef<AbortController | null>(null);

  const interpretation = useMutation({ mutationFn: (text: string) => interpret(text, locale) });
  const apply = useMutation({
    mutationFn: (actions: VoiceAction[]) => applyInOrder(actions, sendAction),
    // Settled, not success: a half-applied queue still changed the screens, and a closed panel still invalidates.
    onSettled: () =>
      Promise.all([choresKey, dayPlanKey, streakKey, residentsKey].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });

  /** Must be called straight from the tap: Safari only lets `start()` run inside the gesture. */
  function open() {
    const ctor = recognitionCtor(window);
    if (!ctor) return;
    listening.current?.abort();
    const run = new AbortController();
    listening.current = run;
    setOpen(true);
    setState({ kind: "listening" });
    void interpretSpeech(listenOnce(ctor, locale, run.signal), run.signal);
  }

  async function interpretSpeech(heard: ReturnType<typeof listenOnce>, signal: AbortSignal) {
    const speech = await heard;
    if (signal.aborted) return;
    if (speech.kind === "error" && speech.code !== "no-speech") return setState({ kind: "message", message: "unavailable" });
    const text = speech.kind === "transcript" ? speech.text.trim() : "";
    // Nothing heard or too long: no call, so no voice call is spent.
    if (!text || [...text].length > MAX_TRANSCRIPT) return setState({ kind: "message", message: "nothing" });
    setState({ kind: "working" });
    const result = await interpretation.mutateAsync(text);
    if (signal.aborted) return;
    if (result.kind !== "ok") return setState({ kind: "message", message: "unavailable" });
    const { status, actions } = result.interpretation;
    if (status === "too_many") return setState({ kind: "message", message: "split" });
    setState(status === "ok" && actions.length > 0 ? { kind: "review", actions } : { kind: "message", message: "nothing" });
  }

  function close() {
    listening.current?.abort();
    setOpen(false);
  }

  function remove(index: number) {
    setState((s) => (s.kind === "review" ? { kind: "review", actions: s.actions.filter((_, i) => i !== index) } : s));
  }

  /** Applies what is left; an action that needs a choice is never sent. */
  async function confirm() {
    if (state.kind !== "review") return;
    const actions = state.actions.filter((a) => a.kind !== "choice");
    if (actions.length === 0) return;
    const run = listening.current;
    setState({ kind: "applying", actions });
    const results = await apply.mutateAsync(actions);
    // The panel was closed meanwhile; onSettled has already refreshed the caches.
    if (run?.signal.aborted) return;
    setState({ kind: "results", actions, results });
  }

  return { state, isOpen, open, close, remove, confirm };
}

export type Voice = ReturnType<typeof useVoice>;
