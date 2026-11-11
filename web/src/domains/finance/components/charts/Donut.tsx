import { useState } from "react";
import { useI18n } from "../../../../shared/i18n";
import { arcPath, donutParts } from "../../logic/chart";
import { formatCents } from "../../logic/money";
import { SPENDING_LOOK, spendingKey, type SpendingCategory } from "../../logic/spendingCategories";

export interface DonutItem {
  category: SpendingCategory;
  cents: number;
}

// A 100 x 100 viewBox: the ring sits between two radii, a tapped part grows by 2 on each side, and the 2px gap
// between parts is about 1.2 units at the largest size the ring is drawn.
const C = 50;
const OUTER = 46;
const INNER = 30;
const GROW = 2;
const GAP = 1.2;
const HALF_GAP_DEGREES = ((GAP / 2) / ((OUTER + INNER) / 2)) * (180 / Math.PI);

/**
 * The month by Spending Category as one ring, largest part first, clockwise from the top. Parts at zero or below are
 * left out. A tap on a part puts its category, share and amount in the centre and a second tap brings back the total.
 * The parts are a pointer shortcut: the text alternative is the table every screen reader reads, and the category
 * list under the ring has the real buttons.
 */
export function Donut({ items }: { items: DonutItem[] }) {
  const { t, locale } = useI18n();
  const [selected, setSelected] = useState<SpendingCategory | null>(null);
  const money = (cents: number) => formatCents(cents, locale);
  const percent = new Intl.NumberFormat(locale, { style: "percent" });
  const parts = donutParts(items.map((i) => i.cents)).map((p) => ({ ...p, ...items[p.index]! }));
  const total = parts.reduce((sum, p) => sum + p.cents, 0);
  const active = parts.find((p) => p.category === selected) ?? null;
  const Icon = active ? SPENDING_LOOK[active.category].icon : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative mx-auto aspect-square w-full max-w-60">
        <svg role="img" aria-label={t("charts.donut.label", { amount: money(total) })} viewBox="0 0 100 100" className="size-full">
          {parts.map((p) => {
            const look = SPENDING_LOOK[p.category];
            const on = active?.category === p.category;
            // One part is the whole ring, so there is nothing to separate. A sliver never shrinks past its own middle.
            const trim = parts.length > 1 ? Math.min(HALF_GAP_DEGREES, (p.end - p.start) / 4) : 0;
            return (
              <path
                key={p.category}
                data-part={p.category}
                d={arcPath(C, C, on ? OUTER + GROW : OUTER, on ? INNER - GROW : INNER, p.start + trim, p.end - trim)}
                fillRule="evenodd"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                onClick={() => setSelected(on ? null : p.category)}
                // The 1px stroke is the part's own colour, so in forced-colors mode (where the colour turns to
                // the system text colour) it still draws an edge.
                className={`${look.fill} ${look.ink} cursor-pointer stroke-current motion-safe:transition-opacity motion-safe:duration-150 ${active && !on ? "opacity-35" : ""}`}
              />
            );
          })}
        </svg>
        <div
          data-centre
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 p-[24%] text-center [overflow-wrap:anywhere]"
        >
          {active && Icon ? (
            <>
              <Icon size={20} className={SPENDING_LOOK[active.category].ink} />
              <span className="text-xs font-semibold leading-tight">{t(spendingKey(active.category))}</span>
              <span className="text-sm font-bold leading-tight">
                {percent.format(active.percent / 100)} · {money(active.cents)}
              </span>
            </>
          ) : (
            <>
              <span className="text-xs font-semibold leading-tight text-muted">{t("charts.donut.total")}</span>
              <span className="text-base font-bold leading-tight">{money(total)}</span>
            </>
          )}
        </div>
      </div>
      <table className="sr-only">
        <caption>{t("charts.donut.caption")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("charts.donut.category")}</th>
            <th scope="col">{t("charts.donut.amount")}</th>
            <th scope="col">{t("charts.donut.share")}</th>
          </tr>
        </thead>
        <tbody>
          {parts.map((p) => (
            <tr key={p.category}>
              <th scope="row">{t(spendingKey(p.category))}</th>
              <td>{money(p.cents)}</td>
              <td>{percent.format(p.percent / 100)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
