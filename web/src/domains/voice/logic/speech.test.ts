import { describe, expect, it } from "vitest";
import { listenOnce, recognitionCtor, type RecognitionCtor } from "./speech";

class Fake {
  static last: Fake;
  continuous = true;
  interimResults = true;
  maxAlternatives = 9;
  lang = "";
  started = 0;
  aborted = 0;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    Fake.last = this;
  }
  start() {
    this.started++;
  }
  abort() {
    this.aborted++;
    this.onend?.();
  }
}
const ctor = Fake as unknown as RecognitionCtor;

describe("recognitionCtor", () => {
  it("prefers the standard constructor, then the webkit one, else null", () => {
    expect(recognitionCtor({ SpeechRecognition: ctor, webkitSpeechRecognition: class {} })).toBe(ctor);
    expect(recognitionCtor({ webkitSpeechRecognition: ctor })).toBe(ctor);
    expect(recognitionCtor({})).toBeNull();
  });
});

describe("listenOnce", () => {
  it("sets one-shot options, starts synchronously and resolves to the transcript", async () => {
    const done = listenOnce(ctor, "pt-BR");
    const r = Fake.last;
    expect(r.started).toBe(1);
    expect([r.continuous, r.interimResults, r.maxAlternatives, r.lang]).toEqual([false, false, 1, "pt-BR"]);
    r.onresult?.({ results: [[{ transcript: " regar as plantas " }]] });
    r.onend?.();
    expect(await done).toEqual({ kind: "transcript", text: "regar as plantas" });
  });

  it("resolves to nothing when it ends without a result", async () => {
    const done = listenOnce(ctor, "en-US");
    Fake.last.onend?.();
    expect(await done).toEqual({ kind: "nothing" });
  });

  it("keeps the error code unchanged", async () => {
    const done = listenOnce(ctor, "en-US");
    Fake.last.onerror?.({ error: "not-allowed" });
    Fake.last.onend?.();
    expect(await done).toEqual({ kind: "error", code: "not-allowed" });
  });

  it("aborts the recognition when the signal aborts", async () => {
    const abort = new AbortController();
    const done = listenOnce(ctor, "en-US", abort.signal);
    abort.abort();
    expect(Fake.last.aborted).toBe(1);
    expect(await done).toEqual({ kind: "nothing" });
  });
});
