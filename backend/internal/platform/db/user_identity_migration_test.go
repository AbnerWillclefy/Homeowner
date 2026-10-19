package db_test

import (
	"context"
	"strings"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/db"
)

// The CHECKs are the last guard behind Go's validation: the database must
// reject what Go would have refused.
func TestUserIdentityChecksRejectBadNamesAndPhotoKeys(t *testing.T) {
	t.Parallel()
	pool, err := db.Connect(context.Background(), apitest.NewMigratedDatabase(t), 0)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	ctx := context.Background()
	if _, err := pool.Exec(ctx, `INSERT INTO users (cognito_sub, email, created_at, updated_at)
		VALUES ('s', 'a@example.com', now(), now())`); err != nil {
		t.Fatal(err)
	}

	set := func(column, value string) error {
		_, err := pool.Exec(ctx, `UPDATE users SET `+column+` = $1`, value)
		return err
	}
	for _, c := range []struct {
		column, value string
		ok            bool
	}{
		{"display_name", " Abner", false},
		{"display_name", "Abner ", false},
		{"display_name", "", false},
		{"display_name", strings.Repeat("a", 41), false},
		{"display_name", strings.Repeat("a", 40), true},
		{"display_name", strings.Repeat("😀", 40), true},
		{"photo_key", "avatars/" + strings.Repeat("a", 22) + ".webp", true},
		{"photo_key", "avatars/" + strings.Repeat("a", 22) + ".jpg", true},
		{"photo_key", "avatars/short.webp", false},
		{"photo_key", "other/" + strings.Repeat("a", 22) + ".webp", false},
		{"photo_key", "avatars/" + strings.Repeat("a", 22) + ".png", false},
		{"photo_key", "avatars/../" + strings.Repeat("a", 22) + ".webp", false},
	} {
		if err := set(c.column, c.value); (err == nil) != c.ok {
			t.Errorf("%s = %q: err = %v, want accepted %v", c.column, c.value, err, c.ok)
		}
	}
}
