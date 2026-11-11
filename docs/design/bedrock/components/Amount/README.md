# Amount

Every amount in reais. The whole value with cents at the same weight, and the reference in `text-muted` beside it: `R$ 2.183,41 / R$ 4.983`.

- Always `R$` + space + a pt-BR number (`1.234,56`), with tabular numbers (`br-num`). Cents whenever the value is a balance or a transaction; rounded only in the reference and on axes ("R$ 4.983", "R$ 8k").
- Spending has no sign; income gets "+" and `positive`. Never red for normal spending: red means late or over limit.
- Private mode (the eye in the header): replaces the value with `R$ ••••`, keeping the width.
- Sizes: `hero` 40, `lg` 32, `md` 20, `sm` 14.

The consumer passes cents (an integer) and optionally the reference; the component formats. Never format by hand.
