# The finance chat sends a User's own Finances to the model through read-only tools

[ADR 0019](0019-take-bank-data-from-pluggy-with-per-user-credentials-encrypted-by-the-app.md) sends Anthropic only an Expense's `merchant_key`. [ADR 0020](0020-voice-commands-send-chore-titles-and-the-residents-words-behind-a-confirmation.md) sends Chore titles and a transcript, and says a tool that reads data needs a new ADR. The finance chat (#791) answers questions such as "Can I travel in March?", which cannot be answered without amounts, dates and descriptions, so this ADR makes a third exception and records its limits. It amends neither ADR 0019 nor ADR 0020: both stay as written, and this one adds a bounded exception to the rule they share. The budget is still under $20 a month with nothing billing while idle ([ADR 0002](0002-mirror-the-work-stack.md)).

## Decision

- **Only `POST /me/finance/chat` makes the exception, and only for Users on the finance allowlist.** The model reads the caller's own Finances through a fixed set of read-only tools that return what the GET routes already compute. The user id comes from the token, never from the model. No tool writes, sends or reaches outside the caller's Finances.
- **Sent:**
  - Transaction descriptions, merchants, amounts, dates and Spending Categories;
  - Source display names, bank names, and the bank card names that past card bills carry;
  - Notes, and the names of Goals, Bills and Investments, as the User typed them. The risk is that a User may type a person's name ("Diarista Maria"); it is accepted, as it is for Notes;
  - today's date in São Paulo, which the system prompt carries so the model can resolve "this month";
  - the screen key, the locale and the conversation.
- **Never sent:**
  - A description holding a transfer word (PIX, TED, DOC, TRANSF…) goes as a fixed label such as "Pix sent", "Pix received" or "TED sent", whatever the Transaction's type, because a Pix paid to a person can be an Expense. The check runs after the same normalisation the Categorizer uses (`finance.MerchantKey`, then `llmalloc.Sendable`). `Sendable` alone matches whole uppercase words only, so "Pix enviado - Maria" or "PIX*MARIA" would pass without it.
  - A Manual card goes as "Manual card N", without its Pix recipient.
  - No credential, no Pluggy id, no Items or connection status and no bill suggestions.
  - No Pantry data, nothing from another User and nothing from any Home.
  - Row ids.
  - A test walks every request the model receives to hold this list.
- **Nothing is kept.** The browser holds the conversation, at most 12 messages, and sends it with each question. Questions, answers and tool results are neither stored nor logged: no request-body logging, decode errors do not echo the body, and a test captures the logger. `finance_chat_calls` holds counts only, and `llm_call_events` rows with `service = 'chat'` hold ids, numbers and fixed vocabulary only ([ADR 0017](0017-operate-through-a-separate-admin-app-per-environment.md)).
- **Spend is bounded per User.** 20 questions a day by São Paulo date, each reserved before its first model call, so a failed question still counts; at most 4 tool rounds and 20 s per question. The model `claude-haiku-5-5` and the 20 a day are starting values, confirmed against measured cost in the backend ticket (#796). The count is separate from the Categorizer's and voice's, so none spends another's allowance.
- **The answer is the model's free text, shown as plain text.** It is advisory: no tool acts, and the prompt forbids recommending specific financial products. Pantry questions are out of scope.

## Why there is no referee

[ADR 0004](0004-ai-allocates-behind-a-deterministic-referee.md) puts a referee behind every model decision, but a referee checks a proposal against rules, and free text has none. What closes prompt injection here is structural. Every tool is read-only and scoped to the caller, so an instruction hidden in a bank description can at most change what the caller is told about their own data. The model has nothing to send or change, and plain-text rendering means no link or image is fetched by the browser. A wrong answer is the accepted residual risk.

## Alternatives rejected

- **A precomputed snapshot in one call, with no tools:** one round and cheaper on simple questions, but it sends every figure on every question and cannot reach past months or Transactions on demand.
- **Keeping the model blind (aggregates only, no descriptions):** it could not answer "where did I spend most".
- **Storing conversations:** out of scope, and it would put model text about money in the database.
- **Labelling Bill and Investment names:** safer against a typed person's name, but the model could no longer say which Bill is due.

## Consequences

- Descriptions, amounts, dates, Notes and the names of Sources, Goals, Bills and Investments now reach Anthropic for Users who use the chat. Nothing else does.
- The chat shares the Anthropic monthly spend limit with the allocator; the per-User limit bounds it and `/admin/ai` shows its share.
- Every change to the tool table, the prompt or `redact` is reviewed against the "Never sent" list.
- A tool that writes, or that reads outside the caller's Finances, needs a new ADR.
