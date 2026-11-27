// Pages rule: only "@playwright/test" and other pages/ files are imported here (see launch.ts).
import { expect, type Page } from "@playwright/test";

export type Level = "Low" | "Normal" | "High";
export type PreferenceChoice = "Like" | "Neutral" | "Dislike";
export const WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export type Day = (typeof WEEK)[number];

export interface HomeSettingsInput {
  /** An IANA zone id, the option value. */
  timezone: string;
  /** "HH:MM". */
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

/** Where each screen sits in the count: a creator walks 5 screens, a joiner (a Home already existed at launch) 4, with no Home screen. */
export interface Place {
  baseline: number;
  finish: number;
  total: number;
}
export const CREATOR: Place = { baseline: 2, finish: 5, total: 5 };
export const JOINER: Place = { baseline: 1, finish: 4, total: 4 };

export const onboarding = {
  heading: (page: Page, name: string) => page.getByRole("heading", { name, level: 1 }),

  /** The screen shows its question as the page heading and its place in the walk ("Step n of m"; m is 4 for a joiner). */
  async expectOnStep(page: Page, heading: string, step: number, total: number): Promise<void> {
    await expect(onboarding.heading(page, heading)).toBeVisible();
    await expect(page.getByText(`Step ${step} of ${total}`, { exact: true })).toBeVisible();
  },

  async next(page: Page): Promise<void> {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  },

  /** The top-bar Skip of a skippable screen (Preferences, finish); its label says it is optional. */
  async skip(page: Page): Promise<void> {
    await page.getByRole("button", { name: "Skip (optional)", exact: true }).click();
  },

  /** "Not now" on the finish screen. Never "Enable reminders": that asks the browser for permission. */
  async skipReminders(page: Page): Promise<void> {
    await page.getByRole("button", { name: "Not now", exact: true }).click();
  },

  baselineDay: (page: Page, day: Day) => page.getByRole("radiogroup", { name: day, exact: true }),

  /** Picks one day's level and checks the pick holds (it saves at once, so one pick is one request). */
  async setBaseline(page: Page, day: Day, level: Level): Promise<void> {
    const group = onboarding.baselineDay(page, day);
    const radio = group.getByRole("radio", { name: level, exact: true });
    await radio.click();
    await expect(radio).toBeChecked();
  },

  /** Sets every day. */
  async setWholeWeek(page: Page, week: Record<Day, Level>): Promise<void> {
    for (const day of WEEK) await onboarding.setBaseline(page, day, week[day]);
  },

  /** The alert that says the Baseline is not complete. Matched by role, not by its wording. */
  incompleteBaselineAlert: (page: Page) => page.getByRole("alert"),

  async toggleRestriction(page: Page, label: string): Promise<void> {
    const box = page.getByRole("switch", { name: label, exact: true });
    await box.click();
    await expect(box).toBeChecked();
  },

  async setPreference(page: Page, category: string, choice: PreferenceChoice): Promise<void> {
    const group = page.getByRole("radiogroup", { name: category, exact: true });
    const radio = group.getByRole("radio", { name: choice, exact: true });
    await radio.click();
    await expect(radio).toBeChecked();
  },

  timezone: (page: Page) => page.getByRole("combobox", { name: "Timezone", exact: true }),
  async chooseTimezone(page: Page, zone: string): Promise<void> {
    await onboarding.timezone(page).click();
    await page.getByRole("option", { name: zone.replaceAll("_", " "), exact: true }).click();
  },
  allocationTime: (page: Page) => page.getByRole("combobox", { name: "Allocation time", exact: true }),
  /** The picker's option for an "HH:MM", as en-US writes it ("07:30" is "7:30 AM"). */
  async chooseAllocationTime(page: Page, time: string): Promise<void> {
    const [hours, minutes] = time.split(":").map(Number) as [number, number];
    await onboarding.allocationTime(page).click();
    await page.getByRole("option", { name: `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`, exact: true }).click();
  },
  bathrooms: (page: Page) => page.getByLabel("Bathrooms", { exact: true }),

  nextToQuestions: (page: Page) => page.getByRole("button", { name: "Next: about your Home", exact: true }).click(),

  /** On from the Home settings to the questions, and waits for them. */
  async continueFromSettings(page: Page): Promise<void> {
    await onboarding.nextToQuestions(page);
    await expect(page.getByRole("heading", { name: "About your Home", level: 2 })).toBeVisible();
  },

  /** The first Home step: the Home's zone and Allocation time, then on to the questions. */
  async completeHomeSettings(page: Page, settings: HomeSettingsInput): Promise<void> {
    await onboarding.expectOnStep(page, "Create your Home", 1, 5);
    await onboarding.chooseTimezone(page, settings.timezone);
    await onboarding.chooseAllocationTime(page, settings.allocationTime);
    await onboarding.continueFromSettings(page);
  },

  petCheckbox: (page: Page, label: string) => page.getByRole("checkbox", { name: label, exact: true }),

  /** Changes only the answers named; the rest keep what the form starts with. */
  async answerQuestions(page: Page, answers: AnswersInput): Promise<void> {
    if (answers.bathrooms !== undefined) {
      await onboarding.bathrooms(page).fill(String(answers.bathrooms));
      await expect(onboarding.bathrooms(page)).toHaveValue(String(answers.bathrooms));
    }
    for (const pet of answers.pets ?? []) {
      await page.getByText(pet, { exact: true }).click();
      await expect(onboarding.petCheckbox(page, pet)).toBeChecked();
    }
  },

  /** The chip that adds an outdoor area, found by its visible label ("Garden"); a row hides it while shown. */
  outdoorChip: (page: Page, label: string) => page.getByRole("button", { name: new RegExp(label, "i") }),

  /** The number field of an outdoor row, found by its plural label ("Gardens"). */
  outdoorCount: (page: Page, label: string) => page.getByLabel(label, { exact: true }),

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

  /** The alert that says Create Home was refused and nothing was saved. */
  createFailedAlert: (page: Page) =>
    page
      .getByRole("alert")
      .filter({ hasText: "Something went wrong and nothing was saved. What you typed is still here; try again in a moment." }),

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

  /** The finish screen (reminders; install first on iOS in a tab): skipped, and waits for the walk to end (the start choice shows over Today). */
  async completeReminders(page: Page, place: Place = CREATOR): Promise<void> {
    await onboarding.expectOnStep(page, "Turn on reminders", place.finish, place.total);
    await onboarding.skipReminders(page);
    await expect(onboarding.startChoiceDialog(page)).toBeVisible();
  },

  async completeBaseline(page: Page, week: Record<Day, Level>, place: Place = CREATOR): Promise<void> {
    await onboarding.expectOnStep(page, "Your Baseline", place.baseline, place.total);
    await onboarding.setWholeWeek(page, week);
    await onboarding.next(page);
    await expect(page).toHaveURL(/\/welcome\/restrictions$/);
  },

  async completeRestrictions(page: Page, labels: string[], place: Place = CREATOR): Promise<void> {
    await onboarding.expectOnStep(page, "Your Restrictions", place.baseline + 1, place.total);
    for (const label of labels) await onboarding.toggleRestriction(page, label);
    await onboarding.next(page);
    await expect(page).toHaveURL(/\/welcome\/preferences$/);
  },

  async completePreferences(page: Page, picks: WalkInput["preferences"], place: Place = CREATOR): Promise<void> {
    await onboarding.expectOnStep(page, "Your Preferences", place.baseline + 2, place.total);
    for (const { category, choice } of picks) await onboarding.setPreference(page, category, choice);
    await onboarding.next(page);
    await expect(page).toHaveURL(/\/welcome\/finish$/);
  },

  /** The straight walk from the first step to the review of suggested Chores, with Create Home ready to press. */
  async walkToReview(page: Page, input: WalkInput): Promise<void> {
    await onboarding.completeHomeSettings(page, input.home);
    await onboarding.answerQuestions(page, input.answers);
    await onboarding.suggestChores(page);
  },

  /** The steps after the Home, up to the start choice. */
  async walkProfile(page: Page, input: WalkInput, place: Place = CREATOR): Promise<void> {
    await onboarding.completeBaseline(page, input.baseline, place);
    await onboarding.completeRestrictions(page, input.restrictions, place);
    await onboarding.completePreferences(page, input.preferences, place);
    await onboarding.completeReminders(page, place);
  },
};
