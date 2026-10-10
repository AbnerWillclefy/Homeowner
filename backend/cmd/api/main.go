// Command api runs the Homeowner HTTP API. `api` (or `api serve`) serves;
// `api migrate` applies database migrations and exits.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/clock"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/config"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/db"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/server"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(os.Args[1:], log); err != nil {
		log.Error("fatal", "error", err.Error())
		os.Exit(1)
	}
}

func run(args []string, log *slog.Logger) error {
	cmd := "serve"
	if len(args) > 0 {
		cmd = args[0]
	}
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	switch cmd {
	case "migrate":
		return migrate(ctx, cfg, log)
	case "serve":
		return serve(ctx, cfg, log)
	default:
		return fmt.Errorf("unknown command %q (want serve or migrate)", cmd)
	}
}

func migrate(ctx context.Context, cfg config.Config, log *slog.Logger) error {
	log.Info("running migrations")
	if err := db.Migrate(ctx, cfg.MigrateDatabaseURL); err != nil {
		return err
	}
	log.Info("migrations complete")
	return nil
}

func serve(ctx context.Context, cfg config.Config, log *slog.Logger) error {
	if cfg.MigrateOnStart {
		if err := migrate(ctx, cfg, log); err != nil {
			return err
		}
	}
	pool, err := db.ConnectWithMaxConns(ctx, cfg.DatabaseURL, cfg.DBMaxConns)
	if err != nil {
		return err
	}
	defer pool.Close()

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           server.New(server.Deps{DB: pool, Clock: clock.System{}, Logger: log, CORSAllowedOrigins: cfg.CORSAllowedOrigins}),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	errc := make(chan error, 1)
	go func() { errc <- srv.ListenAndServe() }()
	log.Info("listening", "addr", srv.Addr)

	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}
	log.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
