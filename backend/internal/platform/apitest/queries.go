package apitest

import (
	"context"
	"sync/atomic"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// queryCounter is a pgx.QueryTracer that counts the statements the API sends
// to Postgres.
type queryCounter struct{ n atomic.Int64 }

func (q *queryCounter) TraceQueryStart(ctx context.Context, _ *pgx.Conn, _ pgx.TraceQueryStartData) context.Context {
	q.n.Add(1)
	return ctx
}

func (q *queryCounter) TraceQueryEnd(context.Context, *pgx.Conn, pgx.TraceQueryEndData) {}

func (q *queryCounter) trace(cfg *pgxpool.Config) { cfg.ConnConfig.Tracer = q }

// QueriesFor runs fn and returns how many statements the API ran meanwhile.
// The auth and membership lookups of each request count, so compare two runs
// of the same route, not a number with a literal. Tests running fn must not
// issue other requests concurrently.
func (a *App) QueriesFor(fn func()) int {
	a.queries.n.Store(0)
	fn()
	return int(a.queries.n.Load())
}
