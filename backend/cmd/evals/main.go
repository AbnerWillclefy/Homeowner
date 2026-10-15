// Command evals compares the LLM allocator with the baseline on a dataset of
// synthetic days and prints a table. It spends real money, so it is a manual
// tool: `go test` and CI never run a main package, and it calls the model only
// when ANTHROPIC_API_KEY is set.
//
//	cd backend && ANTHROPIC_API_KEY=... go run ./cmd/evals [flags]
//
// Flags: -dir (days folder), -runs (model calls per day), -model, -timeout (per
// call), -concurrency (calls at once, default 4), -baseline-only, -v (per-day
// rows), -yes (allow more than 100 calls).
// The model defaults to LLM_MODEL, then to the production default. The key is
// read from the environment only. The exit status is 0 whatever the numbers
// say: it is a report, not a gate. See docs/architecture/allocation.md.
package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/evals"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/config"
)

// maxCalls is how many model calls run without -yes.
const maxCalls = 100

func main() {
	newClient := func(key, model string) llmalloc.Client { return llmalloc.NewAnthropic(key, model) }
	if err := run(context.Background(), os.Args[1:], os.Getenv, os.Stdout, os.Stderr, newClient); err != nil {
		fmt.Fprintln(os.Stderr, "evals:", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, args []string, getenv func(string) string, stdout, stderr io.Writer,
	newClient func(key, model string) llmalloc.Client) error {
	model := getenv("LLM_MODEL")
	if model == "" {
		model = config.DefaultLLMModel
	}
	fs := flag.NewFlagSet("evals", flag.ContinueOnError)
	fs.SetOutput(stderr)
	dir := fs.String("dir", "internal/evals/testdata/days", "folder of day JSON files")
	runs := fs.Int("runs", 3, "model calls per day")
	fs.StringVar(&model, "model", model, "model name (default LLM_MODEL, then the production default)")
	concurrency := fs.Int("concurrency", evals.DefaultConcurrency, "model calls at once")
	timeout := fs.Duration("timeout", config.DefaultLLMTimeout, "time limit of one model call")
	baselineOnly := fs.Bool("baseline-only", false, "skip the model")
	verbose := fs.Bool("v", false, "print a row per day and run")
	yes := fs.Bool("yes", false, fmt.Sprintf("allow more than %d model calls", maxCalls))
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *runs < 1 {
		return fmt.Errorf("-runs must be at least 1")
	}

	days, err := evals.LoadDir(*dir)
	if err != nil {
		return err
	}

	cfg := evals.Config{Runs: *runs, Timeout: *timeout, Model: model, Concurrency: *concurrency}
	key := getenv("ANTHROPIC_API_KEY")
	if key != "" && !*baselineOnly {
		calls := len(days) * *runs
		fmt.Fprintf(stderr, "%d model calls (%d days x %d runs) with %s\n", calls, len(days), *runs, model)
		if calls > maxCalls && !*yes {
			return fmt.Errorf("%d calls is above the cap of %d; pass -yes to go on", calls, maxCalls)
		}
		cfg.Proposer = llmalloc.New(newClient(key, model))
	}

	start := time.Now()
	report := evals.Run(ctx, days, cfg)
	fmt.Fprintf(stderr, "done in %s\n", time.Since(start).Round(time.Millisecond))
	return evals.Render(stdout, report, *verbose)
}
