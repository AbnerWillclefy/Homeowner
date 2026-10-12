package server_test

import (
	"context"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/apitest"
)

func TestTheRunRecordsTheCheckInLevelAndKeepsItsReasonsConsistent(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	me := homeWithResident(t, app, "a@example.com")
	setBaseline(t, me, map[string]any{"monday": 5})
	app.Clock.Set(mondayAt(6))
	createChore(t, me, chore("Dishes", 7, 2, "normal", []string{}))
	createChore(t, me, chore("Mop", 7, 2, "normal", []string{}))
	app.Clock.Set(mondayAt(7))
	app.RunAllocation(t)
	checkIn(t, me, "low")

	var level string
	var energy, assigned, pooled, rows int
	err := app.DB.QueryRow(context.Background(), `
		SELECT reasons -> 'levels' ->> (SELECT id::text FROM residents),
		       (reasons -> 'energy' ->> (SELECT id::text FROM residents))::int,
		       jsonb_array_length(reasons -> 'assigned'), jsonb_array_length(reasons -> 'pool'),
		       (SELECT count(*) FROM day_plan_assignments)
		FROM allocation_runs`).Scan(&level, &energy, &assigned, &pooled, &rows)
	if err != nil {
		t.Fatal(err)
	}
	if level != "low" || energy != 2 || assigned != 1 || pooled != 1 || rows != 1 {
		t.Fatalf("level=%s energy=%d assigned=%d pooled=%d rows=%d", level, energy, assigned, pooled, rows)
	}
}
