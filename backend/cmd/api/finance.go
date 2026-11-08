package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/finance"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/llmalloc"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/clock"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/config"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/db"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/pluggy"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/push"
)

// financeEvents serves the finance Lambda: an HTTP server whose only work is the
// hourly scheduled event that Lambda Web Adapter forwards (docs/adr/0008). Run
// it from the same image as the API with the command `finance-events`. Without
// an encryption key there is nothing to open, so it answers and does nothing.
func financeEvents(ctx context.Context, cfg config.Config, log *slog.Logger) error {
	var syncer *finance.Syncer
	var rem *finance.Reminders
	if cfg.FinanceKey != nil {
		pool, err := db.Connect(ctx, cfg.DatabaseURL, cfg.DBMaxConns)
		if err != nil {
			return err
		}
		defer pool.Close()
		syncer = finance.NewSyncer(finance.NewStore(pool), pluggy.NewHTTP(cfg.PluggyBaseURL), cfg.FinanceKey,
			finance.NewAllowlist(cfg.FinanceAllowlist), log, finance.DefaultSyncBudget)
		// The Categorizer is step 3 of the order of decision; without a key the
		// Expenses that no correction and no Pluggy category decide stay Other.
		if cfg.AnthropicAPIKey != "" {
			syncer.WithCategorizer(llmalloc.NewCategorizer(llmalloc.NewAnthropic(cfg.AnthropicAPIKey, cfg.LLMModel)), cfg.LLMModel)
		} else {
			log.Info("categorizer off: no Anthropic key, uncategorised Expenses stay Other")
		}
		if cfg.VAPIDEnabled() {
			rem = finance.NewReminders(finance.NewStore(pool), push.NewStore(pool),
				push.NewWebPushSender(cfg.VAPIDPublicKey, cfg.VAPIDPrivateKey, cfg.VAPIDSubject),
				finance.NewAllowlist(cfg.FinanceAllowlist), log)
		} else {
			log.Warn("bill reminders off: VAPID keys are not set")
		}
	}
	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           finance.EventsHandler(syncer, rem, clock.System{}, log),
		ReadHeaderTimeout: 5 * time.Second,
	}
	errc := make(chan error, 1)
	go func() { errc <- srv.ListenAndServe() }()
	log.Info("listening for finance events", "addr", srv.Addr)

	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
