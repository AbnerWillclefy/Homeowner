# Read grocery receipts from SEFAZ, with an AI-read photo as a confirmed fallback

The Pantry (#776) is fed by NFC-e receipts. The data exists in three places: the state SEFAZ public consultation pages (free, HTML, one host per state, some geo-blocked or captcha-protected), paid NFC-e APIs (structured and reliable, but billed per lookup or monthly), and the paper receipt itself. The budget is under $20 a month with nothing billing while idle ([ADR 0002](0002-mirror-the-work-stack.md)). The `llmalloc` package keeps models blind to User data; the Categorizer ([ADR 0019](0019-take-bank-data-from-pluggy-with-per-user-credentials-encrypted-by-the-app.md)) and voice ([ADR 0020](0020-voice-commands-send-chore-titles-and-the-residents-words-behind-a-confirmation.md)) are its only exceptions.

## Decision

- **The API reads the SEFAZ page itself.** The host comes from a fixed table in Go keyed by the state code (cUF) in the first two digits of the access key. A URL the User supplies is never fetched as given, which closes SSRF. We parse the HTML with a fixture-tested parser per state and accept that it breaks when a state redesigns its page. When it breaks, the User falls back to the photo.
- **When SEFAZ cannot be read, the User may send a receipt photo to Anthropic** through `llmalloc.ReceiptReader`. This is a third exception to the model's blindness, with these limits:
  - The photo goes to the model and nowhere else. It is never stored or logged.
  - The model answers through a tool schema only. Go keeps the store, date, total and lines, validates them, and drops anything else, the consumer's CPF included.
  - Nothing is saved until the User confirms the draft, so a misread or an injected instruction printed on paper can at most propose lines the User corrects or declines.
  - Calls are capped per User per day (`finance_pantry_photo_calls`) and recorded in `llm_call_events` as `receipt`, with ids, numbers and fixed vocabulary only.

## Alternatives rejected

- **A paid NFC-e API:** it bills monthly or per lookup and adds a vendor and a secret. We keep it as the move if scraping proves too fragile.
- **Photo only:** it costs a model call on every trip, and its reads are less exact than the tax authority's own data.
- **Fetching SEFAZ from the browser:** CORS forbids it.
- **Running a headless browser for JavaScript-rendered states:** it does not fit Lambda's size or our cost.

## Consequences

- A new kind of failure: a state's page changes and receipts from it stop importing until the parser is fixed. The photo keeps the feature usable meanwhile.
- Receipt photos (store, products, prices) now reach Anthropic for Users who use the fallback. They share the Anthropic monthly spend limit with the allocator, voice and the Categorizer, bounded by the daily cap.
- Supporting a new state is a host entry plus a fixture.
