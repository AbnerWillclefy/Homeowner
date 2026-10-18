---
name: Homeowner
description: A calm advisor that shares the housework by each Resident's Energy.
colors:
  surface: "#f7f8f5"
  surface-raised: "#ffffff"
  text: "#1c2421"
  muted: "#4d5a54"
  accent: "#2f6f4f"
  accent-contrast: "#ffffff"
  danger: "#b3261e"
  focus: "#1a5fb4"
  border: "#6b7a73"
  welcome-from: "#e3f3ea"
  welcome-to: "#f1ecfb"
  cat-peach: "#fde3d0"
  cat-peach-ink: "#5c2e12"
  cat-mint: "#d3f0e0"
  cat-mint-ink: "#11452d"
  cat-lavender: "#e5defa"
  cat-lavender-ink: "#35286b"
  cat-blue: "#d6e8fa"
  cat-blue-ink: "#12426e"
  cat-yellow: "#fbf0c4"
  cat-yellow-ink: "#5a4300"
  cat-salmon: "#fbd5d2"
  cat-salmon-ink: "#6e1f1a"
typography:
  page-title:
    fontFamily: "Nunito, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.25
  group-heading:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
  card-title:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.375
  body:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.5
  stat:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.25
rounded:
  control: "0.75rem"
  card: "1.25rem"
  pill: "62.5rem"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
  2xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-contrast}"
    rounded: "{rounded.pill}"
    padding: "0.5rem 1.25rem"
    height: "2.75rem"
  button-secondary:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "0.5rem 1.25rem"
    height: "2.75rem"
  button-danger:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.danger}"
    rounded: "{rounded.pill}"
    padding: "0.5rem 1.25rem"
    height: "2.75rem"
  card:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "1rem"
  icon-tile:
    rounded: "{rounded.control}"
    size: "2.75rem"
  chip:
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.75rem"
    height: "2rem"
  input:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0.5rem 0.75rem"
    height: "2.75rem"
---

# Design System: Homeowner

## Overview

**Creative North Star: "The Calm Advisor"**

Homeowner looks like the advice it gives: quiet, plain and kind. It is opened on tired mornings, one-handed, on a phone, so every screen is a single centred column of soft rounded cards on a pale surface, read top to bottom. Nothing shouts. One teal voice marks the actions; six Category pastels label what kind of work a Task is; everything else is ink on paper.

The system is soft and sturdy. Corners are generous, targets are never smaller than a thumb, and every surface keeps a hairline edge so it survives forced-colours mode. Depth comes from the step between the pale page and the white card, never from shadows. Meaning never rests on colour, an icon or a dot pattern alone: text always says the whole thing.

It is light and dark by token swap, not by variant, and it holds at the largest Dynamic Type size because every size is in `rem` and every line wraps instead of truncating.

**Key Characteristics:**
- One centred column (max 32rem), mobile-first, no desktop layout.
- Flat white cards with a 1px edge on a pale green-grey surface.
- One teal accent for primary actions; pastels label Categories only.
- Pills for buttons and chips, rounded squares for icon tiles, big rounded rectangles for cards.
- Nunito at 400, 600 and 700 only.
- Thumb-reach: no primary action is stranded on the left.

## Colors

A muted, sage-tinted neutral world with one deep teal voice and six soft pastels that name Categories.

### Primary
- **Advisor Teal** (`accent`): the one colour for the action you are most likely to take: Accept, Take, Save, the active tab. Its tint (10% over the card) fills icon tiles on neutral section cards. In dark theme it lifts to a mint (`#6fcf9f`) with near-black text on it.

### Neutral
- **Morning Paper** (`surface`): the page and the bottom of the overscroll. Dark: `#121816`.
- **Clean Card** (`surface-raised`): cards, dialogs, inputs, the bottom bar. Dark: `#1b2320`.
- **Garden Ink** (`text`): body copy and titles. Dark: `#e8eeea`.
- **Lichen** (`muted`): hints, secondary lines, dates, counts. Dark: `#a9b5ae`.
- **Hedge Line** (`border`): every card's, input's and pill's 1px edge. Dark: `#7f8d86`.
- **Focus Blue** (`focus`): the 2px focus outline, offset 2px. Only for focus.
- **Brick** (`danger`): Leave Home, sign-out confirmations and errors, always paired with a thick 2px edge and words.

### Category pastels
Each is a fill with a paired ink. Kitchen peach, bathroom mint, bedroom and living room lavender, laundry and floors blue, trash and outdoor yellow, pets salmon. "Other" and anything unknown is the neutral card. The pastel fills the whole card only for your own Tasks; elsewhere it lives on the icon tile and the chip.

### Named Rules
**The One Voice Rule.** Teal means "this is the action". It never decorates, never labels a Category, and never appears on more than one button per card.

**The Pastels Name, Never Rank Rule.** A pastel says what kind of work it is, or, on an initials avatar, tells Residents apart. It is never used for status, urgency, success or Importance.

**The Calm at Every Number Rule.** A Streak of 0, an empty plan or a Drained day uses the same neutral colours as a good day. There is no alarm colour for rest.

## Typography

**Body Font:** Nunito (with system-ui, -apple-system, Segoe UI, Roboto, sans-serif). Self-hosted, latin subset, 400/600/700.

**Character:** One rounded humanist sans for everything. Friendly without being cute; hierarchy comes from weight and size, never from a second family.

### Hierarchy
- **Page title** (700, 1.875rem, 1.25): the tab's h2, focus lands here when the tab opens. Under it one muted 600 line (the date, a summary).
- **Group heading** (700, 1.25rem, 1.3): "Yours today", "Still to do", with a muted count after it.
- **Card title** (700, 1.125rem, 1.375): the Chore name, a section card's h3.
- **Body** (400, 1rem, 1.5): sentences. Never below 1rem in inputs (iOS zoom).
- **Label** (600, 0.875rem, 1.5): the Category name above a Chore, facts, hints, chip text.
- **Stat** (700, 1.875rem, 1.25): a number in a stat tile, over its label.

### Named Rules
**The Wrap, Never Truncate Rule.** Every text box wraps (`overflow-wrap: anywhere`). No ellipsis anywhere; the largest text size must still show the whole name.

## Layout

One centred column, `max-width: 32rem`, with 1.5rem side padding plus the device's safe-area insets, and 2rem top and bottom. Cards stack with a 1rem gap; groups of cards are separated by a group heading and 2rem of space. Inside a card the rhythm is 0.75rem between rows, 1rem padding. Lists are real lists with no bullets.

The bottom tab bar holds four equal tabs in the same 32rem column, keeps the bottom safe-area inset, and sits after the content so it never covers it.

### Thumb reach
Actions live where a right thumb lands. A card's actions are on their own row at the bottom of the card.

- **Fill or end.** The primary action either spans the full width or is end-aligned (`justify-content: flex-end`). When several actions wrap, they wrap toward the right edge.
- **Left is for deliberate.** The left side is reserved for an action that should take a moment of thought before pressing, such as Done on a Task you have not taken, Refuse, or Leave Home. Never put the action you expect people to take on the left.
- **Dialogs follow the same rule.** The confirming action is bottom-right or full width; Cancel sits to its left or above it.

### Named Rules
**The Right Thumb Rule.** If the action you most want pressed is not at the bottom-right or full width, the layout is wrong.

## Elevation & Depth

Flat by default. Depth is tonal: the white card on the pale page, with a 1px edge. No shadows on cards, buttons, chips or the bar. The only overlay is the dialog scrim (`text` at 50%), which dims everything behind a dialog.

### Named Rules
**The Paper, Not Plastic Rule.** Nothing casts a shadow. If something needs to stand out, give it the accent tint or a pastel, not elevation.

## Shapes

Three radii and nothing in between: rounded squares for controls and icon tiles (0.75rem), big soft rectangles for cards (1.25rem), and pills for buttons and chips. The Category glyph is a circle with a 2px ring in the ink colour. Effort is five small round dots, filled up to its level, always next to the words that say the level. Avatars are circles with a hairline edge: a photo, or initials on a pastel pair picked from the user id.

## Components

### Buttons
Soft and sturdy pills, never smaller than 2.75rem in either direction.
- **Primary:** Advisor Teal fill and edge, white 600 text, `0.5rem 1.25rem`.
- **Secondary:** card fill, Hedge Line edge, ink text.
- **Danger:** card fill, a 2px Brick edge and Brick 700 text, so it is not told apart by colour alone.
- **Ghost:** no visible edge, for bar controls such as Back.
- **Link:** teal underlined text inside a sentence.
- **Disabled:** dashed edge, page fill, muted text. Colour transitions only behind `motion-safe:` (150ms).
- **Pending:** a small inline spinner replaces the leading icon space and the label stays, so the width does not jump.

### Chips
Icon and Category name on the Category pastel, a pill with a hairline edge, 0.875rem 600. Static chips are 2rem tall; interactive chips grow to the 2.75rem target.

### Cards / Containers
- **Corner Style:** 1.25rem.
- **Background:** Clean Card, or the Category pastel for your own Task.
- **Shadow Strategy:** none (see Elevation).
- **Border:** 1px Hedge Line, always.
- **Internal Padding:** 1rem.
- **Section card:** an icon tile and an h3 in a row, an optional muted hint, then the body.
- **Card row:** glyph left, text in the middle, actions on the right (they wrap to their own end-aligned row when narrow).
- **Stat tile:** a big number over its label.

### Inputs / Fields
Full width, 2.75rem minimum, card fill, 1px Hedge Line edge, 0.75rem radius, 1rem text. Focus is the global 2px Focus Blue outline. Labels sit above in 600.

### Navigation
Four tabs, icon over label, equal width. Active tab: 4px Advisor Teal top edge, teal 600 label. Inactive: muted. Labels wrap at large text.

### Task card (signature)
The Category tile and name, the Chore as card title, then a wrapping line of facts (Effort dots and words, when it is due, Importance and people when unusual), then one reason line after a hairline divider with a lightbulb. Actions on the last row follow the Right Thumb Rule. Your own Tasks wear their Category pastel; others' and the pool's stay neutral with the pastel on the tile.

### Loading
First loads of page data show skeletons in the shape of what is coming (card outlines with muted bars), after a 300ms delay so fast loads never flash. Skeleton bars are `muted` at low opacity, pulse only behind `motion-safe:`. No full-screen spinners.

## Do's and Don'ts

### Do:
- **Do** use semantic tokens only (`bg-surface-raised`, `text-muted`); a raw palette class compiles to nothing.
- **Do** keep every touch target at least 2.75rem and every size in `rem`.
- **Do** write the Category name, the Effort level and every status as text next to its icon or colour.
- **Do** put the expected action bottom-right or full width (The Right Thumb Rule).
- **Do** keep motion behind `motion-safe:` and under 200ms.

### Don't:
- **Don't** add shadows, gradients on cards, or glass effects. The only gradient is onboarding's full-bleed welcome background.
- **Don't** use teal for anything but the primary action and the active tab.
- **Don't** use a pastel to mean status, urgency or success.
- **Don't** truncate text with an ellipsis.
- **Don't** use alarm colours, exclamation marks or countdowns for rest, empty days or a Streak of 0.
- **Don't** put the action you expect people to take on the left edge of a card or dialog.
