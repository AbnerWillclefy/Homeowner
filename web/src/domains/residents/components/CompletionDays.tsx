import type { ReactNode } from "react";
import { useI18n } from "../../../shared/i18n";
import type { ResidentCompletion, ResidentDay } from "../api/api";
import { dayHeading, dayHeadingText } from "../logic/dayHeading";
import { CompletionCard } from "./CompletionCard";

/**
 * A Resident's Completions by day, newest day first, as calm records. Only Me passes `action`, a control for the
 * caller's own Completions; a Resident's page never does. `today` is the Home's date
 * the headings count from; times show in `timeZone`. The Resident page and Me both use it, each inside its own
 * headed section and with its own empty text.
 */
export function CompletionDays({
  days,
  today,
  timeZone,
  empty,
  action,
}: {
  days: ResidentDay[];
  today: string;
  timeZone: string;
  empty: string;
  action?: (completion: ResidentCompletion) => ReactNode;
}) {
  const { t, locale } = useI18n();
  const words = { today: t("resident.day.today"), yesterday: t("resident.day.yesterday") };
  return (
    <div className="flex flex-col gap-4">
      {days.length === 0 ? (
        <p className="my-0 text-muted">{empty}</p>
      ) : (
        days.map((day) => (
          <div key={day.date} className="flex flex-col gap-3">
            <h4 className="my-0 text-base font-bold first-letter:uppercase">{dayHeadingText(dayHeading(day.date, today), locale, words)}</h4>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {day.completions.map((completion) => (
                <CompletionCard key={completion.id} completion={completion} timeZone={timeZone} action={action?.(completion)} />
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
