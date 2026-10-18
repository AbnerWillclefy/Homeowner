import type { Page } from "@playwright/test";

const h2 = (page: Page, name: string) => page.getByRole("heading", { name, level: 2, exact: true });
// Group headings carry a count ("Your Tasks 2"), so the name is matched as a substring.
const h3 = (page: Page, name: string) => page.getByRole("heading", { name, level: 3 });

/** What each signed-in tab shows, by role, label and text only. */
export const tabs = {
  today: {
    heading: (page: Page) => h2(page, "Today"),
    mine: (page: Page) => h3(page, "Your Tasks"),
    others: (page: Page) => h3(page, "Other Residents' Tasks"),
    pool: (page: Page) => h3(page, "Still to do"),
    task: (page: Page, name: string) => page.getByText(name, { exact: true }),
    empty: (page: Page) => page.getByText("Nothing for you today. Enjoy the day."),
    loadError: (page: Page) => page.getByRole("alert").filter({ hasText: "Something went wrong loading today's plan." }),
    retry: (page: Page) => page.getByRole("button", { name: "Try again" }),
  },
  chores: {
    heading: (page: Page) => h2(page, "Chores"),
    chore: (page: Page, name: string) => page.getByText(name, { exact: true }),
    empty: (page: Page) => page.getByText("No Chores yet."),
  },
  home: {
    heading: (page: Page) => h2(page, "Your Home"),
    timezone: (page: Page) => page.getByLabel("Timezone"),
    allocationTime: (page: Page) => page.getByLabel("Allocation time"),
    invite: (page: Page) => page.getByRole("heading", { name: "Invite a Resident", level: 3 }),
  },
  me: {
    heading: (page: Page) => h2(page, "About you"),
    baseline: (page: Page) => h3(page, "Baseline"),
    preferences: (page: Page) => h3(page, "Preferences"),
    restrictions: (page: Page) => h3(page, "Restrictions"),
    kitchenLike: (page: Page) => page.getByRole("group", { name: "Kitchen", exact: true }).getByRole("radio", { name: "Like", exact: true }),
    bending: (page: Page) => page.getByRole("checkbox", { name: "Bending" }),
    day: (page: Page, name: string) => page.getByRole("group", { name, exact: true }),
    signedInAs: (page: Page, email: string) => page.getByText(`Signed in as ${email}.`),
  },
};
