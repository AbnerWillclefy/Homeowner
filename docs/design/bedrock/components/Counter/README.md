# Counter

A small number picked with − and +. **Core** layer.

- **When to use**: quantities from 0 to about 10 (rooms, pets). **When not**: money (`MoneyInput`) or large numbers (`Input`).
- Label at the start, − number + at the end, 48px tall. At a limit the button takes `opacity-disabled` and the label says the limit.
- Accessibility: a group named by the label; the number is a status, so a screen reader hears the new value after each press; the buttons have names ("Mais quartos").

This is the same control as the built `Stepper` (`bedrock/src/components/stepper.tsx`, used by Revenue's Pantry): the canvas calls the +/- control Counter. Whether the code exports it under both names or renames it is decided in #886.

The consumer provides the label, the value and the limits.
