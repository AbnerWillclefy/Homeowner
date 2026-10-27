package auth_test

import (
	"context"
	"reflect"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/auth"
)

func TestFakeSignInWithGroupsIsTheSamePersonWithAnotherToken(t *testing.T) {
	t.Parallel()
	f := auth.NewFake()

	plain := f.SignIn("a@example.com")
	admin := f.SignInWithGroups("a@example.com", "super-admin")

	if plain == admin {
		t.Fatal("tokens must differ, or one overwrites the other")
	}
	p, _ := f.Verify(context.Background(), plain)
	a, _ := f.Verify(context.Background(), admin)
	if p.Groups != nil || p.Subject != a.Subject || !reflect.DeepEqual(a.Groups, []string{"super-admin"}) {
		t.Fatalf("plain = %+v, admin = %+v", p, a)
	}
}
