# TaskCard

One Task of the Day Plan, with the actions that apply in its state. **Home** layer.

- **When to use**: on Today, for the Resident's tasks, other Residents' tasks and the leftovers. **When not**: in the Chores list (use a list row with the bare `ChoreIcon`, under a heading that names the Category).
- **Anatomy**: `ChoreTag` 40px · the chore's name (16/24, one line) · caption (category, `Effort`, due) · ⋯ (`Menu` with Trocar and Ver detalhes) · one line of the why, truncated · actions.
- **States**:
  - **Proposed**: Recusar (`secondary`) and Aceitar (`primary`), side by side, 48px.
  - **Committed**: a `brand` badge "Assumida" and Concluir (`primary`, full width).
  - **Done**: dashed border, name struck through in `text-muted`, "Concluída às 9:02", Desfazer for a while.
  - **Another Resident's**: no actions, with the `Avatar` sm in place of the ⋯.
  - **Leftover**: Pegar (`secondary`).
- Tapping the card (outside the buttons) opens the `Sheet` with the whole why, the facts and the actions.
- Recusar and Concluir happen at once, with "Desfazer" in the `Toast`.
- Accessibility: the card is an `<article>` with a heading; each button carries the task's name ("Aceitar Lavar a louça").

The consumer provides the task, its state and the actions.
