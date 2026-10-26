package llmalloc

// Price is what a model costs, in micro-USD (millionths of a dollar) per
// million tokens. A price in dollars per MTok times 1_000_000.
type Price struct {
	InputMicroUSDPerMTok  int64
	OutputMicroUSDPerMTok int64
}

// prices maps the model id the client is configured with (LLM_MODEL) to its
// price.
//
// Read from https://platform.claude.com/docs/en/about-claude/pricing on
// 2026-10-26 (base input and output tokens, standard pricing). Update the
// table and this date together when Anthropic changes its prices or the
// default model changes; TestTheDefaultModelHasAPrice fails when the default
// model is missing.
//
//   - claude-haiku-5-5: $0.10 in, $0.50 out per MTok, for prompts up to
//     100,000 tokens. Longer prompts are billed higher ($0.50 / $2.50); ours
//     are a few thousand tokens, so the table holds the short-prompt price.
//   - claude-sonnet-5-5: $2 in, $10 out per MTok.
//
// Adaptive thinking tokens are billed as output tokens and are already inside
// output_tokens. No prompt caching is used, so cache-write and cache-read
// prices are not needed.
var prices = map[string]Price{
	"claude-haiku-5-5":  {InputMicroUSDPerMTok: 100_000, OutputMicroUSDPerMTok: 500_000},
	"claude-sonnet-5-5": {InputMicroUSDPerMTok: 2_000_000, OutputMicroUSDPerMTok: 10_000_000},
}

// EstimateCostMicroUSD is the estimated cost of one call in micro-USD:
// (input tokens * input price + output tokens * output price) / 1_000_000,
// rounded half up once on the total. ok is false, never a zero cost, when
// there is no usage or the model has no price: an unknown cost is not a free
// one.
func EstimateCostMicroUSD(u *Usage) (cost int64, ok bool) { return estimateCost(prices, u) }

func estimateCost(table map[string]Price, u *Usage) (int64, bool) {
	if u == nil {
		return 0, false
	}
	p, known := table[u.Model]
	if !known {
		return 0, false
	}
	// Tokens are bounded by the context window (millions) and prices by a few
	// tens of millions of micro-USD, far below int64.
	total := u.InputTokens*p.InputMicroUSDPerMTok + u.OutputTokens*p.OutputMicroUSDPerMTok
	return (total + 500_000) / 1_000_000, true
}
