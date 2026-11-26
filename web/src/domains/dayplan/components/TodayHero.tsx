import type { ReactNode } from "react";
import { Card, ChoiceGroup, Choice, ProgressBar } from "@homeowner/bedrock";
import { Energy, EnergyBars } from "@homeowner/bedrock/home";
import { useShell } from "../../../app/components/ShellContext";
import { useI18n, type MessageKey } from "../../../shared/i18n";
import { Button } from "../../../shared/ui/Button";
import { LEVELS, type Level } from "../../checkin/api/api";
import { LEVEL_BARS, LEVEL_KEYS } from "../../checkin/logic/labels";
import { formatAllocationTime } from "../../home/logic/allocationTimes";
import type { DayPlan } from "../api/api";
import { heroCounts } from "../logic/heroCounts";

/**
 * The card under Today's header, once the Check-in read has answered. Before today's Check-in it asks for the Energy
 * level directly, as large tap choices; picking one does not save, it opens the Shell's one Check-in dialog with that
 * level ticked, because a Check-in is a level plus the day's Restrictions. After the Check-in it shows the Energy chip
 * (which reopens the dialog), "N de M feitas" and the progress bar; with nothing to count it shows no figure and no
 * bar, and `TodaySection` says why the day is empty. When the Check-in could not be read it says so, with Retry. The
 * section is the focus target of the dialog that opens by itself (`heroRef`).
 */
export function TodayHero({ plan }: { plan: DayPlan | null }) {
  const { t, locale } = useI18n();
  const { checkIn, openCheckIn, heroRef } = useShell();
  const state = checkIn.state;
  if (state.kind === "loading") return null;

  const section = (children: ReactNode) => (
    <section ref={heroRef} tabIndex={-1} aria-label={t("today.hero.label")} className="mb-8 outline-none">
      {children}
    </section>
  );

  if (state.kind === "failed") {
    return section(
      <Card variant="compact">
        <p role="alert" className="my-0 text-muted">
          {t("today.hero.unavailable")}
        </p>
        <Button variant="secondary" onClick={() => void checkIn.reload()}>
          {t("today.hero.retry")}
        </Button>
      </Card>,
    );
  }

  const today = state.checkIn;
  const open = (level?: Level) => openCheckIn(heroRef.current ?? undefined, level);

  if (!today.checkedIn || today.level === null) {
    // A surface card, not Bedrock's green hero: its Choice is drawn for a surface and would lose its text on the hero's recoloured tokens.
    return section(
      <Card variant="compact" className="gap-3">
        <div>
          <h2 className="section-title my-0">{t("today.hero.question")}</h2>
          {plan && <p className="mt-1 mb-0 text-muted">{t("today.hero.hint", { time: formatAllocationTime(plan.allocationTime, locale) })}</p>}
        </div>
        <ChoiceGroup label={t("today.hero.question")} value={undefined} onValueChange={(level) => open(level as Level)}>
          {LEVELS.map((level) => {
            const keys: { label: MessageKey; hint?: MessageKey } = LEVEL_KEYS[level];
            return (
              <Choice
                key={level}
                value={level}
                label={t(keys.label)}
                hint={keys.hint && t(keys.hint)}
                leading={<EnergyBars level={LEVEL_BARS[level]} />}
              />
            );
          })}
        </ChoiceGroup>
        <Button variant="ghost" className="self-start" onClick={() => open()}>
          {t("today.hero.restrictions")}
        </Button>
      </Card>,
    );
  }

  const { done, total } = plan ? heroCounts(plan) : { done: 0, total: 0 };
  const name = t(LEVEL_KEYS[today.level].label);
  return section(
    <Card variant="hero" className="gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="card-label">{t("today.hero.label")}</span>
          {total > 0 && <span className="value-md">{t("today.hero.progress", { count: total, done, total })}</span>}
        </div>
        <Energy
          onHero
          level={LEVEL_BARS[today.level]}
          name={name}
          label={t("today.hero.energy", { level: name.toLocaleLowerCase(locale) })}
          onClick={(event) => openCheckIn(event.currentTarget)}
        />
      </div>
      {total > 0 && (
        <ProgressBar value={done} max={total} tone="brand" label={t("today.hero.label")} valueText={t("today.hero.progress", { count: total, done, total })} />
      )}
    </Card>,
  );
}
