# AI allocates behind a deterministic referee

An LLM proposes the Day Plan, because judging Preferences, turns on disliked Chores and how a Resident's week has gone is fuzzy work it does well. But some rules must hold on every Day Plan: never exceed a Resident's Energy, never break a Restriction, give two-person Tasks only when both Residents have Energy left, and respect weekday limits. A deterministic constraint checker validates every proposal, and a deterministic baseline allocator takes over when a proposal fails or the LLM is unavailable, so the app never depends on the model behaving. Evals compare both allocators on recorded days.

## Consequences

The baseline allocator and checker ship first; the LLM allocator is the first AI milestone, plugged in behind the same interface.
