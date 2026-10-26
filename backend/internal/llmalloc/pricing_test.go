package llmalloc_test

import (
	"math"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/config"
)

// Guard: the model the app runs by default must be priced, or its calls would
// be recorded without a cost.
func TestTheDefaultModelHasAPrice(t *testing.T) {
	cost, ok := llmalloc.EstimateCostMicroUSD(&llmalloc.Usage{Model: config.DefaultLLMModel, InputTokens: 1_000_000, OutputTokens: 1_000_000})
	if !ok || cost <= 0 {
		t.Fatalf("%s: cost = %d, ok = %v; add it to the price table", config.DefaultLLMModel, cost, ok)
	}
}

func TestAnUnknownModelHasNoEstimate(t *testing.T) {
	if cost, ok := llmalloc.EstimateCostMicroUSD(&llmalloc.Usage{Model: "claude-nonesuch", InputTokens: 1000, OutputTokens: 1000}); ok || cost != 0 {
		t.Fatalf("cost = %d, ok = %v, want unknown", cost, ok)
	}
}

func TestNoUsageHasNoEstimate(t *testing.T) {
	if _, ok := llmalloc.EstimateCostMicroUSD(nil); ok {
		t.Fatal("nil usage must have no estimate")
	}
}

// Zero tokens on a known model is a real, free call: not unknown.
func TestZeroTokensOnAKnownModelCostsZero(t *testing.T) {
	cost, ok := llmalloc.EstimateCostMicroUSD(&llmalloc.Usage{Model: config.DefaultLLMModel})
	if !ok || cost != 0 {
		t.Fatalf("cost = %d, ok = %v", cost, ok)
	}
}

// Worked example with a table of our own: 2_000 in at 3_000_000 micro-USD per
// million is 6_000; 500 out at 15_000_000 is 7_500.
func TestTheCostIsTokensTimesPricePerMillion(t *testing.T) {
	prices := map[string]llmalloc.Price{"m": {InputMicroUSDPerMTok: 3_000_000, OutputMicroUSDPerMTok: 15_000_000}}
	cost, ok := llmalloc.EstimateCostWith(prices, &llmalloc.Usage{Model: "m", InputTokens: 2000, OutputTokens: 500})
	if !ok || cost != 13_500 {
		t.Fatalf("cost = %d, ok = %v, want 13500", cost, ok)
	}
}

// Rounding is half up on the total: 1 token at 500_000 is 0.5, rounds to 1;
// at 499_999 it is 0.499999, rounds to 0.
func TestTheCostRoundsHalfUp(t *testing.T) {
	for price, want := range map[int64]int64{500_000: 1, 499_999: 0, 1_500_000: 2} {
		prices := map[string]llmalloc.Price{"m": {InputMicroUSDPerMTok: price}}
		cost, ok := llmalloc.EstimateCostWith(prices, &llmalloc.Usage{Model: "m", InputTokens: 1})
		if !ok || cost != want {
			t.Errorf("price %d: cost = %d, ok = %v, want %d", price, cost, ok, want)
		}
	}
}

// A single call is bounded by its request's max tokens, and the context window
// bounds the input; the arithmetic must fit int64 for every table entry.
func TestNoPriceInTheTableCanOverflowAtTheLargestCall(t *testing.T) {
	const largestInput = 2_000_000 // far above any context window
	for model, p := range llmalloc.Prices() {
		if p.InputMicroUSDPerMTok <= 0 || p.OutputMicroUSDPerMTok <= 0 {
			t.Errorf("%s: prices must be positive: %+v", model, p)
		}
		if p.InputMicroUSDPerMTok > math.MaxInt64/largestInput || p.OutputMicroUSDPerMTok > math.MaxInt64/llmalloc.MaxTokensCap {
			t.Errorf("%s: tokens * price can overflow int64", model)
		}
	}
}
