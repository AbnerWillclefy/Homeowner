import { expect, type Page } from "@playwright/test";

const h1 = (page: Page, name: string) => page.getByRole("heading", { name, level: 1, exact: true });
const h2 = (page: Page, name: string) => page.getByRole("heading", { name, level: 2 });

/** What each signed-in tab shows, by role, label and text only. */
export const tabs = {
  today: {
    // Today's title is "Today", the tab's h1.
    heading: (page: Page) => h1(page, "Today"),
    mine: (page: Page) => h1(page, "Today"),
    others: (page: Page) => h2(page, "Other Residents' Tasks"),
    pool: (page: Page) => h2(page, "Still to do"),
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
    /** The header's line: when plans are made, and the zone. */
    summary: (page: Page) => page.getByText(/^Plans are made at .*America\/Sao Paulo time\.$/),
    /** The Rows of the Home tab; each opens a Sheet (the last one a Dialog). */
    settingsRow: (page: Page) => page.getByRole("button", { name: /^Home settings/ }),
    invite: (page: Page) => page.getByRole("button", { name: /^Invite a Resident/ }),
    leave: (page: Page) => page.getByRole("button", { name: /^Leave this Home/ }),
    /** The settings Sheet's two controls. */
    timezone: (page: Page) => page.getByRole("combobox", { name: "Timezone", exact: true }),
    allocationTime: (page: Page) => page.getByRole("combobox", { name: "Allocation time", exact: true }),
  },
  me: {
    heading: (page: Page) => h1(page, "About you"),
    /** The parts of Me, each a region named by its heading. */
    history: (page: Page) => page.getByRole("region", { name: "My Completions", exact: true }),
    plan: (page: Page) => page.getByRole("region", { name: "How the plan knows you", exact: true }),
    /** A row of Me: one native button that opens a Sheet, named by the row's title (and its current value). */
    row: (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name}\\b`) }),
    /** The Sheet a row opened. */
    sheet: (page: Page, name: string) => page.getByRole("dialog", { name }),
    /** Opens a row's Sheet. */
    async open(page: Page, name: string): Promise<void> {
      await tabs.me.row(page, name).click();
      await expect(tabs.me.sheet(page, name)).toBeVisible();
    },
    kitchenLike: (page: Page) => page.getByRole("radiogroup", { name: "Kitchen", exact: true }).getByRole("radio", { name: "Like", exact: true }),
    bending: (page: Page) => page.getByRole("switch", { name: "Bending" }),
    day: (page: Page, name: string) => page.getByRole("radiogroup", { name, exact: true }),
    signedInAs: (page: Page, email: string) => page.getByText(`Signed in as ${email}.`),
  },
};
