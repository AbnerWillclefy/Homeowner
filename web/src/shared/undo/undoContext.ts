import { createContext } from "react";
import type { MessageKey } from "../i18n";
import type { SendResult } from "./pendingWrite";

/** A write the screen shows as done at once and the provider holds until it is sent (ADR 0029). */
export interface UndoableWrite {
  /** Names the data `apply` is for (for example `dayplan`), so a screen overlays only its own writes. */
  scope: string;
  /** The toast's words: what was done. */
  titleKey: MessageKey;
  titleParams?: Record<string, string | number>;
  /** Pure: the data as it looks once the write has happened. Restoring is dropping it; the cache stays the server's truth. */
  apply(data: unknown): unknown;
  /** Sends the request and, when the server answers, writes its answer into the cache. Never throws; a throw is `failedKey`. */
  send(options: { keepalive: boolean }): Promise<SendResult>;
  /** Says a failed send, when `send` threw. */
  failedKey: MessageKey;
  /** Runs after the server answered 409, so the screen reads the plan again. */
  refresh?(): void;
}

export interface HeldWrite extends UndoableWrite {
  id: number;
}

export interface Undo {
  /** The writes shown as done and not yet answered: the held one and those being sent. */
  pending: readonly HeldWrite[];
  start(write: UndoableWrite): void;
  /** Sends the held write now and resolves when every send has ended; undefined when none is running. For sign-out. */
  flush(): Promise<void> | undefined;
  /** Sends the held write, then lets a change that is written back take the toast. */
  another(): void;
}

export const UndoContext = createContext<Undo | null>(null);
