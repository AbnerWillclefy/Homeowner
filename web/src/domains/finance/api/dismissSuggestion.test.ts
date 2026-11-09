import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dismissBillSuggestion, parseBillSuggestions, type BillSuggestion } from "./api";
import { billSuggestionsKey, dismissSuggestion, invalidateFinance } from "./queries";

vi.mock("./api", async (original) => ({ ...(await original<typeof import("./api")>()), dismissBillSuggestion: vi.fn() }));

const NETFLIX: BillSuggestion = { merchantKey: "netflix", name: "Netflix", amountCents: 3990, dueDay: 12 };
const GYM: BillSuggestion = { merchantKey: "smartfit", name: "Smart Fit", amountCents: 9990, dueDay: 5 };

describe("parseBillSuggestions", () => {
  it("accepts the list and keeps only the known fields", () => {
    expect(parseBillSuggestions([{ ...NETFLIX, extra: 1 }])).toEqual([NETFLIX]);
    expect(parseBillSuggestions([])).toEqual([]);
  });

  it.each([
    ["not a list", { merchantKey: "x" }],
    ["a missing key", [{ name: "Netflix", amountCents: 100, dueDay: 1 }]],
    ["an empty key", [{ ...NETFLIX, merchantKey: "" }]],
    ["a fractional amount", [{ ...NETFLIX, amountCents: 10.5 }]],
    ["a zero amount", [{ ...NETFLIX, amountCents: 0 }]],
    ["a day of 0", [{ ...NETFLIX, dueDay: 0 }]],
    ["a day of 32", [{ ...NETFLIX, dueDay: 32 }]],
    ["a text day", [{ ...NETFLIX, dueDay: "12" }]],
  ])("rejects %s", (_, body) => {
    expect(parseBillSuggestions(body)).toBeNull();
  });
});

describe("dismissSuggestion", () => {
  const dismiss = vi.mocked(dismissBillSuggestion);
  let client: QueryClient;
  beforeEach(() => {
    dismiss.mockReset();
    client = new QueryClient();
    client.setQueryData(billSuggestionsKey, [NETFLIX, GYM]);
  });

  it("removes the suggestion before the server has answered, and keeps it gone on success", async () => {
    let answer!: (r: { kind: "ok" }) => void;
    dismiss.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const done = dismissSuggestion(client, "netflix");
    await vi.waitFor(() => expect(client.getQueryData(billSuggestionsKey)).toEqual([GYM]));
    answer({ kind: "ok" });
    expect(await done).toBe(true);
    expect(dismiss).toHaveBeenCalledWith("netflix");
    expect(client.getQueryData(billSuggestionsKey)).toEqual([GYM]);
  });

  it("puts the list back as it was when the request fails", async () => {
    dismiss.mockResolvedValue({ kind: "offline" });
    expect(await dismissSuggestion(client, "netflix")).toBe(false);
    expect(client.getQueryData(billSuggestionsKey)).toEqual([NETFLIX, GYM]);
  });

  it("is refreshed by a Bill write, which invalidates the finance prefix", async () => {
    await invalidateFinance(client);
    expect(client.getQueryState(billSuggestionsKey)?.isInvalidated).toBe(true);
  });
});
