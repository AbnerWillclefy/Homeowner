# Revenue rules

- Build a screen from its artboard in `docs/design/revenue/` (its `README.md` maps screens to files). Read the artboard and `docs/design/revenue/revenue.css` before writing code: the layout comes from the artboard (the header and its tools, the 12-column grid spans, the cards, the side panel), the data from the API, the words from the i18n catalogs and `docs/glossary-pt-BR.md`. Why: screens built from the old Finances code instead of the design came out as one column of cards (#703).
- Anything the screen does differently from its artboard goes in the pull request description under `### Differs from the design`, one line each with the reason (data the API does not serve, a glossary word, an accessibility fix). A difference not listed there is a defect.
- The design changes through a pull request to `docs/design/revenue/`, never only in the canvas: the repo copy is what screens are built and reviewed against.
