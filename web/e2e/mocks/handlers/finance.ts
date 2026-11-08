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

  // The month, as `finance.Handler.Month` answers: totals count Expenses only, biggest category first.
  api.on(
    "GET /me/finance/transactions",
    signedIn((request, state) => {
      const month = request.url.searchParams.get("month") ?? "";
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return json(400, { error: "invalid month" });
      const transactions = (finance(state).transactions ?? []).filter((t) => t.postedOn.startsWith(`${month}-`));
      const byCategory = new Map<string, number>();
      let spentCents = 0;
      for (const t of transactions) {
        if (t.type !== "expense") continue;
        spentCents -= t.amountCents;
        const category = t.spendingCategory ?? "other";
        byCategory.set(category, (byCategory.get(category) ?? 0) - t.amountCents);
      }
      const categories = [...byCategory]
        .filter(([, cents]) => cents !== 0)
        .map(([category, cents]) => ({ category, spentCents: cents }))
        .sort((a, b) => b.spentCents - a.spentCents);
      return json(200, { month, spentCents, categories, transactions });
    }),
  );

  // The committed months, with `percentOfIncome` only while an income is set, as the API answers.
  api.on(
    "GET /me/finance/commitments",
    signedIn((request, state) => {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(request.url.searchParams.get("from") ?? "")) return json(400, { error: "invalid month" });
      const { monthlyIncomeCents = null, commitments = [] } = finance(state);
      const months = commitments.map((m) => (monthlyIncomeCents ? { ...m, percentOfIncome: (m.committedCents * 100) / monthlyIncomeCents } : m));
      return json(200, { monthlyIncomeCents, months });
    }),
  );

  api.on(
    "PUT /me/finance/income",
    signedIn((request, state) => {
      const cents = (request.body as { monthlyIncomeCents?: unknown } | null)?.monthlyIncomeCents;
      if (cents !== null && !(Number.isInteger(cents) && (cents as number) > 0)) return json(400, { error: "invalid income" });
      finance(state).monthlyIncomeCents = cents as number | null;
      return empty();
    }),
  );

  api.on(
    "PATCH /me/finance/transactions/{id}",
    signedIn((request, state) => {
      const row = finance(state).transactions?.find((t) => t.id === request.params["id"]);
      if (!row) return json(404, { error: "not found" });
      const body = request.body as { type?: "income" | "expense" | "transfer"; spendingCategory?: string } | null;
      const type = body?.type ?? row.type;
      if (body?.spendingCategory !== undefined && type !== "expense") return json(400, { error: "category needs expense" });
      row.type = type;
      row.spendingCategory = type !== "expense" ? null : (body?.spendingCategory ?? row.spendingCategory ?? "other");
      return json(200, row);
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
