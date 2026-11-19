package pantry

import (
	"context"
	"errors"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/nfce"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	errNotFound  = errors.New("pantry: item not found")
	errNameTaken = errors.New("pantry: name taken")
	errNotRanOut = errors.New("pantry: item not ran out")
)

// Store keeps the Pantry: items, run-outs, receipts with their lines, and saved
// line matches. Every query is scoped to the User, by user_id or by an id
// already read under it.
type Store struct {
	db *pgxpool.Pool
}

// NewStore returns a Store over db.
func NewStore(db *pgxpool.Pool) *Store { return &Store{db: db} }

// latestPurchase is the newest issue date of a receipt line matched to item i.
const latestPurchase = `(SELECT max(rc.issued_on) FROM finance_pantry_receipt_lines l
	        JOIN finance_pantry_receipts rc ON rc.id = l.receipt_id WHERE l.item_id = i.id)`

const selectItem = `
	SELECT i.id, i.name, i.preferred_brand, i.fixed,
	       (SELECT max(r.ran_out_on) FROM finance_pantry_run_outs r WHERE r.item_id = i.id),
	       ` + latestPurchase + `
	FROM finance_pantry_items i WHERE i.user_id = $1`

func scanItem(row pgx.Row) (Item, error) {
	var it Item
	var ranOut, purchase *time.Time
	if err := row.Scan(&it.ID, &it.Name, &it.PreferredBrand, &it.Fixed, &ranOut, &purchase); err != nil {
		return Item{}, err
	}
	it.State = StateOf(purchase, ranOut)
	if it.State == RanOut {
		day := ranOut.Format(time.DateOnly)
		it.RanOutOn = &day
	}
	return it, nil
}

// purchase is one receipt line matched to an item.
type purchase struct {
	issuedOn       time.Time
	quantityMilli  int64
	unit           string
	unitPriceCents int64
	storeName      string
}

// facts is an item with what its purchases and run-outs say about it. The
// purchases run newest first, ties by receipt then line number.
type facts struct {
	Item
	purchases []purchase
	runOuts   []time.Time
}

// loadFacts reads the User's items (or the one in only, when set) in three
// queries, however many items there are.
func (s *Store) loadFacts(ctx context.Context, userID string, only *string) ([]facts, error) {
	rows, err := s.db.Query(ctx, selectItem+` AND ($2::uuid IS NULL OR i.id = $2::uuid) ORDER BY lower(i.name), i.id`, userID, only)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []facts
	at := map[string]int{}
	for rows.Next() {
		it, err := scanItem(rows)
		if err != nil {
			return nil, err
		}
		at[it.ID] = len(out)
		out = append(out, facts{Item: it})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()
	prows, err := s.db.Query(ctx, `
		SELECT l.item_id, rc.issued_on, l.quantity_milli, l.unit, l.unit_price_cents, rc.store_name
		FROM finance_pantry_receipt_lines l JOIN finance_pantry_receipts rc ON rc.id = l.receipt_id
		WHERE l.user_id = $1 AND l.item_id IS NOT NULL AND ($2::uuid IS NULL OR l.item_id = $2::uuid)
		ORDER BY rc.issued_on DESC, rc.id, l.line_no`, userID, only)
	if err != nil {
		return nil, err
	}
	defer prows.Close()
	for prows.Next() {
		var id string
		var p purchase
		if err := prows.Scan(&id, &p.issuedOn, &p.quantityMilli, &p.unit, &p.unitPriceCents, &p.storeName); err != nil {
			return nil, err
		}
		i, ok := at[id]
		if !ok {
			continue // created after the items were read
		}
		out[i].purchases = append(out[i].purchases, p)
	}
	if err := prows.Err(); err != nil {
		return nil, err
	}
	rrows, err := s.db.Query(ctx, `SELECT item_id, ran_out_on FROM finance_pantry_run_outs
		WHERE user_id = $1 AND ($2::uuid IS NULL OR item_id = $2::uuid)`, userID, only)
	if err != nil {
		return nil, err
	}
	defer rrows.Close()
	for rrows.Next() {
		var id string
		var d time.Time
		if err := rrows.Scan(&id, &d); err != nil {
			return nil, err
		}
		i, ok := at[id]
		if !ok {
			continue // created after the items were read
		}
		out[i].runOuts = append(out[i].runOuts, d)
	}
	if err := rrows.Err(); err != nil {
		return nil, err
	}
	for i := range out {
		f := &out[i]
		dates := make([]time.Time, len(f.purchases))
		for j, p := range f.purchases {
			dates[j] = p.issuedOn
		}
		f.AvgDurationDays = AvgDuration(dates, f.runOuts)
		if len(f.purchases) > 0 {
			f.LastPriceCents = &f.purchases[0].unitPriceCents
		}
	}
	return out, nil
}

// List returns the User's items ordered by name.
func (s *Store) List(ctx context.Context, userID string) ([]Item, error) {
	fs, err := s.loadFacts(ctx, userID, nil)
	if err != nil {
		return nil, err
	}
	out := make([]Item, len(fs))
	for i, f := range fs {
		out[i] = f.Item
	}
	return out, nil
}

func (s *Store) get(ctx context.Context, userID, id string) (Item, error) {
	f, err := s.detail(ctx, userID, id)
	return f.Item, err
}

func (s *Store) detail(ctx context.Context, userID, id string) (facts, error) {
	fs, err := s.loadFacts(ctx, userID, &id)
	if err != nil {
		return facts{}, err
	}
	if len(fs) == 0 {
		return facts{}, errNotFound
	}
	return fs[0], nil
}

// ShoppingList builds the next list from the items and the User's edits of it.
func (s *Store) ShoppingList(ctx context.Context, userID string) ([]ListRow, int64, error) {
	fs, err := s.loadFacts(ctx, userID, nil)
	if err != nil {
		return nil, 0, err
	}
	type edit struct {
		qty     *int64
		removed bool
	}
	edits := map[string]edit{}
	rows, err := s.db.Query(ctx, `SELECT item_id, quantity_milli, removed FROM finance_pantry_list_edits WHERE user_id = $1`, userID)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		var e edit
		if err := rows.Scan(&id, &e.qty, &e.removed); err != nil {
			return nil, 0, err
		}
		edits[id] = e
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	in := make([]ListInput, len(fs))
	for i, f := range fs {
		e := edits[f.ID]
		in[i] = ListInput{ItemID: f.ID, Name: f.Name, PreferredBrand: f.PreferredBrand, Fixed: f.Fixed, State: f.State, EditQuantityMilli: e.qty, Removed: e.removed}
		if len(f.purchases) > 0 {
			p := f.purchases[0]
			in[i].Unit, in[i].LastQuantityMilli, in[i].LastUnitPriceCents = p.unit, &p.quantityMilli, &p.unitPriceCents
		}
	}
	list, total := BuildList(in)
	return list, total, nil
}

// EditList records a change to the item's list row: a quantity, or removal.
// It lasts until a receipt line matches the item. errNotFound for another
// User's item.
func (s *Store) EditList(ctx context.Context, userID, id string, qty *int64, removed bool, now time.Time) error {
	tag, err := s.db.Exec(ctx, `
		INSERT INTO finance_pantry_list_edits (user_id, item_id, quantity_milli, removed, updated_at)
		SELECT $1, i.id, $3::bigint, $4::boolean, $5 FROM finance_pantry_items i WHERE i.id = $2 AND i.user_id = $1
		ON CONFLICT (user_id, item_id) DO UPDATE SET
			quantity_milli = COALESCE($3::bigint, finance_pantry_list_edits.quantity_milli),
			removed = finance_pantry_list_edits.removed OR $4::boolean, updated_at = $5`,
		userID, id, qty, removed, now)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errNotFound
	}
	return nil
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

// itemPurchase is the item's latest purchase, $2 being its id: a receipt line
// matched to it. A run-out counts only after it.
const itemPurchase = `(SELECT max(rc.issued_on) FROM finance_pantry_receipt_lines l
	JOIN finance_pantry_receipts rc ON rc.id = l.receipt_id WHERE l.item_id = $2)`

// RunOut records the day unless the item already ran out: a run-out after its
// latest purchase, or any run-out when it has none.
func (s *Store) RunOut(ctx context.Context, userID, id string, day, now time.Time) error {
	return s.inLockedItem(ctx, userID, id, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `
			INSERT INTO finance_pantry_run_outs (id, user_id, item_id, ran_out_on, created_at)
			SELECT gen_random_uuid(), $1, $2, $3, $4
			WHERE NOT EXISTS (SELECT 1 FROM finance_pantry_run_outs WHERE item_id = $2
				AND ran_out_on > coalesce(`+itemPurchase+`, '-infinity'))`, userID, id, day, now)
		return err
	})
}

// UndoRunOut removes the latest run-out, only while the item is ran out (the
// run-out is after its latest purchase), so an undo never deletes a run-out
// that ended a past cycle.
func (s *Store) UndoRunOut(ctx context.Context, userID, id string) error {
	return s.inLockedItem(ctx, userID, id, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `
			DELETE FROM finance_pantry_run_outs WHERE user_id = $1 AND id = (
				SELECT id FROM finance_pantry_run_outs WHERE item_id = $2
				AND ran_out_on > coalesce(`+itemPurchase+`, '-infinity')
				ORDER BY ran_out_on DESC, created_at DESC LIMIT 1)`, userID, id)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return errNotRanOut
		}
		return nil
	})
}

// Receipt reads.

func (s *Store) receiptQ(ctx context.Context, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
	Query(context.Context, string, ...any) (pgx.Rows, error)
}, userID, where string, arg any) (Receipt, error) {
	var r Receipt
	var issued time.Time
	err := q.QueryRow(ctx, `SELECT id, store_name, issued_on, total_cents, read_by FROM finance_pantry_receipts
		WHERE user_id = $1 AND `+where, userID, arg).Scan(&r.ID, &r.StoreName, &issued, &r.TotalCents, &r.ReadBy)
	if errors.Is(err, pgx.ErrNoRows) {
		return Receipt{}, errNotFound
	}
	if err != nil {
		return Receipt{}, err
	}
	r.IssuedOn = issued.Format(time.DateOnly)
	rows, err := q.Query(ctx, `
		SELECT line_no, description, quantity_milli, unit, unit_price_cents, total_cents, item_id, ignored
		FROM finance_pantry_receipt_lines WHERE receipt_id = $1 ORDER BY line_no`, r.ID)
	if err != nil {
		return Receipt{}, err
	}
	defer rows.Close()
	r.Lines = []ReceiptLine{}
	for rows.Next() {
		var l ReceiptLine
		if err := rows.Scan(&l.N, &l.Description, &l.QuantityMilli, &l.Unit, &l.UnitPriceCents, &l.TotalCents, &l.ItemID, &l.Ignored); err != nil {
			return Receipt{}, err
		}
		r.Lines = append(r.Lines, l)
	}
	return r, rows.Err()
}

// ReceiptByKey returns the User's receipt with this access key, or errNotFound.
func (s *Store) ReceiptByKey(ctx context.Context, userID, key string) (Receipt, error) {
	return s.receiptQ(ctx, s.db, userID, "access_key = $2", key)
}

// AddReceipt saves the receipt with its lines, matching each line to the
// User's saved matches. A receipt already saved under key (two taps racing)
// is returned with created false and nothing written.
func (s *Store) AddReceipt(ctx context.Context, userID, key string, rc nfce.Receipt, now time.Time) (r Receipt, created bool, err error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return Receipt{}, false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var id string
	err = tx.QueryRow(ctx, `
		INSERT INTO finance_pantry_receipts (id, user_id, access_key, store_name, store_cnpj, issued_on, total_cents, read_by, created_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'sefaz', $7)
		ON CONFLICT (user_id, access_key) DO NOTHING RETURNING id`,
		userID, key, rc.StoreName, rc.CNPJ, rc.IssuedOn, rc.TotalCents, now).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		r, err = s.receiptQ(ctx, tx, userID, "access_key = $2", key)
		return r, false, err
	}
	if err != nil {
		return Receipt{}, false, err
	}
	for i, l := range rc.Lines {
		if _, err := tx.Exec(ctx, `
			INSERT INTO finance_pantry_receipt_lines (user_id, receipt_id, line_no, description, product_code, quantity_milli, unit, unit_price_cents, total_cents, line_key)
			VALUES ($1, $2, $3, $4, nullif($5, ''), $6, $7, $8, $9, $10)`,
			userID, id, i+1, l.Description, l.ProductCode, l.QuantityMilli, l.Unit, l.UnitPriceCents, l.TotalCents, LineKey(l.Description)); err != nil {
			return Receipt{}, false, err
		}
	}
	if _, err := tx.Exec(ctx, `
		UPDATE finance_pantry_receipt_lines l SET item_id = m.item_id, ignored = m.ignored
		FROM finance_pantry_line_matches m
		WHERE l.receipt_id = $1 AND m.user_id = $2 AND m.line_key = l.line_key`, id, userID); err != nil {
		return Receipt{}, false, err
	}
	if err := clearEdits(ctx, tx, userID, id); err != nil {
		return Receipt{}, false, err
	}
	r, err = s.receiptQ(ctx, tx, userID, "id = $2", id)
	if err != nil {
		return Receipt{}, false, err
	}
	return r, true, tx.Commit(ctx)
}

// clearEdits deletes the list edits of every item the receipt's lines match:
// the item was just bought, so its edit has run its course.
func clearEdits(ctx context.Context, tx pgx.Tx, userID, receiptID string) error {
	_, err := tx.Exec(ctx, `DELETE FROM finance_pantry_list_edits WHERE user_id = $1 AND item_id IN
		(SELECT item_id FROM finance_pantry_receipt_lines WHERE receipt_id = $2 AND item_id IS NOT NULL)`, userID, receiptID)
	return err
}

// MatchLine saves the User's choice for line n of the receipt, creating the
// item when asked, and applies it to every line of this receipt with the same
// key. A receipt, line or item that is not the User's is errNotFound.
func (s *Store) MatchLine(ctx context.Context, userID, receiptID string, n int, m Match, now time.Time) (Receipt, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return Receipt{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var key string
	err = tx.QueryRow(ctx, `SELECT line_key FROM finance_pantry_receipt_lines WHERE user_id = $1 AND receipt_id = $2 AND line_no = $3`,
		userID, receiptID, n).Scan(&key)
	if errors.Is(err, pgx.ErrNoRows) {
		return Receipt{}, errNotFound
	}
	if err != nil {
		return Receipt{}, err
	}
	var item *string
	switch {
	case m.Ignore:
	case m.NewItem:
		var id string
		if err := tx.QueryRow(ctx, `
			INSERT INTO finance_pantry_items (id, user_id, name, preferred_brand, created_at, updated_at)
			VALUES (gen_random_uuid(), $1, $2, $3, $4, $4) RETURNING id`, userID, m.NewName, m.NewBrand, now).Scan(&id); err != nil {
			return Receipt{}, nameTaken(err)
		}
		item = &id
	default:
		var id string
		err := tx.QueryRow(ctx, `SELECT id FROM finance_pantry_items WHERE id = $1 AND user_id = $2`, m.ItemID, userID).Scan(&id)
		if errors.Is(err, pgx.ErrNoRows) {
			return Receipt{}, errNotFound
		}
		if err != nil {
			return Receipt{}, err
		}
		item = &id
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO finance_pantry_line_matches (user_id, line_key, item_id, ignored, updated_at) VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, line_key) DO UPDATE SET item_id = $3, ignored = $4, updated_at = $5`,
		userID, key, item, m.Ignore, now); err != nil {
		return Receipt{}, err
	}
	if _, err := tx.Exec(ctx, `UPDATE finance_pantry_receipt_lines SET item_id = $4, ignored = $5
		WHERE user_id = $1 AND receipt_id = $2 AND line_key = $3`, userID, receiptID, key, item, m.Ignore); err != nil {
		return Receipt{}, err
	}
	if item != nil { // only the item just bought; other items keep their edits
		if _, err := tx.Exec(ctx, `DELETE FROM finance_pantry_list_edits WHERE user_id = $1 AND item_id = $2`, userID, *item); err != nil {
			return Receipt{}, err
		}
	}
	r, err := s.receiptQ(ctx, tx, userID, "id = $2", receiptID)
	if err != nil {
		return Receipt{}, err
	}
	return r, tx.Commit(ctx)
}
