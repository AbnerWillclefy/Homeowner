# pt-BR glossary

Agreed Brazilian Portuguese equivalents for the terms in [CONTEXT.md](../CONTEXT.md) that appear in the UI. Later tickets reuse and extend this table. The wording was drafted by an engineer and is awaiting native-speaker review ([ADR 0006](adr/0006-localize-with-a-small-typed-module.md)).

## Conventions

- Informal "você", not "tu".
- Domain terms are lower case in running pt-BR text, because Portuguese does not capitalise common nouns. The table keeps the English capitalised term as the key.
- The "avoid" lists in CONTEXT.md are English words. Their closest pt-BR calques are avoided too, for example "residência" and "domicílio" for Home. "Casa" is the literal sibling of the avoided English "House".
- Keep "Homeowner" as is: it is the product's name.

## Terms

| CONTEXT.md term | pt-BR | pt-BR words to avoid | Note |
|---|---|---|---|
| Home | lar | residência, domicílio (and "casa" unless the native speaker chooses it) | Covers houses and apartments, as CONTEXT.md requires. "Casa" is the colloquial fallback if the native speaker prefers it. Used in: "Divida os afazeres domésticos do seu lar de forma justa." |

"Housework" in running copy is "afazeres domésticos". It is not a term in CONTEXT.md; a **Task** (later "tarefa") is a specific thing, so "tarefa" is not used for housework in general.
