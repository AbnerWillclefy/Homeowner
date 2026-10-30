import { useEffect } from "react";
import { DataTable, DataTableSkeleton, type DataColumn } from "../../shared/DataTable";
import { Collapsible } from "../../shared/Collapsible";
import { LoadError } from "../../shared/LoadError";
import { PageHeader } from "../../shared/PageHeader";
import { rangeDays, useRange } from "../../shared/range";
import { TrendChart } from "../../shared/TrendChart";
import { useAiUsage, type AiDay, type AiUsage, type MonthToDate, type ServiceDay, type TemplateReasons } from "./api";
import { Headline } from "./Headline";
import { callsOf } from "./headline";
import { formatLatency, formatMicros, formatPercent, formatTokens } from "../../shared/format";
import { FALLBACK_GLOSSES, TEMPLATE_REASON_LABELS, VIOLATION_GLOSSES } from "./glosses";

type Service = "allocator" | "explainer";

const SECTION = "mb-3 text-base font-semibold";

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

function columnsFor(service: Service): DataColumn<AiDay>[] {
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
      <PageHeader title="AI usage" note="What the LLM is asked, how it answers, and what it costs. Money is estimated." range={range} onRange={setRange} />

      {query.isError ? (
        <LoadError what="The AI usage" onRetry={() => void query.refetch()} />
      ) : query.data === undefined ? (
        <div role="status">
          <p className="text-sm text-muted">Loading the AI usage…</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} data-headline-skeleton="" className="h-32 rounded-card border border-border/50 bg-surface-raised motion-safe:animate-pulse" />
            ))}
          </div>
          {SERVICES.map(({ service, title }) => (
            <div key={service} className="mt-4">
              <DataTableSkeleton caption={`${title}, last ${rangeDays(range)} days`} rowHeader="Date" columns={columnsFor(service)} rowCount={rangeDays(range)} />
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
      <Headline usage={usage} days={days} />

      <MonthSection month={usage.monthToDate} cap={usage.dailyCapPerHome} />

      <section aria-labelledby="calls" className="mt-8">
        <h2 id="calls" className={SECTION}>
          Calls per day
        </h2>
        <TrendChart
          title={`LLM calls per day, last ${days} days`}
          dates={usage.days.map((d) => d.date)}
          series={SERVICES.map(({ service, title }) => ({ label: title, values: usage.days.map((d) => callsOf(d.services[service])) }))}
        />
        <Collapsible title="Show daily tables">
          {hasCalls(usage.days) ? (
            <>
              {SERVICES.map(({ service, title }) => (
                <div key={service} className="mt-4">
                  <DataTable
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
              </ul>
            </>
          ) : (
            <p className="font-semibold">No model calls in this range</p>
          )}
        </Collapsible>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="planned">
          <h2 id="planned" className={SECTION}>
            Who planned the day
          </h2>
          <ShareTable
            caption="Planned runs in this range, by who planned them"
            rowHeader="Planner"
            parts={[
              { id: "llm", label: "LLM", count: allocatorShare.llm },
              { id: "baseline", label: "Baseline allocator", count: allocatorShare.baseline },
            ]}
          />
        </section>

        <section aria-labelledby="explained">
          <h2 id="explained" className={SECTION}>
            Who wrote the explanation
          </h2>
          <ShareTable
            caption="Resident explanations in this range, by who wrote them"
            rowHeader="Writer"
            parts={[
              { id: "llm", label: "LLM", count: explanationShare.llm },
              { id: "template", label: "Template", count: explanationShare.template },
            ]}
          />
          <div className="mt-4">
            <DataTable
              caption="Why the template was used"
              rowHeader="Reason"
              columns={[{ key: "count", label: "Explanations", value: (n: number) => n }]}
              rows={(Object.keys(TEMPLATE_REASON_LABELS) as (keyof TemplateReasons)[]).map((key) => ({
                id: key,
                label: TEMPLATE_REASON_LABELS[key],
                data: explanationShare.templateReasons[key],
              }))}
            />
          </div>
          <p className="text-sm text-muted">The template count is approximate: Assignments change after planning.</p>
        </section>

        <section aria-labelledby="referee" className="lg:col-span-2">
          <h2 id="referee" className={SECTION}>
            Why the referee said no
          </h2>
          <div className="grid gap-8 md:grid-cols-2">
            <IdTable caption="Top violation kinds" head="Kind" rows={usage.topViolationKinds.map((k) => ({ id: k.kind, count: k.count }))} glosses={VIOLATION_GLOSSES} />
            <IdTable caption="Top fallback reasons" head="Reason" rows={usage.topFallbackReasons.map((r) => ({ id: r.reason, count: r.count }))} glosses={FALLBACK_GLOSSES} />
          </div>
        </section>
      </div>
    </>
  );
}

interface Part {
  id: string;
  label: string;
  count: number;
}

const shareColumns: DataColumn<{ count: number; whole: number }>[] = [
  { key: "count", label: "Count", value: (s) => s.count },
  { key: "share", label: "Share", value: (s) => s.count, display: (s) => formatPercent(s.count, s.whole) },
];

function ShareTable({ caption, rowHeader, parts }: { caption: string; rowHeader: string; parts: Part[] }) {
  const whole = parts.reduce((sum, p) => sum + p.count, 0);
  return (
    <DataTable
      caption={caption}
      rowHeader={rowHeader}
      columns={shareColumns}
      rows={parts.map((p) => ({ id: p.id, label: p.label, data: { count: p.count, whole } }))}
    />
  );
}

const countColumn: DataColumn<number>[] = [{ key: "count", label: "Count", value: (n) => n }];

function IdTable({ caption, head, rows, glosses }: { caption: string; head: string; rows: { id: string; count: number }[]; glosses: Record<string, string> }) {
  return (
    <DataTable
      caption={caption}
      rowHeader={head}
      columns={countColumn}
      empty="None in this range"
      rows={rows.map((row) => ({
        id: row.id,
        label: (
          <>
            <code>{row.id}</code>
            {Object.hasOwn(glosses, row.id) && <span className="block text-sm text-muted">{glosses[row.id]}</span>}
          </>
        ),
        data: row.count,
      }))}
    />
  );
}

function MonthSection({ month, cap }: { month: MonthToDate; cap: number }) {
  const { estCostMicros: cost, limitMicros: limit } = month;
  const over = limit !== null && cost > limit;
  const percent = limit === null || limit <= 0 ? 0 : Math.min(100, (cost / limit) * 100);
  return (
    <section aria-labelledby="cost" className="mt-8 rounded-card border border-border/50 bg-surface-raised p-4">
      <h2 id="cost" className={SECTION}>
        Cost this month (estimated)
      </h2>
      {limit === null ? (
        <>
          <p className="m-0 font-mono text-2xl font-semibold tabular-nums">{formatMicros(cost)} estimated</p>
          <p className="m-0">No monthly limit configured</p>
        </>
      ) : (
        <>
          <p className="m-0 font-mono text-2xl font-semibold tabular-nums">
            {formatMicros(cost)} of {formatMicros(limit)} limit, estimated
          </p>
          <div aria-hidden="true" className={`my-3 h-2 w-full max-w-xl overflow-hidden rounded-control bg-surface outline outline-1 ${over ? "outline-danger" : "outline-border/50"}`}>
            <div data-month-bar="" className={`h-full ${over ? "bg-danger" : "bg-accent"}`} style={{ width: `${percent}%` }} />
          </div>
          <p className={`m-0 text-sm font-semibold ${over ? "text-danger" : ""}`}>{over ? "Over the limit" : "Under the limit"}</p>
        </>
      )}
      {month.uncostedCalls > 0 && (
        <p className="m-0 text-sm text-muted">
          +{month.uncostedCalls} {month.uncostedCalls === 1 ? "call" : "calls"} without a price this month, so the estimate is a lower bound.
        </p>
      )}
      <p className="m-0 mt-2 text-sm">Up to {cap} model calls per Home per day</p>
      <p className="mt-2 text-sm text-muted">
        Estimated from token counts. The Anthropic Console is the source of truth for the bill.{" "}
        <a href={CONSOLE_URL} target="_blank" rel="noreferrer">
          Open the Anthropic Console (opens in a new tab)
        </a>
      </p>
    </section>
  );
}
