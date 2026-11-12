# Amount

Every amount in reais. The whole value with cents at the same weight, and the reference in `text-muted` beside it: `R$ 2.183,41 / R$ 4.983`.

- **When to use**: every money value, in cards, rows, charts and tooltips. **When not**: a field the person types into (use `MoneyInput`), or a percentage.
- **Sizes**: `hero` 40, `lg` 32, `md` 20, `sm` 14.
- **Forms**: full (`R$ 2.183,41`), whole for the reference (`R$ 4.983`), and compact for axes and tooltips (`R$ 8k`, `R$ 1,2 mi`).
- **States**: not interactive. Private mode (the eye in the header) replaces the value with `R$ ••••`, keeping the width. Loading, empty and error belong to the component that holds it.
- **Content**:
  - Always `R$` + non-breaking space + a pt-BR number (`1.234,56`), with tabular numbers (`br-num`). Cents whenever the value is a balance or a transaction; rounded only in the reference and on axes.
  - Spending has no sign; income gets "+" and `positive`. Never red for normal spending: red means late or over limit.
- **Accessibility**: in private mode the dots are `aria-hidden` and a screen reader hears the label the consumer passes ("Hidden value"), never digits. The value never wraps away from `R$`.

The consumer passes cents (an integer), the hidden label and optionally the reference; the component formats. Never format by hand. Implementation: a plain element on the tokens, over `Intl.NumberFormat`.
