# Design mocks

Mocks for the post-v1 epics, built against [`DESIGN.md`](../../DESIGN.md). Each board is a static HTML page (open it in a browser; add `?lang=pt-BR` for Brazilian Portuguese) with a PNG render per locale for GitHub. `mocks-i18n.js` holds the pt-BR wording, taken from the shipped catalog where it exists. Copy in the mocks is illustrative; the i18n catalogs own the real wording.

| Epic | en-US | pt-BR |
|---|---|---|
| 1. Day Plan explanation | [HTML](epic-1-day-explanation.html) · ![Epic 1](epic-1-day-explanation.png) | ![Epic 1 pt-BR](epic-1-day-explanation.pt-BR.png) |
| 2. Today polish | [HTML](epic-2-today-polish.html) · ![Epic 2](epic-2-today-polish.png) | ![Epic 2 pt-BR](epic-2-today-polish.pt-BR.png) |
| 3. Resident identity | [HTML](epic-3-resident-identity.html) · ![Epic 3](epic-3-resident-identity.png) | ![Epic 3 pt-BR](epic-3-resident-identity.pt-BR.png) |
| 4. Housemates | [HTML](epic-4-housemates.html) · ![Epic 4](epic-4-housemates.png) | ![Epic 4 pt-BR](epic-4-housemates.pt-BR.png) |
| 5. Swap on Today | [HTML](epic-5-swap.html) · ![Epic 5](epic-5-swap.png) | ![Epic 5 pt-BR](epic-5-swap.pt-BR.png) |

`mocks.css` mirrors the tokens in `web/src/index.css`; it is not imported by the app.
