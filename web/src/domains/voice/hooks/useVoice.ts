import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useShell } from "../../../app/components/ShellContext";
import { useI18n } from "../../../shared/i18n";
import { choresKey } from "../../chores/api/queries";
import { dayPlanKey } from "../../dayplan/api/queries";
import { residentsKey } from "../../residents/api/queries";
import { streakKey } from "../../streak/api/queries";
import { interpret, type InterpretResult, type PlainAction, type VoiceAction } from "../api/api";
import { applyInOrder, type SendResult } from "../logic/apply";
import { canConfirm, pick } from "../logic/candidates";
import { speechError } from "../logic/errors";
import { sendAction } from "../logic/send";
import { listenOnce, recognitionCtor } from "../logic/speech";
import { hideMic } from "./useMicHidden";

/** What the server accepts; a longer transcript is never sent. */
export const MAX_TRANSCRIPT = 500;

/**
 * `unavailable` is voice off (503). `failed` is the AI failing or timing out, retried with the same words. `error` is
 * anything else worth a retry. `device` and `permission` come from the browser.
 */
export type VoiceMessage = "nothing" | "split" | "unavailable" | "error" | "failed" | "limit" | "device" | "permission";

export type VoiceState =
  | { kind: "idle" }
  | { kind: "listening" }
  | { kind: "working" }
  | { kind: "review"; actions: VoiceAction[]; remaining: number }
  | { kind: "applying"; actions: PlainAction[] }
  | { kind: "results"; actions: PlainAction[]; results: SendResult[] }
  | { kind: "message"; message: VoiceMessage };

/** What each way the interpret call can fail says. */
const FAILED = {
  limit: "limit",
  unavailable: "unavailable",
  failed: "failed",
  invalid: "error",
  offline: "error",
  error: "error",
  "not-signed-in": "error",
} as const satisfies Record<Exclude<InterpretResult["kind"], "ok">, VoiceMessage>;

/** The voice panel's state machine: listen once, interpret, review, apply one by one. */
export function useVoice() {
  const { locale } = useI18n();
  const { home } = useShell();
  const zone = home.state.kind === "ready" ? home.state.home.timezone : null;
  // The server counts the day in the Home's timezone; no Home yet means no gate, so the server decides.
  const today = () => (zone ? new Date().toLocaleDateString("en-CA", { timeZone: zone }) : null);
  const queryClient = useQueryClient();
  const [state, setState] = useState<VoiceState>({ kind: "idle" });
  const [isOpen, setOpen] = useState(false);
  const listening = useRef<AbortController | null>(null);
  // Memory only, and only for the Home's day it was reached: the server resets per day and is the authority.
  const limitDay = useRef<string | null>(null);
  const transcript = useRef("");

  const interpretation = useMutation({ mutationFn: (text: string) => interpret(text, locale) });
  const apply = useMutation({
    mutationFn: (actions: PlainAction[]) => applyInOrder(actions, sendAction),
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
    // The 20th command was used: say so without listening or calling the API.
    if (limitDay.current !== null && limitDay.current === today()) return setState({ kind: "message", message: "limit" });
    setState({ kind: "listening" });
    void interpretSpeech(listenOnce(ctor, locale, run.signal), run.signal);
  }

  async function interpretSpeech(heard: ReturnType<typeof listenOnce>, signal: AbortSignal) {
    const speech = await heard;
    if (signal.aborted) return;
    if (speech.kind === "error") return setState({ kind: "message", message: speechError(speech.code) });
    const text = speech.kind === "transcript" ? speech.text.trim() : "";
    // Nothing heard or too long: no call, so no voice call is spent.
    if (!text || [...text].length > MAX_TRANSCRIPT) return setState({ kind: "message", message: "nothing" });
    transcript.current = text;
    await interpretText(text, signal);
  }

  async function interpretText(text: string, signal: AbortSignal) {
    setState({ kind: "working" });
    const result = await interpretation.mutateAsync(text);
    if (signal.aborted) return;
    if (result.kind === "limit") limitDay.current = today();
    if (result.kind !== "ok") return setState({ kind: "message", message: FAILED[result.kind] });
    const { status, actions } = result.interpretation;
    limitDay.current = result.interpretation.remaining === 0 ? today() : null;
    if (status === "too_many") return setState({ kind: "message", message: "split" });
    setState(
      status === "ok" && actions.length > 0
        ? { kind: "review", actions, remaining: result.interpretation.remaining }
        : { kind: "message", message: "nothing" },
    );
  }

  /** Sends the same words again without listening. Nothing was applied, so it costs one more voice call. */
  function retry() {
    const run = listening.current;
    if (run && !run.signal.aborted) void interpretText(transcript.current, run.signal);
  }

  function close() {
    // Only now: the mic leaving the bar would unmount the panel that is explaining why.
    if (state.kind === "message" && state.message === "device") hideMic();
    listening.current?.abort();
    setOpen(false);
  }

  function remove(index: number) {
    setState((s) => (s.kind === "review" ? { ...s, actions: s.actions.filter((_, i) => i !== index) } : s));
  }

  /** Turns an action with several matches into the candidate the Resident picked. */
  function choose(index: number, candidate: number) {
    setState((s) => (s.kind === "review" ? { ...s, actions: s.actions.map((a, i) => (i === index ? pick(a, candidate) : a)) } : s));
  }

  /** Applies what is left; only possible once every choice is picked or removed. */
  async function confirm() {
    if (state.kind !== "review" || !canConfirm(state.actions)) return;
    const actions = state.actions as PlainAction[];
    const run = listening.current;
    setState({ kind: "applying", actions });
    const results = await apply.mutateAsync(actions);
    // The panel was closed meanwhile; onSettled has already refreshed the caches.
    if (run?.signal.aborted) return;
    setState({ kind: "results", actions, results });
  }

  return { state, isOpen, open, close, remove, choose, retry, confirm };
}

export type Voice = ReturnType<typeof useVoice>;
