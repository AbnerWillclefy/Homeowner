# Effort

A Chore's effort: five dots and the level's name. **Home** layer.

- **When to use**: in the `TaskCard` caption, Chores rows and the chore form. **When not**: for energy (use `Energy`).
- Lit dots in `text`, unlit in `border-strong` (3:1 on `surface`). 6px each, 2px apart.
- The level's name is always written: Muito leve, Leve, Médio, Pesado, Muito pesado. The dots only reinforce it.
- Accessibility: the dots are `aria-hidden`; a screen reader hears "Esforço: médio".

The consumer provides the level, 1 to 5.
