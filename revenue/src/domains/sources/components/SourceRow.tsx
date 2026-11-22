import { ListRow } from "@homeowner/bedrock/finance";
import { cloneElement, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { useHiddenProps } from "../../../shared/HideValues";
import { useI18n } from "../../../shared/i18n/I18nProvider";

type Props = Omit<ComponentProps<"div">, "title" | "children" | "hidden"> & {
  /** A BankMark or another phrasing-content icon. */
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  /** Without it the row has no amount (a bank, an account with no balance yet) and `end` fills the last column. */
  cents?: number;
  end?: ReactNode;
  /** An empty <a>, router Link or <button type="button"> that becomes the row; omit it for a row that does nothing. */
  children?: ReactElement;
};

// shortcut: mirrors ListRow's private layout for rows with no amount; upgrade by making ListRow's cents optional.
const grid = "grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 py-2 text-left text-text";
const interactive =
  "min-h-control-lg cursor-pointer rounded-md outline-none motion-safe:transition-colors duration-(--duration-fast) ease-standard hover:bg-surface-hover active:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** One single-line row of the Sources screen: Bedrock's ListRow, or the same layout without an amount. Spreads the injected props (a Sheet trigger's) onto the row. */
export function SourceRow({ leading, title, subtitle, cents, end, children, className, ...props }: Props) {
  const { locale } = useI18n();
  const hiddenProps = useHiddenProps();
  const child = isValidElement(children) ? children : undefined;
  if (cents !== undefined) {
    return child ? (
      <ListRow asChild leading={leading} title={title} subtitle={subtitle} cents={cents} end={end} locale={locale} className={className} {...hiddenProps} {...props}>
        {child}
      </ListRow>
    ) : (
      <ListRow leading={leading} title={title} subtitle={subtitle} cents={cents} end={end} locale={locale} className={className} {...hiddenProps} {...props} />
    );
  }
  const body = (
    <>
      <span className="flex">{leading}</span>
      <span className="flex min-w-0 flex-col">
        <span className="body-strong truncate">{title}</span>
        {subtitle && <span className="caption truncate text-text-muted">{subtitle}</span>}
      </span>
      <span className="flex shrink-0 items-center whitespace-nowrap">{end}</span>
    </>
  );
  if (!child) return <div className={`${grid} ${className ?? ""}`} {...props}>{body}</div>;
  return cloneElement(child as ReactElement<{ className?: string; children?: ReactNode }>, { ...props, className: `${grid} ${interactive} ${className ?? ""}`, children: body });
}
