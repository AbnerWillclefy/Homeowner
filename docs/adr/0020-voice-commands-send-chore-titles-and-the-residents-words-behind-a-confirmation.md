# Voice commands send Chore titles and the Resident's words to the LLM, behind a confirmation

Voice commands (#455) let a Resident say what to create, change, take, refuse or complete, and see it proposed before anything changes. Until now the models have been kept blind: [ADR 0004](0004-ai-allocates-behind-a-deterministic-referee.md) puts the LLM allocator behind a deterministic referee, and the rule that the model sees "opaque ids, numbers and fixed vocabulary only, never names, emails, Chore titles or any text a User typed" is written in the `llmalloc` package comment (`backend/internal/llmalloc/llmalloc.go`), not in ADR 0004 itself. The Categorizer is already one noted exception ([ADR 0019](0019-take-bank-data-from-pluggy-with-per-user-credentials-encrypted-by-the-app.md)). A voice command cannot work without the transcript and the Chore titles it refers to, so this ADR records a second exception and the limits that make it safe. The budget is still under $20 a month with nothing billing while idle ([ADR 0002](0002-mirror-the-work-stack.md)).

## Decision

- **Only `POST /home/voice/interpret` makes the exception.** It sends the model:
  - the Resident's transcript (at most 500 characters, checked at the trust boundary);
  - the caller's own Home's Chores: id, title, Category, Effort, Importance and schedule;
  - today's open Tasks of that Home: id, Chore id, and their relation to the caller (`proposed_to_you`, `committed_by_you`, `pool`, `held_by_other`).
- **Still never sent:** Energy, Restrictions, Preferences, Check-ins, Resident names or emails, and anything from another Home. A test walks the prompt's keys to hold this.
- **The server only interprets; the browser applies.** The model answers with tool calls only. Go keeps only the ids from the set it sent, drops an action left with none, turns two or more matches into candidates for the Resident to pick, validates each action with the screens' rules (`chores.Validate`), and turns it into a request to an existing endpoint. The Resident confirms in the PWA, which sends those requests one by one, and each existing endpoint authorises and validates again. Voice grants no new permission.
- **The model's free text is never shown.** The confirmation is built from stored Chore titles and the app's own i18n. The one exception is the name of a new Chore from `create_chore`: it is model text, shown in the confirmation for the Resident to check, and validated like a typed name.
- **Transcripts are neither stored nor logged.** No request-body logging, decode errors do not echo the body, and the usage log line carries tokens only. A test captures the logger to hold this.
- **Spend is bounded per Resident.** `voice_calls` counts calls per User and the Home's local date, reserved before the LLM call with one insert-or-increment statement (`DailyLimit = 20` in Go), so a failed call still counts. It is separate from `llm_calls`, so voice can never spend a Home's allocator and explanation calls. Each call is recorded in `llm_call_events` with `service = 'voice'`: ids, numbers and fixed vocabulary only, as [ADR 0017](0017-operate-through-a-separate-admin-app-per-environment.md) requires.

## Why confirmation closes prompt injection

An injected instruction, whether in the transcript or in a Chore title another Resident typed, can at most make the model propose an action the speaker could already take on their own Home's data. Go strips any id the model was not given, so it cannot reach another Home. The proposal is shown in our own words before anything changes, and then goes through the same authorisation and validation as a tap. The model has no tool that reads data, sends a message or reaches outside the Home, and its free text is never displayed. The worst an injection can do is propose something the Resident then declines.

## Alternatives rejected

- **Keep the model blind (ids only, no titles or transcript):** voice could not match "the dishes" to a Chore, so the feature could not exist.
- **The server applies the actions directly:** fewer round trips, but it removes the confirmation, which is what closes prompt injection, and it would need a second path through every endpoint's rules.
- **An MCP server or a read tool for the model:** more flexible, but it lets model output reach data or act without a Resident seeing it first.

## Consequences

- Chore titles and the transcript now reach Anthropic for Residents who use voice. Nothing else about the Home does.
- Voice shares the Anthropic monthly spend limit with the allocator; heavy use could push the allocator to its baseline late in the month. The per-Resident limit bounds it (about $1.20 a month for a fully used Home of 4) and `/admin/ai` shows it.
- A later tool that reads data, or acts without the Resident's confirmation, needs a new ADR. So does an MCP server, since it removes the confirmation step.
- Every change to the prompt is reviewed against the "still never sent" list above.
