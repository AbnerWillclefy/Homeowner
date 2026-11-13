import type { ConnectTokenResult, FailureKind, SourcesStatus, StatusResult } from "../api";
import type { PluggyOptions } from "./pluggyConnect";

/** A problem the screen words: an API failure, or the widget itself failing to load or reporting an error. */
export type ConnectProblem = FailureKind | "widget";

interface Deps {
  createToken(): Promise<ConnectTokenResult>;
  open(options: PluggyOptions): Promise<void>;
  register(itemId: string): Promise<StatusResult>;
}

interface Outcome {
  connected(status: SourcesStatus): void;
  /** The widget closed with nothing connected: not an error. */
  closed(): void;
  problem(problem: ConnectProblem): void;
}

/** Token, then widget, then Item registration. Resolves once the widget is open; the outcome arrives through `outcome`. */
export async function connectBanks(deps: Deps, outcome: Outcome): Promise<void> {
  const token = await deps.createToken();
  if (token.kind !== "ok") return outcome.problem(token.kind);

  // A close that follows a success is the widget tidying up, not the User giving up.
  let succeeded = false;
  try {
    await deps.open({
      connectToken: token.connectToken,
      includeSandbox: token.includeSandbox,
      onSuccess: async ({ item }) => {
        succeeded = true;
        const registered = await deps.register(item.id);
        if (registered.kind === "ok") outcome.connected(registered.status);
        else outcome.problem(registered.kind);
      },
      onError: () => outcome.problem("widget"),
      onClose: () => {
        if (!succeeded) outcome.closed();
      },
    });
  } catch {
    outcome.problem("widget");
  }
}
