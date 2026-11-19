package pantry

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	errNotFound  = errors.New("pantry: item not found")
	errNameTaken = errors.New("pantry: name taken")
	errNotRanOut = errors.New("pantry: item not ran out")
)

// Store keeps the Pantry in finance_pantry_items and finance_pantry_run_outs.
// Every query is filtered by user_id.
type Store struct {
	db *pgxpool.Pool
}

// NewStore returns a Store over db.
func NewStore(db *pgxpool.Pool) *Store { return &Store{db: db} }

const selectItem = `
	SELECT i.id, i.name, i.preferred_brand, i.fixed,
	       (SELECT max(r.ran_out_on) FROM finance_pantry_run_outs r WHERE r.item_id = i.id)
	FROM finance_pantry_items i WHERE i.user_id = $1`

func scanItem(row pgx.Row) (Item, error) {
	var it Item
	var ranOut *time.Time
	if err := row.Scan(&it.ID, &it.Name, &it.PreferredBrand, &it.Fixed, &ranOut); err != nil {
		return Item{}, err
	}
	// No purchase exists yet: a later ticket passes the latest purchase date here.
	it.State = StateOf(nil, ranOut)
	if it.State == RanOut {
		day := ranOut.Format(time.DateOnly)
		it.RanOutOn = &day
	}
	return it, nil
}

// List returns the User's items ordered by name.
func (s *Store) List(ctx context.Context, userID string) ([]Item, error) {
	rows, err := s.db.Query(ctx, selectItem+` ORDER BY lower(i.name), i.id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Item{}
	for rows.Next() {
		it, err := scanItem(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, it)
	}
	return out, rows.Err()
}

func (s *Store) get(ctx context.Context, userID, id string) (Item, error) {
	it, err := scanItem(s.db.QueryRow(ctx, selectItem+` AND i.id = $2`, userID, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return Item{}, errNotFound
	}
	return it, err
}

func nameTaken(err error) error {
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.Code == "23505" {
		return errNameTaken
	}
	return err
}

// Create stores an item with no price and no purchase.
func (s *Store) Create(ctx context.Context, userID, name string, brand *string, now time.Time) (Item, error) {
	var id string
	err := s.db.QueryRow(ctx, `
		INSERT INTO finance_pantry_items (id, user_id, name, preferred_brand, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $4) RETURNING id`, userID, name, brand, now).Scan(&id)
	if err != nil {
		return Item{}, nameTaken(err)
	}
	return s.get(ctx, userID, id)
}

// Update changes the fields whose flag is set; a nil brand clears it.
func (s *Store) Update(ctx context.Context, userID, id string, p Patch, now time.Time) (Item, error) {
	tag, err := s.db.Exec(ctx, `
		UPDATE finance_pantry_items SET
			name = CASE WHEN $3 THEN $4 ELSE name END,
			preferred_brand = CASE WHEN $5 THEN $6 ELSE preferred_brand END,
			fixed = COALESCE($7, fixed), updated_at = $8
		WHERE id = $1 AND user_id = $2`,
		id, userID, p.Name != nil, p.Name, p.BrandSet, p.Brand, p.Fixed, now)
	if err != nil {
		return Item{}, nameTaken(err)
	}
	if tag.RowsAffected() == 0 {
		return Item{}, errNotFound
	}
	return s.get(ctx, userID, id)
}

// Delete removes the item; its run-outs go with it by cascade.
func (s *Store) Delete(ctx context.Context, userID, id string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM finance_pantry_items WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errNotFound
	}
	return nil
}

// inLockedItem runs fn in a transaction holding the item's row lock, so two
// taps on the same item run one after the other and each sees the last one's insert.
func (s *Store) inLockedItem(ctx context.Context, userID, id string, fn func(pgx.Tx) error) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var locked string
	err = tx.QueryRow(ctx, `SELECT id FROM finance_pantry_items WHERE id = $1 AND user_id = $2 FOR UPDATE`, id, userID).Scan(&locked)
	if errors.Is(err, pgx.ErrNoRows) {
		return errNotFound
	}
	if err != nil {
		return err
	}
	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// RunOut records the day unless the item already ran out: with no purchases
// yet, that is any run-out. #780 adds "after its latest purchase" to the condition.
func (s *Store) RunOut(ctx context.Context, userID, id string, day, now time.Time) error {
	return s.inLockedItem(ctx, userID, id, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `
			INSERT INTO finance_pantry_run_outs (id, user_id, item_id, ran_out_on, created_at)
			SELECT gen_random_uuid(), $1, $2, $3, $4
			WHERE NOT EXISTS (SELECT 1 FROM finance_pantry_run_outs WHERE item_id = $2)`, userID, id, day, now)
		return err
	})
}

// UndoRunOut removes the latest run-out, only while the item is ran out, so an
// undo never deletes a run-out that ended a past cycle.
func (s *Store) UndoRunOut(ctx context.Context, userID, id string) error {
	return s.inLockedItem(ctx, userID, id, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `
			DELETE FROM finance_pantry_run_outs WHERE id = (
				SELECT id FROM finance_pantry_run_outs WHERE item_id = $1 ORDER BY ran_out_on DESC, created_at DESC LIMIT 1)`, id)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return errNotRanOut
		}
		return nil
	})
}
