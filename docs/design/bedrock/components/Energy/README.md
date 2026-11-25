# Energy

A Resident's energy for the day: the chip that shows the level, and the check-in choice. **Home** layer.

- **Chip** (`.br-energy`): in Today's header and on the `hero` card. Four bars (lit in `brand`, or `hero-line` inside the hero) and the name. Tapping opens the check-in.
- **Choice** (`.br-choice` in a `radiogroup`): the four levels in the check-in and on the hero before the check-in. Each has a short hint of what changes: Esgotado "Sem tarefas hoje", Baixa, Normal, Energizado.
- Levels: Esgotado (0 bars), Baixa (2), Normal (3), Energizado (4). The name is always written; the bars only reinforce it.
- Esgotado is never red or `danger`: resting is not an error.
- Accessibility: the chip is a button "Energia: normal. Mudar"; the choice is a `radiogroup` with arrow keys.

The consumer provides the level and what to do on a choice.
