import { useEffect } from "react";
import { BarTable, BarTableSkeleton, type BarColumn } from "../../shared/BarTable";
import { Button } from "../../shared/Button";
import { rangeDays, useRange } from "../../shared/range";
import { RangeControl } from "../../shared/RangeControl";
import { useAiUsage, type AiDay, type AiUsage, type MonthToDate, type ServiceDay } from "./api";
import { formatLatency, formatMicros, formatPercent, formatTokens } from "./format";
import { FALLBACK_GLOSSES, TEMPLATE_REASON_LABELS, VIOLATION_GLOSSES, withGloss } from "./glosses";

type Service = "allocator" | "explainer";

const CONSOLE_URL = "https://console.anthropic.com";

function costCell(s: ServiceDay) {
  return (
    <>
      {formatMicros(s.estCostMicros)}
      {s.uncostedCalls > 0 && (
        <span className="block text-sm text-muted">
          +{s.uncostedCalls} {s.uncostedCalls === 1 ? "call" : "calls"} without a price *
        </span>
      )}
    </>
  );
}

function columnsFor(service: Service): BarColumn<AiDay>[] {
  const s = (d: AiDay) => d.services[service];
  return [
    { key: "accepted", label: "Accepted", value: (d) => s(d).outcomes.accepted },
    { key: "rejected", label: "Rejected by referee", value: (d) => s(d).outcomes.rejected_by_referee },
    { key: "invalid", label: "Invalid answer", value: (d) => s(d).outcomes.invalid_response },
    { key: "timeout", label: "Timeout", value: (d) => s(d).outcomes.timeout },
    { key: "error", label: "Error", value: (d) => s(d).outcomes.error },
    { key: "cap", label: "Skipped: cap", value: (d) => s(d).outcomes.skipped_cap },
    { key: "budget", label: "Skipped: budget", value: (d) => s(d).outcomes.skipped_budget },
    { key: "p50", label: "Latency p50", value: (d) => s(d).latencyP50Ms ?? 0, display: (d) => formatLatency(s(d).latencyP50Ms) },
    { key: "max", label: "Latency max", value: (d) => s(d).latencyMaxMs ?? 0, display: (d) => formatLatency(s(d).latencyMaxMs) },
    { key: "in", label: "Input tokens", value: (d) => s(d).inputTokens, display: (d) => formatTokens(s(d).inputTokens) },
    { key: "out", label: "Output tokens", value: (d) => s(d).outputTokens, display: (d) => formatTokens(s(d).outputTokens) },
    { key: "cost", label: "Cost (estimated)", value: (d) => s(d).estCostMicros, display: (d) => costCell(s(d)) },
  ];
}

const SERVICES: { service: Service; title: string }[] = [
  { service: "allocator", title: "Allocator (plans the day)" },
  { service: "explainer", title: "Explainer (writes the explanations)" },
];

function hasCalls(days: AiDay[]): boolean {
  return days.some((d) =>
    SERVICES.some(({ service }) => Object.values(d.services[service].outcomes).some((n) => n > 0)),
  );
}

/** The LLM's calls, cost and share of the work for the last 7 or 30 days. Every money figure is an estimate. */
export function AiPage() {
  const [range, setRange] = useRange();
  const query = useAiUsage(range);

  useEffect(() => {
    document.title = "AI usage · Homeowner admin";
  }, []);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1>AI usage</h1>
        <RangeControl value={range} onChange={setRange} />
      </div>

      {query.isError ? (
        <div role="alert" className="my-4 rounded-control border-2 border-danger p-4">
          <p className="m-0 font-semibold">The AI usage could not be loaded.</p>
          <Button className="mt-3" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      ) : query.data === undefined ? (
        <div role="status" className="mt-4">
          <p className="text-muted">Loading the AI usage…</p>
          {SERVICES.map(({ service, title }) => (
            <div key={service} className="mt-4">
              <BarTableSkeleton caption={`${title}, last ${rangeDays(range)} days`} rowHeader="Date" columns={columnsFor(service)} rowCount={rangeDays(range)} />
            </div>
          ))}
        </div>
      ) : (
        <Loaded usage={query.data} days={rangeDays(range)} />
      )}
    </>
  );
}

function Loaded({ usage, days }: { usage: AiUsage; days: number }) {
  const { allocatorShare, explanationShare } = usage;
  const anyUncosted = usage.days.some((d) => SERVICES.some(({ service }) => d.services[service].uncostedCalls > 0));
  return (
    <>
      <MonthSection month={usage.monthToDate} cap={usage.dailyCapPerHome} />

      <section aria-labelledby="calls" className="mt-6">
        <h2 id="calls" className="mb-2 text-xl font-semibold">
          Calls per day
        </h2>
        {hasCalls(usage.days) ? (
          <>
            {SERVICES.map(({ service, title }) => (
              <div key={service} className="mt-4">
                <BarTable
                  caption={`${title}, last ${days} days`}
                  rowHeader="Date"
                  columns={columnsFor(service)}
                  rows={usage.days.map((d) => ({ id: d.date, label: d.date, data: d }))}
                />
              </div>
            ))}
            <ul className="mt-3 list-disc pl-6 text-sm text-muted">
              {anyUncosted && (
                <li>* Calls without a price (an unknown model, or no usage reported) add nothing to the estimate, so the cost is a lower bound.</li>
              )}
              <li>Latency counts only calls the model was asked; it is n/a on a day with none.</li>
              <li>Each bar is scaled to the largest value in its own column.</li>
            </ul>
          </>
        ) : (
          <p className="font-semibold">No model calls in this range</p>
        )}
      </section>

      <section aria-labelledby="planned" className="mt-6">
        <h2 id="planned" className="mb-2 text-xl font-semibold">
          Who planned the day
        </h2>
        <BarTable
          caption="Planned runs in this range, by who planned them"
          rowHeader="Planner"
          columns={shareColumns()}
          rows={[
            { id: "llm", label: "LLM", data: { count: allocatorShare.llm, whole: allocatorShare.llm + allocatorShare.baseline } },
            { id: "baseline", label: "Baseline allocator", data: { count: allocatorShare.baseline, whole: allocatorShare.llm + allocatorShare.baseline } },
          ]}
        />
      </section>

      <section aria-labelledby="explained" className="mt-6">
        <h2 id="explained" className="mb-2 text-xl font-semibold">
          Who wrote the explanation
        </h2>
        <BarTable
          caption="Resident explanations in this range, by who wrote them"
          rowHeader="Writer"
          columns={shareColumns()}
          rows={[
            { id: "llm", label: "LLM", data: { count: explanationShare.llm, whole: explanationShare.llm + explanationShare.template } },
            { id: "template", label: "Template", data: { count: explanationShare.template, whole: explanationShare.llm + explanationShare.template } },
          ]}
        />
        <div className="mt-4">
          <BarTable
            caption="Why the template was used"
            rowHeader="Reason"
            columns={[{ key: "count", label: "Explanations", value: (n: number) => n }]}
            rows={Object.entries(TEMPLATE_REASON_LABELS).map(([key, label]) => ({
              id: key,
              label,
              data: explanationShare.templateReasons[key as keyof typeof explanationShare.templateReasons] ?? 0,
            }))}
          />
        </div>
        <p className="text-sm text-muted">The template count is approximate: Assignments change after planning.</p>
      </section>

      <section aria-labelledby="referee" className="mt-6">
        <h2 id="referee" className="mb-2 text-xl font-semibold">
          Why the referee said no
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <IdTable caption="Top violation kinds" head="Kind" rows={usage.topViolationKinds.map((k) => ({ id: k.kind, count: k.count }))} glosses={VIOLATION_GLOSSES} />
          <IdTable caption="Top fallback reasons" head="Reason" rows={usage.topFallbackReasons.map((r) => ({ id: r.reason, count: r.count }))} glosses={FALLBACK_GLOSSES} />
        </div>
      </section>
    </>
  );
}

interface Share {
  count: number;
  whole: number;
}

function shareColumns(): BarColumn<Share>[] {
  return [
    { key: "count", label: "Count", value: (s) => s.count },
    { key: "share", label: "Share", value: (s) => s.count, display: (s) => formatPercent(s.count, s.whole) },
  ];
}

function IdTable({ caption, head, rows, glosses }: { caption: string; head: string; rows: { id: string; count: number }[]; glosses: Record<string, string> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left tabular-nums">
        <caption className="pb-2 text-left font-semibold">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="border-b-2 border-border px-3 py-2">{head}</th>
            <th scope="col" className="border-b-2 border-border px-3 py-2">Count</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={2} className="px-3 py-2 text-muted">None in this range</td>
            </tr>
          ) : (
            rows.map((row) => {
              const { id, gloss } = withGloss(row.id, glosses);
              return (
                <tr key={id}>
                  <th scope="row" className="border-b border-border px-3 py-2 font-normal">
                    <code>{id}</code>
                    {gloss !== null && <span className="block text-sm text-muted">{gloss}</span>}
                  </th>
                  <td className="border-b border-border px-3 py-2">{row.count}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function MonthSection({ month, cap }: { month: MonthToDate; cap: number }) {
  const { estCostMicros: cost, limitMicros: limit } = month;
  const over = limit !== null && cost > limit;
  const percent = limit === null || limit <= 0 ? 0 : Math.min(100, (cost / limit) * 100);
  return (
    <section aria-labelledby="cost" className="mt-4">
      <h2 id="cost" className="mb-2 text-xl font-semibold">
        Cost this month (estimated)
      </h2>
      {limit === null ? (
        <>
          <p className="m-0 text-2xl font-bold tabular-nums">{formatMicros(cost)} estimated</p>
          <p className="m-0">No monthly limit configured</p>
        </>
      ) : (
        <>
          <p className="m-0 text-2xl font-bold tabular-nums">
            {formatMicros(cost)} of {formatMicros(limit)} limit, estimated
          </p>
          <div aria-hidden="true" className={`my-2 h-3 w-full max-w-md overflow-hidden rounded-control border ${over ? "border-danger" : "border-border"}`}>
            <div data-month-bar="" className={`h-full ${over ? "bg-danger" : "bg-accent"}`} style={{ width: `${percent}%` }} />
          </div>
          <p className="m-0 font-semibold">{over ? "Over the limit" : "Under the limit"}</p>
        </>
      )}
      {month.uncostedCalls > 0 && (
        <p className="m-0 text-sm text-muted">
          +{month.uncostedCalls} {month.uncostedCalls === 1 ? "call" : "calls"} without a price this month, so the estimate is a lower bound.
        </p>
      )}
      <p className="m-0 mt-2">Up to {cap} model calls per Home per day</p>
      <p className="mt-2 text-sm text-muted">
        Estimated from token counts. The Anthropic Console is the source of truth for the bill.{" "}
        <a href={CONSOLE_URL} target="_blank" rel="noreferrer">
          Open the Anthropic Console (opens in a new tab)
        </a>
      </p>
    </section>
  );
}
