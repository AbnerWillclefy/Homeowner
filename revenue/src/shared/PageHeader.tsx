import { PageHeader as BedrockPageHeader, type PageHeaderProps } from "@homeowner/bedrock";
import { HideValuesToggle } from "./HideValues";
import { MonthSelect } from "./month/MonthSelect";

/**
 * Revenue's PageHeader: Bedrock's, with the app's own controls plugged into its slots. `month` shows the
 * `MonthSelect` (the period), `hideValues` the hide-values eye (last). The layout lives in Bedrock.
 *
 * Grid convention for the body: `grid gap-6 desktop:grid-cols-12` with `desktop:col-span-{3,4,5,6,7,8,12}` on the cells;
 * below 1024px it is one column. See `revenue/CLAUDE.md`.
 */
export function PageHeader({ month, hideValues, ...props }: Omit<PageHeaderProps, "period" | "trailing"> & { month?: boolean; hideValues?: boolean }) {
  return <BedrockPageHeader {...props} period={month && <MonthSelect />} trailing={hideValues && <HideValuesToggle />} />;
}
