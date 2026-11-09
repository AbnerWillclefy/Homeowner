/** The part of the Web Speech API used here; the TS DOM lib does not type it. */
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  start(): void;
  abort(): void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

export type RecognitionCtor = new () => Recognition;

export type ListenResult =
  | { kind: "transcript"; text: string }
  /** It ended with no speech recognised. */
  | { kind: "nothing" }
  /** `code` is the SpeechRecognitionErrorEvent `error` string, unchanged. */
  | { kind: "error"; code: string };

/** The browser's speech recognition constructor, or null where there is none (Firefox). */
export function recognitionCtor(win: object): RecognitionCtor | null {
  const w = win as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as RecognitionCtor | null;
}

/**
 * Listens for one utterance. `start()` runs synchronously in this call, because Safari needs it inside the tap
 * handler. Aborting the signal stops the recognition, which then resolves to "nothing".
 */
export function listenOnce(ctor: RecognitionCtor, lang: string, signal?: AbortSignal): Promise<ListenResult> {
  return new Promise((resolve) => {
    const r = new ctor();
    r.continuous = false;
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.lang = lang;
    let text = "";
    r.onresult = (e) => {
      text = e.results[0]?.[0]?.transcript.trim() ?? "";
    };
    r.onerror = (e) => resolve({ kind: "error", code: e.error });
    r.onend = () => resolve(text ? { kind: "transcript", text } : { kind: "nothing" });
    signal?.addEventListener("abort", () => r.abort(), { once: true });
    r.start();
  });
}
