/** The link a Resident sends. The token sits in the fragment, so no server ever sees it. */
export function inviteLink(origin: string, token: string): string {
  return `${origin}/#invite=${token}`;
}

export interface ShareMessage {
  title: string;
  text: string;
  url: string;
}

export interface ShareDeps {
  share?(data: ShareMessage): Promise<void>;
  writeText?(text: string): Promise<void>;
}

export type ShareOutcome = "shared" | "cancelled" | "copied" | "failed";

/** The phone's own share sheet when it has one, otherwise (or if it fails) the clipboard. Never throws. */
export async function shareInvite(message: ShareMessage, deps: ShareDeps = browserShareDeps()): Promise<ShareOutcome> {
  if (deps.share) {
    try {
      await deps.share(message);
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }
  if (!deps.writeText) return "failed";
  try {
    await deps.writeText(message.url);
    return "copied";
  } catch {
    return "failed";
  }
}

function browserShareDeps(): ShareDeps {
  const nav = globalThis.navigator;
  return {
    share: typeof nav.share === "function" ? (data) => nav.share(data) : undefined,
    writeText: nav.clipboard ? (text) => nav.clipboard.writeText(text) : undefined,
  };
}
