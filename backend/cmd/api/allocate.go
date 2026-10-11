package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/clock"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/config"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/db"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/dayplan"
)

func newPlanner(ctx context.Context, cfg config.Config, log *slog.Logger) (*dayplan.Planner, func(), error) {
	pool, err := db.Connect(ctx, cfg.DatabaseURL, cfg.DBMaxConns)
	if err != nil {
		return nil, nil, err
	}
	return dayplan.New(pool, allocation.Baseline{}, log), pool.Close, nil
}

// allocate runs the Allocation job once and exits: it plans every Home whose
// Allocation time has arrived. It is the same code the scheduled tick runs, for
// a local run (`docker compose run api allocate`) or a manual catch-up.
func allocate(ctx context.Context, cfg config.Config, log *slog.Logger) error {
	p, closeDB, err := newPlanner(ctx, cfg, log)
	if err != nil {
		return err
	}
	defer closeDB()
	_, err = p.RunDue(ctx, clock.System{}.Now())
	return err
}

// events serves the Allocation job's Lambda: an HTTP server whose only route is
// the scheduled tick that Lambda Web Adapter forwards (docs/adr/0008). Run it
// from the same image as the API with the command `events`.
func events(ctx context.Context, cfg config.Config, log *slog.Logger) error {
	p, closeDB, err := newPlanner(ctx, cfg, log)
	if err != nil {
		return err
	}
	defer closeDB()

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           dayplan.EventsHandler(p, clock.System{}, log),
		ReadHeaderTimeout: 5 * time.Second,
	}
	errc := make(chan error, 1)
	go func() { errc <- srv.ListenAndServe() }()
	log.Info("listening for allocation events", "addr", srv.Addr)

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
