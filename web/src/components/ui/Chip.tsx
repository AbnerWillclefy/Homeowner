import { Slot } from "@radix-ui/react-slot";
import type { HTMLAttributes } from "react";
import { useI18n } from "../../i18n";
import { categoryLabel } from "../../profile/labels";
import { categoryStyle } from "./categoryStyle";

interface Props extends HTMLAttributes<HTMLElement> {
  /** A Category id. The name is always shown as text, so meaning never rests on colour. */
  category?: string;
  /** Make the child (a Link or button) the chip. Only then is it interactive and given a touch target. */
  asChild?: boolean;
}

/** A Category chip: icon and name on the Category's pastel. */
export function Chip({ category, asChild = false, className = "", children, ...rest }: Props) {
  const { t } = useI18n();
  const { fill, ink, icon: Icon } = categoryStyle(category);
  const label = category ? categoryLabel(category) : undefined;
  const name = label ? ("key" in label ? t(label.key) : label.text) : undefined;
  const Comp = asChild ? Slot : "span";
  const size = asChild ? "min-h-11 min-w-11" : "min-h-8";
  return (
    <Comp
      className={`inline-flex ${size} items-center gap-2 rounded-pill border border-border px-3 py-1 text-sm font-semibold [overflow-wrap:anywhere] motion-safe:transition-colors motion-safe:duration-150 ${fill} ${ink} ${className}`}
      {...rest}
    >
      {asChild ? (
        children
      ) : (
        <>
          <Icon aria-hidden="true" size={16} className="shrink-0" />
          <span>{children ?? name}</span>
        </>
      )}
    </Comp>
  );
}
