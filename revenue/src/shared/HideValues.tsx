import { Button } from "@homeowner/bedrock";
import { Eye, EyeOff } from "lucide-react";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useI18n } from "./i18n/I18nProvider";

export const HIDE_VALUES_STORAGE_KEY = "revenue.hideValues";

interface HideValuesValue {
  hidden: boolean;
  toggle(): void;
}

// A default instead of a throw, so a page rendered without the Shell shows its values.
const HideValuesContext = createContext<HideValuesValue>({ hidden: false, toggle() {} });

export const useHideValues = () => useContext(HideValuesContext);

/** Whether to hide money on this device. Device-wide, kept across sign-out, never sent to the API. */
export function HideValuesProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HIDE_VALUES_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const value = useMemo(
    () => ({
      hidden,
      toggle: () => {
        try {
          localStorage.setItem(HIDE_VALUES_STORAGE_KEY, hidden ? "0" : "1");
        } catch {
          /* not persisted; applies for this session */
        }
        setHidden(!hidden);
      },
    }),
    [hidden],
  );
  return <HideValuesContext value={value}>{children}</HideValuesContext>;
}

/** The props a Bedrock `Amount`, `StatCard` or `ListRow` takes to follow the toggle: `<Amount {...useHiddenProps()} />`. */
export function useHiddenProps(): { hidden?: false } | { hidden: true; hiddenLabel: string } {
  const { hidden } = useHideValues();
  const { t } = useI18n();
  return hidden ? { hidden: true, hiddenLabel: t("hide.label") } : {};
}

export function HideValuesToggle() {
  const { hidden, toggle } = useHideValues();
  const { t } = useI18n();
  return (
    <Button variant="ghost" icon={hidden ? EyeOff : Eye} aria-pressed={hidden} onClick={toggle}>
      <span className="sr-only">{t(hidden ? "hide.show" : "hide.hide")}</span>
    </Button>
  );
}
