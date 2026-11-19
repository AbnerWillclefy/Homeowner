# Stepper

Changes a quantity by one step with a minus and a plus button.

- **When to use**: a small count or weight you adjust a little at a time (units, 0,250 kg). **When not**: a value typed from scratch (use `Input`) or a money value (use `MoneyInput`).
- **Variants**: one. Two round buttons (40px, 48px hit area) around the value. The step is 1 by default; 0,001 fits kilograms.
- **States**: hover and pressed on the buttons; the `focus` ring; the minus disabled at the minimum (one step by default); the plus disabled at the maximum when there is one; the whole control disabled.
- **Content**: the value is formatted by the consumer ("2", "1,234 kg"), in tabular numerals so it does not jump. It makes room for a three-decimal value.
- **Accessibility**: a group named by the required label; the buttons are real `<button>`s with their own labels ("Menos", "Mais"), never just a symbol; the value is a status, so a screen reader hears the new value after each press.

The consumer provides the labels, `value` and `onValueChange`, and optionally `min`, `max`, `step` and `format`. Implementation: Bedrock's own, on native buttons.
