import { useId } from "react";
import { useI18n } from "../../../shared/i18n";
import type { ResidentDay } from "../api/api";
import { dayHeading, dayHeadingText } from "../logic/dayHeading";
import { CompletionCard } from "./CompletionCard";

/**
 * A Resident's Completions by day, newest day first, as calm records with no actions. `today` is the Home's date
 * the headings count from; times show in `timeZone`. The Resident page and Me both use it, each with its own
 * heading and empty text. The heading id comes from `useId`, so two lists never share one.
 */
export function CompletionDays({
  days,
  today,
  timeZone,
  heading,
  empty,
}: {
  days: ResidentDay[];
  today: string;
  timeZone: string;
  heading: string;
  empty: string;
}) {
  const { t, locale } = useI18n();
  const headingId = useId();
  const words = { today: t("resident.day.today"), yesterday: t("resident.day.yesterday") };
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h3 id={headingId} className="my-0 text-xl leading-snug font-bold">
        {heading}
      </h3>
      {days.length === 0 ? (
        <p className="my-0 text-muted">{empty}</p>
      ) : (
        days.map((day) => (
          <div key={day.date} className="flex flex-col gap-3">
            <h4 className="my-0 text-base font-bold first-letter:uppercase">{dayHeadingText(dayHeading(day.date, today), locale, words)}</h4>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {day.completions.map((completion) => (
                <CompletionCard key={completion.id} completion={completion} timeZone={timeZone} />
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
