# PageHeader

The top of every screen: title, subtitle and the screen's tools.

- **When to use**: on every screen inside the app. **When not**: inside a card (use the card label) or a Sheet (use the Sheet header).
- **Anatomy**: `page-title` and, below it, the subtitle in `text-muted` (one sentence of context: "November 2026 · 3 bills · R$ 4.179,90"). The tools sit at the end, always in this order: period (`MonthSelect`) · secondary actions · primary action · hide values (eye).
- **Desktop**: one row. Title at the start, tools at the end, centred on the title block.
- **Phone** (< `bp-tablet`): two rows. On top, the title at the start and the IconButtons at the end (the primary action becomes a `brand` IconButton `+`, then the eye). Below, the period at full width, 48px. The subtitle stays on one line and truncates; what does not fit it is not essential.
- **Period**: the button shows the month in full ("November 2026") with the calendar icon, in the `secondary` style, never a wide outlined select.
- **Content**: sentence case. The title is the screen's name in the navigation.
- **Accessibility**: the title is the screen's only `<h1>`. Each IconButton has an accessible name ("New bill", "Hide values").

The consumer provides `title`, `subtitle` and `tools` (period, actions and the eye, in the order above). Implementation: a `<header>` on the tokens.
