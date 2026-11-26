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

// The plan line names the level as the hero shows it; one sentence per level, so pt-BR agreement holds.
const PLAN_KEYS = {
  drained: "today.hero.plan.drained",
  low: "today.hero.plan.low",
  normal: "today.hero.plan.normal",
  energized: "today.hero.plan.energized",
} as const satisfies Record<Level, MessageKey>;

/**
 * The card under Today's header, once the Check-in read has answered. Before today's Check-in it asks for the Energy
 * level directly, as large tap choices on the green hero; picking one does not save, it opens the Shell's one Check-in dialog with that
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
    <section ref={heroRef} tabIndex={-1} aria-label={t("today.hero.label")} className="mt-0 outline-none">
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
    return section(
      <Card variant="hero" className="gap-4 p-4">
        <div>
          <h2 className="section-title my-0">{t("today.hero.question")}</h2>
          {plan && <p className="mt-1 mb-0 text-text-muted">{t("today.hero.hint", { time: formatAllocationTime(plan.allocationTime, locale) })}</p>}
        </div>
        <ChoiceGroup onHero label={t("today.hero.question")} value={undefined} onValueChange={(level) => open(level as Level)}>
          {LEVELS.map((level) => (
            <Choice
              key={level}
              value={level}
              label={t(LEVEL_KEYS[level].label)}
              hint={t(LEVEL_KEYS[level].hint)}
              leading={<EnergyBars onHero level={LEVEL_BARS[level]} />}
            />
          ))}
        </ChoiceGroup>
        <Button variant="link" className="self-start text-on-hero!" onClick={() => open()}>
          {t("today.hero.restrictions")}
        </Button>
      </Card>,
    );
  }

  const { done, total } = plan ? heroCounts(plan) : { done: 0, total: 0 };
  const name = t(LEVEL_KEYS[today.level].label);
  return section(
    <Card variant="hero" className="gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="card-label">{t("today.hero.label")}</span>
          {total > 0 && <span className="value-lg">{t("today.hero.progress", { count: total, done, total })}</span>}
        </div>
        <Energy
          onHero
          // Bedrock's chip paints a surface; on the hero it takes the same dark wash as the hero's choices, so its ink reads in both themes.
          className="border-transparent bg-[rgb(0_0_0/0.24)]"
          level={LEVEL_BARS[today.level]}
          name={name}
          label={t("today.hero.energy", { level: name.toLocaleLowerCase(locale) })}
          onClick={(event) => openCheckIn(event.currentTarget)}
        />
      </div>
      {total > 0 && (
        // Bedrock's bar is drawn for a surface (brand on sunken); on the hero's green the fill is the hero's line colour on a dark wash.
        <div className="[--brand:var(--hero-line)] [--surface-sunken:rgb(0_0_0/0.24)]">
          <ProgressBar value={done} max={total} tone="brand" label={t("today.hero.label")} valueText={t("today.hero.progress", { count: total, done, total })} />
        </div>
      )}
      {plan && <span className="text-text-muted">{t(PLAN_KEYS[today.level], { time: formatAllocationTime(plan.allocationTime, locale) })}</span>}
    </Card>,
  );
}
