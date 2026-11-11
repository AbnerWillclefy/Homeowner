import { empty, json, signedIn, type FakeApi, type FakeState } from "../api";

type FinanceState = NonNullable<FakeState["finance"]>;

const EMPTY: FinanceState = {
  configured: false,
  sources: [],
  importing: false,
  lastSyncedAt: null,
};

/** `state.finance`, created on first use. */
const finance = (state: FakeState): FinanceState =>
  (state.finance ??= { ...EMPTY, sources: [] });

/** The status as the API sends it: every Source carries both days, null when none are set. */
const statusOf = (current: FinanceState) => ({
  ...current,
  sources: current.sources.map((s) => ({
    ...s,
    bankName: s.bankName ?? s.name,
    closeDay: s.closeDay ?? null,
    dueDay: s.dueDay ?? null,
  })),
});

/**
 * The Finances routes, as `backend/internal/server/finance.go` answers them. The credentials are only checked for
 * being present, then dropped: no state keeps them, so a spec can read the request log to see what was sent but
 * the fake itself never holds a secret. Registering an item adds two Sources and starts an import.
 */
export function financeHandlers(api: FakeApi): void {
  api.on(
    "GET /me/finance",
    signedIn((_, state) => json(200, statusOf(finance(state)))),
  );

  // A card's statement days, as `PUT /me/finance/sources/{id}/bill-days` answers: both or neither, 1 to 31.
  api.on(
    "PUT /me/finance/sources/{id}/bill-days",
    signedIn((request, state) => {
      const source = finance(state).sources.find(
        (s) => s.id === request.params["id"] && s.kind === "credit_card",
      );
      if (!source) return json(404, { error: "not found" });
      const body = request.body as {
        closeDay?: unknown;
        dueDay?: unknown;
      } | null;
      const day = (v: unknown) =>
        v === null
          ? null
          : Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 31
            ? (v as number)
            : undefined;
      const [closeDay, dueDay] = [day(body?.closeDay), day(body?.dueDay)];
      const fields: Record<string, string> = {};
      if (closeDay === undefined) fields.closeDay = "invalid";
      if (dueDay === undefined) fields.dueDay = "invalid";
      if (closeDay === null && dueDay !== null && dueDay !== undefined)
        fields.closeDay = "required";
      if (dueDay === null && closeDay !== null && closeDay !== undefined)
        fields.dueDay = "required";
      if (Object.keys(fields).length > 0)
        return json(400, { error: "invalid bill days", fields });
      source.closeDay = closeDay as number | null;
      source.dueDay = dueDay as number | null;
      return empty();
    }),
  );

  // A Source's own name, as `PUT /me/finance/sources/{id}/name` answers: null goes back to the bank's. The shown name
  // follows into the card list and the Transactions' sourceName, as the API reads them from the Source.
  api.on(
    "PUT /me/finance/sources/{id}/name",
    signedIn((request, state) => {
      const current = finance(state);
      const source = current.sources.find((s) => s.id === request.params["id"]);
      if (!source) return json(404, { error: "not found" });
      const raw = (request.body as { name?: unknown } | null)?.name;
      const text = typeof raw === "string" ? raw.trim() : null;
      if (raw !== null && text === null) return json(400, { error: "invalid source name", fields: { name: "invalid" } });
      if (text === "") return json(400, { error: "invalid source name", fields: { name: "required" } });
      if (text !== null && [...text].length > 60)
        return json(400, { error: "invalid source name", fields: { name: "too_long" } });
      const before = source.name;
      source.bankName ??= source.name;
      source.name = text ?? source.bankName;
      for (const m of current.commitments ?? [])
        for (const card of m.cards) if (card.sourceId === source.id) card.name = source.name;
      for (const t of current.transactions ?? []) if (t.sourceName === before) t.sourceName = source.name;
      return empty();
    }),
  );

  api.on(
    "PUT /me/finance/credentials",
    signedIn((request, state) => {
      const body = request.body as {
        clientId?: unknown;
        clientSecret?: unknown;
      } | null;
      const fields: Record<string, string> = {};
      if (typeof body?.clientId !== "string" || body.clientId.trim() === "")
        fields.clientId = "required";
      if (
        typeof body?.clientSecret !== "string" ||
        body.clientSecret.trim() === ""
      )
        fields.clientSecret = "required";
      if (Object.keys(fields).length > 0)
        return json(400, { error: "invalid credentials", fields });
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
      finance(state).configured
        ? json(200, { connectToken: "connect-token-e2e", includeSandbox: true })
        : json(409, { error: "no credentials" }),
    ),
  );

  api.on(
    "POST /me/finance/items",
    signedIn((request, state) => {
      const itemId = (request.body as { itemId?: unknown } | null)?.itemId;
      if (typeof itemId !== "string" || itemId === "")
        return json(400, { error: "invalid item id" });
      const current = finance(state);
      if (current.sources.length === 0) {
        current.sources = [
          {
            id: "source-1",
            name: "Pluggy Bank",
            kind: "checking",
            currency: "BRL",
          },
          {
            id: "source-2",
            name: "Pluggy Bank",
            kind: "credit_card",
            currency: "BRL",
          },
        ];
      }
      current.importing = true;
      return json(200, statusOf(current));
    }),
  );

  // The month, as `finance.Handler.Month` answers: totals count Expenses only, biggest category first.
  api.on(
    "GET /me/finance/transactions",
    signedIn((request, state) => {
      const month = request.url.searchParams.get("month") ?? "";
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
        return json(400, { error: "invalid month" });
      const transactions = (finance(state).transactions ?? []).filter((t) =>
        (t.countsOn ?? t.postedOn).startsWith(`${month}-`),
      );
      const byCategory = new Map<string, number>();
      let spentCents = 0;
      for (const t of transactions) {
        if (t.type !== "expense") continue;
        spentCents -= t.amountCents;
        const category = t.spendingCategory ?? "other";
        byCategory.set(
          category,
          (byCategory.get(category) ?? 0) - t.amountCents,
        );
      }
      const categories = [...byCategory]
        .filter(([, cents]) => cents !== 0)
        .map(([category, cents]) => ({ category, spentCents: cents }))
        .sort((a, b) => b.spentCents - a.spentCents);
      return json(200, {
        month,
        spentCents,
        categories,
        transactions,
        limits: finance(state).limits ?? {},
      });
    }),
  );

  // The Spending limit of one category, as `PUT /me/finance/budgets/{category}` answers: a positive whole number sets, null removes.
  api.on(
    "PUT /me/finance/budgets/{category}",
    signedIn((request, state) => {
      const category = request.params["category"] ?? "";
      const cents = (request.body as { limitCents?: unknown } | null)
        ?.limitCents;
      if (
        cents !== null &&
        !(
          Number.isInteger(cents) &&
          (cents as number) > 0 &&
          (cents as number) <= 10 ** 12
        )
      )
        return json(400, { error: "invalid limit" });
      const limits = (finance(state).limits ??= {});
      if (cents === null) delete limits[category];
      else limits[category] = cents as number;
      return empty();
    }),
  );

  // The history, as `finance.Handler.History` answers: `months` months ending at `to`, oldest first, Expenses only.
  api.on(
    "GET /me/finance/history",
    signedIn((request, state) => {
      const to = request.url.searchParams.get("to") ?? "";
      const count = Number(request.url.searchParams.get("months") ?? "6");
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(to))
        return json(400, { error: "invalid month" });
      if (!Number.isInteger(count) || count < 1 || count > 12)
        return json(400, { error: "invalid months" });
      const [y, m] = to.split("-").map(Number) as [number, number];
      const months = Array.from({ length: count }, (_, i) => {
        const index = y * 12 + (m - 1) - (count - 1 - i);
        const month = `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
        const byCategory = new Map<string, number>();
        let spentCents = 0;
        for (const t of finance(state).transactions ?? []) {
          if (t.type !== "expense" || !t.postedOn.startsWith(`${month}-`))
            continue;
          spentCents -= t.amountCents;
          const category = t.spendingCategory ?? "other";
          byCategory.set(
            category,
            (byCategory.get(category) ?? 0) - t.amountCents,
          );
        }
        return {
          month,
          spentCents,
          categories: [...byCategory].map(([category, cents]) => ({
            category,
            spentCents: cents,
          })),
        };
      });
      return json(200, { to, months });
    }),
  );

  // The pace series, as `finance.Handler.Daily` answers: cumulative Expenses per day. `current` stops at today for the
  // running month and is empty for a later one; `average` covers the up-to-3 months before that have Expenses.
  api.on(
    "GET /me/finance/daily",
    signedIn((request, state) => {
      const month = request.url.searchParams.get("month") ?? "";
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
        return json(400, { error: "invalid month" });
      const rows = (finance(state).transactions ?? []).filter(
        (t) => t.type === "expense",
      );
      const shift = (by: number) => {
        const index =
          Number(month.slice(0, 4)) * 12 + Number(month.slice(5)) - 1 + by;
        return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
      };
      const daysIn = (m: string) =>
        new Date(Number(m.slice(0, 4)), Number(m.slice(5)), 0).getDate();
      const cumulative = (m: string, days: number) => {
        const perDay = Array<number>(days).fill(0);
        for (const t of rows)
          if (t.postedOn.startsWith(`${m}-`))
            perDay[Number(t.postedOn.slice(8, 10)) - 1]! -= t.amountCents;
        let total = 0;
        return perDay.map((cents) => (total += cents));
      };
      const days = daysIn(month);
      const today =
        finance(state).today ?? new Date().toISOString().slice(0, 10);
      const upTo =
        month < today.slice(0, 7)
          ? days
          : month === today.slice(0, 7)
            ? Number(today.slice(8, 10))
            : 0;
      const withHistory = [shift(-1), shift(-2), shift(-3)].filter((m) =>
        rows.some((t) => t.postedOn.startsWith(`${m}-`)),
      );
      const series = withHistory.map((m) => {
        const whole = cumulative(m, daysIn(m));
        return Array.from(
          { length: days },
          (_, d) => whole[Math.min(d, whole.length - 1)]!,
        );
      });
      const average =
        series.length === 0
          ? []
          : Array.from({ length: days }, (_, d) =>
              Math.round(
                series.reduce((sum, s) => sum + s[d]!, 0) / series.length,
              ),
            );
      return json(200, {
        month,
        days,
        current: cumulative(month, days).slice(0, upTo),
        previous: cumulative(shift(-1), daysIn(shift(-1))),
        average,
        averageMonths: series.length,
      });
    }),
  );

  // The coming months, with `leftoverCents` only while an income is set, as the API answers.
  api.on(
    "GET /me/finance/commitments",
    signedIn((request, state) => {
      if (
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(
          request.url.searchParams.get("from") ?? "",
        )
      )
        return json(400, { error: "invalid month" });
      const { monthlyIncomeCents = null, commitments = [] } = finance(state);
      const months = commitments.map((m) =>
        monthlyIncomeCents
          ? { ...m, leftoverCents: monthlyIncomeCents - m.totalCents }
          : m,
      );
      return json(200, { monthlyIncomeCents, months });
    }),
  );

  api.on(
    "PUT /me/finance/income",
    signedIn((request, state) => {
      const cents = (request.body as { monthlyIncomeCents?: unknown } | null)
        ?.monthlyIncomeCents;
      if (cents !== null && !(Number.isInteger(cents) && (cents as number) > 0))
        return json(400, { error: "invalid income" });
      finance(state).monthlyIncomeCents = cents as number | null;
      return empty();
    }),
  );

  api.on(
    "PATCH /me/finance/transactions/{id}",
    signedIn((request, state) => {
      const row = finance(state).transactions?.find(
        (t) => t.id === request.params["id"],
      );
      if (!row) return json(404, { error: "not found" });
      const body = request.body as {
        type?: "income" | "expense" | "transfer" | "saving";
        spendingCategory?: string;
      } | null;
      const type = body?.type ?? row.type;
      if (body?.spendingCategory !== undefined && type !== "expense")
        return json(400, { error: "category needs expense" });
      row.type = type;
      row.spendingCategory =
        type !== "expense"
          ? null
          : (body?.spendingCategory ?? row.spendingCategory ?? "other");
      if (body?.spendingCategory !== undefined) row.categorySetBy = "user";
      return json(200, row);
    }),
  );

  // Bills, as `finance/bills.go` answers them: the same field codes on a 400, a due day past the month's end falls on its last day.
  const bills = (state: FakeState) => (finance(state).bills ??= []);
  const monthOf = (value: string | undefined) =>
    value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : null;
  const dueDate = (month: string, dueDay: number) => {
    const [y, m] = month.split("-").map(Number) as [number, number];
    return `${month}-${String(Math.min(dueDay, new Date(y, m, 0).getDate())).padStart(2, "0")}`;
  };
  const billFields = (
    body: { name?: unknown; expectedCents?: unknown; dueDay?: unknown } | null,
  ) => {
    const fields: Record<string, string> = {};
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (name === "") fields.name = "required";
    else if ([...name].length > 60) fields.name = "too_long";
    if (
      !Number.isInteger(body?.expectedCents) ||
      (body?.expectedCents as number) < 1
    )
      fields.expectedCents = "invalid";
    if (
      !Number.isInteger(body?.dueDay) ||
      (body?.dueDay as number) < 1 ||
      (body?.dueDay as number) > 31
    )
      fields.dueDay = "invalid";
    return { fields, name };
  };

  api.on(
    "GET /me/finance/bills",
    signedIn((request, state) => {
      const month = monthOf(request.url.searchParams.get("month") ?? undefined);
      if (!month) return json(400, { error: "invalid month" });
      return json(
        200,
        bills(state)
          .filter((b) => (b.createdMonth ?? "0000-00") <= month)
          .map(({ paid, paidCents, createdMonth: _, ...b }) => ({
            ...b,
            dueDate: dueDate(month, b.dueDay),
            paid: month in paid,
            paidBy: paid[month] ?? null,
            paidCents:
              month in paid ? (paidCents?.[month] ?? b.expectedCents) : null,
          })),
      );
    }),
  );

  api.on(
    "POST /me/finance/bills",
    signedIn((request, state) => {
      const body = request.body as {
        expectedCents: number;
        dueDay: number;
      } | null;
      const { fields, name } = billFields(body);
      if (Object.keys(fields).length > 0)
        return json(400, { error: "invalid bill", fields });
      const bill = {
        id: `bill-${bills(state).length + 1}`,
        name,
        expectedCents: body!.expectedCents,
        dueDay: body!.dueDay,
      };
      bills(state).push({ ...bill, paid: {} });
      return json(201, bill);
    }),
  );

  api.on(
    "PUT /me/finance/bills/{id}",
    signedIn((request, state) => {
      const row = bills(state).find((b) => b.id === request.params["id"]);
      if (!row) return json(404, { error: "not found" });
      const body = request.body as {
        expectedCents: number;
        dueDay: number;
      } | null;
      const { fields, name } = billFields(body);
      if (Object.keys(fields).length > 0)
        return json(400, { error: "invalid bill", fields });
      Object.assign(row, {
        name,
        expectedCents: body!.expectedCents,
        dueDay: body!.dueDay,
      });
      return json(200, {
        id: row.id,
        name,
        expectedCents: row.expectedCents,
        dueDay: row.dueDay,
      });
    }),
  );

  api.on(
    "DELETE /me/finance/bills/{id}",
    signedIn((request, state) => {
      const index = bills(state).findIndex(
        (b) => b.id === request.params["id"],
      );
      if (index < 0) return json(404, { error: "not found" });
      bills(state).splice(index, 1);
      return empty();
    }),
  );

  api.on(
    "PUT /me/finance/bills/{id}/payments/{month}",
    signedIn((request, state) => {
      const row = bills(state).find((b) => b.id === request.params["id"]);
      const month = monthOf(request.params["month"]);
      if (!row) return json(404, { error: "not found" });
      if (!month) return json(400, { error: "invalid month" });
      row.paid[month] ??= "hand";
      return empty();
    }),
  );

  api.on(
    "DELETE /me/finance/bills/{id}/payments/{month}",
    signedIn((request, state) => {
      const row = bills(state).find((b) => b.id === request.params["id"]);
      const month = monthOf(request.params["month"]);
      if (!row) return json(404, { error: "not found" });
      if (!month) return json(400, { error: "invalid month" });
      delete row.paid[month];
      return empty();
    }),
  );

  // Savings, as `finance/savings.go`, `investments.go` and `goals.go` answer: the same field codes on a 400, and a
  // reorder must carry exactly the User's Goals once each.
  const savings = (state: FakeState) =>
    (finance(state).savings ??= {
      reserveTargetCents: null,
      contributionBaseCents: null,
      reserveSharePercent: null,
      investments: [],
      goals: [],
    });
  const nameCode = (value: unknown) => {
    const name = typeof value === "string" ? value.trim() : "";
    return name === "" ? "required" : [...name].length > 60 ? "too_long" : null;
  };
  const investmentBody = (
    body: { name?: unknown; valueCents?: unknown; serves?: unknown } | null,
  ) => {
    const fields: Record<string, string> = {};
    const code = nameCode(body?.name);
    if (code) fields.name = code;
    if (!Number.isInteger(body?.valueCents) || (body?.valueCents as number) < 0)
      fields.valueCents = "invalid";
    if (body?.serves !== "reserve" && body?.serves !== "goals")
      fields.serves = "invalid";
    return fields;
  };
  const goalBody = (
    body: {
      name?: unknown;
      targetCents?: unknown;
      targetMonth?: unknown;
    } | null,
  ) => {
    const fields: Record<string, string> = {};
    const code = nameCode(body?.name);
    if (code) fields.name = code;
    if (
      !Number.isInteger(body?.targetCents) ||
      (body?.targetCents as number) < 1
    )
      fields.targetCents = "invalid";
    if (
      body?.targetMonth !== null &&
      body?.targetMonth !== undefined &&
      !(typeof body.targetMonth === "string" && monthOf(body.targetMonth))
    )
      fields.targetMonth = "invalid";
    return fields;
  };

  api.on(
    "GET /me/finance/savings",
    signedIn((_, state) => {
      const { suggestion = {}, ...stored } = savings(state);
      const saved = stored.investments
        .filter((i) => i.serves === "reserve")
        .reduce((sum, i) => sum + i.valueCents, 0);
      return json(200, {
        ...stored,
        reserve: {
          targetCents: stored.reserveTargetCents,
          savedCents: saved,
          monthCents: null,
          expectedMonth: null,
          ...suggestion.reserve,
        },
        goals: stored.goals.map((g) => ({
          savedCents: 0,
          monthCents: null,
          expectedMonth: null,
          late: false,
          ...g,
        })),
        unassignedCents: suggestion.unassignedCents ?? 0,
        ...(suggestion.leftover && { leftover: suggestion.leftover }),
        ...(suggestion.overLimit && { overLimit: suggestion.overLimit }),
      });
    }),
  );

  api.on(
    "PUT /me/finance/reserve",
    signedIn((request, state) => {
      const cents = (request.body as { targetCents?: unknown } | null)
        ?.targetCents;
      if (cents !== null && !(Number.isInteger(cents) && (cents as number) > 0))
        return json(400, { error: "invalid reserve target" });
      savings(state).reserveTargetCents = cents as number | null;
      return empty();
    }),
  );

  api.on(
    "PUT /me/finance/contribution",
    signedIn((request, state) => {
      const { baseCents, reserveSharePercent } = (request.body ?? {}) as {
        baseCents?: unknown;
        reserveSharePercent?: unknown;
      };
      const bothNull = baseCents === null && reserveSharePercent === null;
      const valid =
        Number.isInteger(baseCents) &&
        (baseCents as number) > 0 &&
        Number.isInteger(reserveSharePercent) &&
        (reserveSharePercent as number) >= 0 &&
        (reserveSharePercent as number) <= 100;
      if (!bothNull && !valid)
        return json(400, { error: "invalid contribution" });
      Object.assign(savings(state), {
        contributionBaseCents: baseCents,
        reserveSharePercent,
      });
      return empty();
    }),
  );

  api.on(
    "POST /me/finance/investments",
    signedIn((request, state) => {
      const body = request.body as {
        name: string;
        valueCents: number;
        serves: "reserve" | "goals";
      } | null;
      const fields = investmentBody(body);
      if (Object.keys(fields).length > 0)
        return json(400, { error: "invalid investment", fields });
      const row = {
        id: `investment-${savings(state).investments.length + 1}`,
        name: body!.name.trim(),
        valueCents: body!.valueCents,
        serves: body!.serves,
      };
      savings(state).investments.push(row);
      return json(201, row);
    }),
  );

  api.on(
    "PUT /me/finance/investments/{id}",
    signedIn((request, state) => {
      const row = savings(state).investments.find(
        (i) => i.id === request.params["id"],
      );
      if (!row) return json(404, { error: "not found" });
      const body = request.body as {
        name: string;
        valueCents: number;
        serves: "reserve" | "goals";
      } | null;
      const fields = investmentBody(body);
      if (Object.keys(fields).length > 0)
        return json(400, { error: "invalid investment", fields });
      Object.assign(row, {
        name: body!.name.trim(),
        valueCents: body!.valueCents,
        serves: body!.serves,
      });
      return json(200, row);
    }),
  );

  api.on(
    "DELETE /me/finance/investments/{id}",
    signedIn((request, state) => {
      const index = savings(state).investments.findIndex(
        (i) => i.id === request.params["id"],
      );
      if (index < 0) return json(404, { error: "not found" });
      savings(state).investments.splice(index, 1);
      return empty();
    }),
  );

  api.on(
    "POST /me/finance/goals",
    signedIn((request, state) => {
      const body = request.body as {
        name: string;
        targetCents: number;
        targetMonth: string | null;
      } | null;
      const fields = goalBody(body);
      if (Object.keys(fields).length > 0)
        return json(400, { error: "invalid goal", fields });
      const row = {
        id: `goal-${savings(state).goals.length + 1}`,
        name: body!.name.trim(),
        targetCents: body!.targetCents,
        targetMonth: body!.targetMonth ?? null,
      };
      savings(state).goals.push(row);
      return json(201, row);
    }),
  );

  // Registered before `{id}`, which would otherwise take "order" for an id.
  api.on(
    "PUT /me/finance/goals/order",
    signedIn((request, state) => {
      const ids = (request.body as { ids?: unknown } | null)?.ids;
      const goals = savings(state).goals;
      if (
        !Array.isArray(ids) ||
        ids.length !== goals.length ||
        !goals.every((g) => ids.filter((id) => id === g.id).length === 1)
      )
        return json(400, {
          error: "ids must be exactly your goals, once each",
        });
      savings(state).goals = (ids as string[]).map(
        (id) => goals.find((g) => g.id === id)!,
      );
      return empty();
    }),
  );

  api.on(
    "PUT /me/finance/goals/{id}",
    signedIn((request, state) => {
      const row = savings(state).goals.find(
        (g) => g.id === request.params["id"],
      );
      if (!row) return json(404, { error: "not found" });
      const body = request.body as {
        name: string;
        targetCents: number;
        targetMonth: string | null;
      } | null;
      const fields = goalBody(body);
      if (Object.keys(fields).length > 0)
        return json(400, { error: "invalid goal", fields });
      Object.assign(row, {
        name: body!.name.trim(),
        targetCents: body!.targetCents,
        targetMonth: body!.targetMonth ?? null,
      });
      return json(200, row);
    }),
  );

  api.on(
    "DELETE /me/finance/goals/{id}",
    signedIn((request, state) => {
      const index = savings(state).goals.findIndex(
        (g) => g.id === request.params["id"],
      );
      if (index < 0) return json(404, { error: "not found" });
      savings(state).goals.splice(index, 1);
      return empty();
    }),
  );

  // Suggested Bills, as `finance/suggestions.go` answers: a dismissed merchant stays hidden, repeating the dismissal is fine.
  api.on(
    "GET /me/finance/bill-suggestions",
    signedIn((_, state) =>
      json(
        200,
        (finance(state).billSuggestions ?? []).filter(
          (s) =>
            !(finance(state).dismissedSuggestions ?? []).includes(
              s.merchantKey,
            ),
        ),
      ),
    ),
  );

  api.on(
    "POST /me/finance/bill-suggestions/dismissals",
    signedIn((request, state) => {
      const key = (request.body as { merchantKey?: unknown } | null)
        ?.merchantKey;
      if (typeof key !== "string" || !/^[A-Z ]+$/.test(key))
        return json(400, { error: "invalid merchant key" });
      const dismissed = (finance(state).dismissedSuggestions ??= []);
      if (!dismissed.includes(key)) dismissed.push(key);
      return empty();
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
