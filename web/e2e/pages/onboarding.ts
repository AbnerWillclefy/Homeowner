// Pages rule: only "@playwright/test" and other pages/ files are imported here (see launch.ts).
import { expect, type Page } from "@playwright/test";

export type Level = "Low" | "Normal" | "High";
export type PreferenceChoice = "Like" | "Neutral" | "Dislike";
export const WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export type Day = (typeof WEEK)[number];

/** The steps a walk leaves, in order; `settings` and `questions` are the two Home screens before the review. */
export type WalkStep = "reminders" | "baseline" | "restrictions" | "preferences" | "settings" | "questions";

export interface HomeSettingsInput {
  /** An IANA zone id, the option value. */
  timezone: string;
  /** "HH:MM", the option value. */
  allocationTime: string;
}

export interface AnswersInput {
  bathrooms?: number;
  /** Pet labels as the questionnaire shows them, for example "Dog". */
  pets?: string[];
}

/** Everything one walk through onboarding enters. */
export interface WalkInput {
  baseline: Record<Day, Level>;
  /** Demand labels to restrict. */
  restrictions: string[];
  /** Category label and pick; every Category left out stays Neutral and is never sent. */
  preferences: { category: string; choice: PreferenceChoice }[];
  home: HomeSettingsInput;
  answers: AnswersInput;
}

export const onboarding = {
  heading: (page: Page, name: string) => page.getByRole("heading", { name, level: 1 }),

  /** The step shows its question as the page heading and its place in the walk ("Setting up: step n of m"). */
  async expectOnStep(page: Page, heading: string, step: number, total: number): Promise<void> {
    await expect(onboarding.heading(page, heading)).toBeVisible();
    await expect(page.getByText(`Setting up: step ${step} of ${total}`, { exact: true })).toBeVisible();
  },

  async next(page: Page): Promise<void> {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  },

  /** "Not now" on the reminders step. Never "Enable reminders": that asks the browser for permission. */
  async skipReminders(page: Page): Promise<void> {
    await page.getByRole("button", { name: "Not now", exact: true }).click();
  },

  baselineDay: (page: Page, day: Day) => page.getByRole("group", { name: day, exact: true }),

  /** Picks one day's level and checks the pick holds (it saves at once, so one pick is one request). */
  async setBaseline(page: Page, day: Day, level: Level): Promise<void> {
    const group = onboarding.baselineDay(page, day);
    const radio = group.getByLabel(level, { exact: true });
    // The radio is visually hidden inside its label, which is what a finger or mouse hits.
    await group.getByText(level, { exact: true }).click();
    await expect(radio).toBeChecked();
  },

  /**
   * Sets every day. `afterSixDays` runs when only the seventh is missing, for a check that Next holds the User
   * back until the whole week is set.
   */
  async setWholeWeek(page: Page, week: Record<Day, Level>, afterSixDays?: () => Promise<void>): Promise<void> {
    for (const [index, day] of WEEK.entries()) {
      if (index === WEEK.length - 1) await afterSixDays?.();
      await onboarding.setBaseline(page, day, week[day]);
    }
  },

  /** The alert that says the Baseline is not complete. Matched by role, not by its wording. */
  incompleteBaselineAlert: (page: Page) => page.getByRole("alert"),

  async toggleRestriction(page: Page, label: string): Promise<void> {
    const box = page.getByRole("checkbox", { name: label, exact: true });
    await box.check();
    await expect(box).toBeChecked();
  },

  async setPreference(page: Page, category: string, choice: PreferenceChoice): Promise<void> {
    const group = page.getByRole("group", { name: category, exact: true });
    const radio = group.getByLabel(choice, { exact: true });
    await group.getByText(choice, { exact: true }).click();
    await expect(radio).toBeChecked();
  },

  timezone: (page: Page) => page.getByLabel("Timezone", { exact: true }),
  allocationTime: (page: Page) => page.getByLabel("Allocation time", { exact: true }),
  bathrooms: (page: Page) => page.getByLabel("Bathrooms", { exact: true }),

  /** The first Home step: the Home's zone and Allocation time, then on to the questions. */
  async fillHomeSettings(page: Page, settings: HomeSettingsInput): Promise<void> {
    await onboarding.timezone(page).selectOption(settings.timezone);
    await onboarding.allocationTime(page).selectOption(settings.allocationTime);
    await page.getByRole("button", { name: "Next: about your Home", exact: true }).click();
    await expect(page.getByRole("heading", { name: "About your Home", level: 2 })).toBeVisible();
  },

  /** Changes only the answers named; the rest keep what the form starts with. */
  async answerQuestions(page: Page, answers: AnswersInput): Promise<void> {
    if (answers.bathrooms !== undefined) {
      await onboarding.bathrooms(page).fill(String(answers.bathrooms));
      await expect(onboarding.bathrooms(page)).toHaveValue(String(answers.bathrooms));
    }
    for (const pet of answers.pets ?? []) {
      const box = page.getByRole("checkbox", { name: pet, exact: true });
      await page.getByText(pet, { exact: true }).click();
      await expect(box).toBeChecked();
    }
  },

  async suggestChores(page: Page): Promise<void> {
    await page.getByRole("button", { name: "Suggest Chores", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Review your Chores", level: 2 })).toBeVisible();
  },

  /** The review step lists exactly these Chore names (each one's Edit button carries its name) and this count. */
  async reviewShows(page: Page, names: string[]): Promise<void> {
    const count = names.length === 1 ? "1 Chore suggested" : `${names.length} Chores suggested`;
    await expect(page.getByText(count, { exact: true })).toBeVisible();
    for (const name of names) {
      await expect(page.getByRole("heading", { name, level: 4, exact: true })).toHaveCount(names.filter((n) => n === name).length);
    }
    await expect(page.getByRole("heading", { level: 4 })).toHaveCount(names.length);
  },

  /** The in-form Back button (it has visible text). The top bar's Back is an icon with only an accessible name. */
  async back(page: Page): Promise<void> {
    await page.getByRole("button", { name: "Back", exact: true }).filter({ hasText: "Back" }).click();
  },

  createHomeButton: (page: Page) => page.getByRole("button", { name: "Create Home", exact: true }),

  async createHome(page: Page): Promise<void> {
    await onboarding.createHomeButton(page).click();
  },

  startChoiceDialog: (page: Page) => page.getByRole("dialog", { name: "When do you want your Tasks?" }),

  /** The start choice over Today: wait until tomorrow. Never "Get my tasks right away". */
  async dismissStartChoice(page: Page): Promise<void> {
    const dialog = onboarding.startChoiceDialog(page);
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Start tomorrow", exact: true }).click();
    await expect(dialog).toBeHidden();
  },

  /**
   * Walks from the reminders step to the review of suggested Chores, entering `input`, and stops with the Create
   * Home button ready to press. `checkpoints` run right after the named step is left, so a spec can look at what the
   * server has received so far without keeping a second copy of the walk. `afterSixBaselineDays` goes to `setWholeWeek`.
   */
  async walkToReview(
    page: Page,
    input: WalkInput,
    options: { checkpoints?: Partial<Record<WalkStep, () => Promise<void>>>; afterSixBaselineDays?: () => Promise<void> } = {},
  ): Promise<void> {
    const { checkpoints = {} } = options;

    await onboarding.expectOnStep(page, "Turn on reminders", 1, 5);
    await onboarding.skipReminders(page);
    await checkpoints.reminders?.();

    await onboarding.expectOnStep(page, "Your Baseline", 2, 5);
    await onboarding.setWholeWeek(page, input.baseline, options.afterSixBaselineDays);
    await onboarding.next(page);
    await checkpoints.baseline?.();

    await onboarding.expectOnStep(page, "Your Restrictions", 3, 5);
    for (const label of input.restrictions) await onboarding.toggleRestriction(page, label);
    await onboarding.next(page);
    await checkpoints.restrictions?.();

    await onboarding.expectOnStep(page, "Your Preferences", 4, 5);
    for (const { category, choice } of input.preferences) await onboarding.setPreference(page, category, choice);
    await onboarding.next(page);
    await checkpoints.preferences?.();

    await onboarding.expectOnStep(page, "Create your Home", 5, 5);
    await onboarding.fillHomeSettings(page, input.home);
    await checkpoints.settings?.();
    await onboarding.answerQuestions(page, input.answers);
    await onboarding.suggestChores(page);
    await checkpoints.questions?.();
  },
};
