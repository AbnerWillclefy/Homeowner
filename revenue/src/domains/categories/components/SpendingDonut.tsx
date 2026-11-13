import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@homeowner/bedrock";
import { Amount, DonutChart } from "@homeowner/bedrock/finance";
import { useI18n } from "../../../shared/i18n/I18nProvider";
import type { CategoryRow } from "../logic/rows";
import { spendingKey, tagOf } from "../logic/categories";

/** The month split by Spending Category: the one place the category colours appear. The table below is its text alternative. */
export function SpendingDonut({ rows }: { rows: CategoryRow[] }) {
  const { t, locale } = useI18n();
  const spent = rows.filter((r) => r.spentCents > 0);
  const total = spent.reduce((n, r) => n + r.spentCents, 0);
  if (total === 0) return null;
  const top = spent[0]!;
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(top.spentCents / total);
  return (
    <DonutChart
      slices={spent.map((r) => ({ category: tagOf(r.category), label: t(spendingKey(r.category)), cents: r.spentCents }))}
      otherLabel={t("spending.other")}
      label={t("categories.donut.label", { name: t(spendingKey(top.category)), percent })}
      totalLabel={t("categories.donut.total")}
      locale={locale}
      alternative={
        <Table>
          <TableCaption>{t("categories.donut.label", { name: t(spendingKey(top.category)), percent })}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{t("categories.col.category")}</TableHead>
              <TableHead align="end">{t("categories.col.spent")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {spent.map((r) => (
              <TableRow key={r.category}>
                <TableCell>{t(spendingKey(r.category))}</TableCell>
                <TableCell align="end"><Amount cents={r.spentCents} size="sm" locale={locale} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    />
  );
}
