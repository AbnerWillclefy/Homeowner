import { empty, json, signedIn, type FakeApi, type FakeState } from "../api";

type FinanceState = NonNullable<FakeState["finance"]>;

const EMPTY: FinanceState = { configured: false, sources: [], importing: false, lastSyncedAt: null };

/** `state.finance`, created on first use. */
const finance = (state: FakeState): FinanceState => (state.finance ??= { ...EMPTY, sources: [] });

/**
 * The Finances routes, as `backend/internal/server/finance.go` answers them. The credentials are only checked for
 * being present, then dropped: no state keeps them, so a spec can read the request log to see what was sent but
 * the fake itself never holds a secret. Registering an item adds two Sources and starts an import.
 */
export function financeHandlers(api: FakeApi): void {
  api.on("GET /me/finance", signedIn((_, state) => json(200, finance(state))));

  api.on(
    "PUT /me/finance/credentials",
    signedIn((request, state) => {
      const body = request.body as { clientId?: unknown; clientSecret?: unknown } | null;
      const fields: Record<string, string> = {};
      if (typeof body?.clientId !== "string" || body.clientId.trim() === "") fields.clientId = "required";
      if (typeof body?.clientSecret !== "string" || body.clientSecret.trim() === "") fields.clientSecret = "required";
      if (Object.keys(fields).length > 0) return json(400, { error: "invalid credentials", fields });
      finance(state).configured = true;
      return empty();
    }),
  );

  api.on(
    "DELETE /me/finance/credentials",
    signedIn((_, state) => {
      finance(state).configured = false;
      return empty();
    }),
  );

  api.on(
    "POST /me/finance/connect-token",
    signedIn((_, state) =>
      finance(state).configured ? json(200, { connectToken: "connect-token-e2e", includeSandbox: true }) : json(409, { error: "no credentials" }),
    ),
  );

  api.on(
    "POST /me/finance/items",
    signedIn((request, state) => {
      const itemId = (request.body as { itemId?: unknown } | null)?.itemId;
      if (typeof itemId !== "string" || itemId === "") return json(400, { error: "invalid item id" });
      const current = finance(state);
      if (current.sources.length === 0) {
        current.sources = [
          { id: "source-1", name: "Pluggy Bank", kind: "checking", currency: "BRL" },
          { id: "source-2", name: "Pluggy Bank", kind: "credit_card", currency: "BRL" },
        ];
      }
      current.importing = true;
      return json(200, current);
    }),
  );

  api.on(
    "DELETE /me/finance",
    signedIn((_, state) => {
      state.finance = { ...EMPTY, sources: [] };
      return empty();
    }),
  );
}
