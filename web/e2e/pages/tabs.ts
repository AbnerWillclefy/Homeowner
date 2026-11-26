import { expect, type Page } from "@playwright/test";

const h1 = (page: Page, name: string) => page.getByRole("heading", { name, level: 1, exact: true });
const h3 = (page: Page, name: string) => page.getByRole("heading", { name, level: 3 });

/** What each signed-in tab shows, by role, label and text only. */
export const tabs = {
  today: {
    // Today's title is "Today", the tab's h1.
    heading: (page: Page) => h1(page, "Today"),
    mine: (page: Page) => h1(page, "Today"),
    others: (page: Page) => h3(page, "Other Residents' Tasks"),
    pool: (page: Page) => h3(page, "Still to do"),
    task: (page: Page, name: string) => page.getByText(name, { exact: true }),
    empty: (page: Page) => page.getByText("Nothing for you today. Enjoy the day."),
    loadError: (page: Page) => page.getByRole("alert").filter({ hasText: "Something went wrong loading today's plan." }),
    retry: (page: Page) => page.getByRole("button", { name: "Try again" }),
  },
  chores: {
    heading: (page: Page) => h1(page, "Chores"),
    chore: (page: Page, name: string) => page.getByText(name, { exact: true }),
    empty: (page: Page) => page.getByText("What needs doing in your Home?"),
    /** A Chore's row: the one button whose name starts with the Chore's name. */
    row: (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name}`) }),
  },
  home: {
    heading: (page: Page) => h1(page, "Your Home"),
    timezone: (page: Page) => page.getByLabel("Timezone"),
    allocationTime: (page: Page) => page.getByLabel("Allocation time"),
    invite: (page: Page) => page.getByRole("heading", { name: "Invite a Resident", level: 3 }),
  },
  me: {
    heading: (page: Page) => h1(page, "About you"),
    /** The two parts of Me, each a region named by its h3; the cards inside are h4. */
    history: (page: Page) => page.getByRole("region", { name: "My Completions", exact: true }),
    settings: (page: Page) => page.getByRole("region", { name: "Your settings", exact: true }),
    baseline: (page: Page) => page.getByRole("heading", { name: "Baseline", level: 4 }),
    preferences: (page: Page) => page.getByRole("heading", { name: "Preferences", level: 4 }),
    restrictions: (page: Page) => page.getByRole("heading", { name: "Restrictions", level: 4 }),
    /** The head row of a card: one native button (the heading wraps it) that opens and closes the card. */
    trigger: (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name}\\b`) }),
    /** Opens a card if it is closed. */
    async open(page: Page, name: string): Promise<void> {
      const trigger = tabs.me.trigger(page, name);
      if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
    },
    kitchenLike: (page: Page) => page.getByRole("group", { name: "Kitchen", exact: true }).getByRole("radio", { name: "Like", exact: true }),
    bending: (page: Page) => page.getByRole("checkbox", { name: "Bending" }),
    day: (page: Page, name: string) => page.getByRole("group", { name, exact: true }),
    signedInAs: (page: Page, email: string) => page.getByText(`Signed in as ${email}.`),
  },
};
