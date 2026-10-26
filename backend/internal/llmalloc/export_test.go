package llmalloc

// Test-only views of the price table.

const MaxTokensCap = maxTokensCap

func Prices() map[string]Price { return prices }

func EstimateCostWith(table map[string]Price, u *Usage) (int64, bool) { return estimateCost(table, u) }
