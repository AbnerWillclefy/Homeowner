package finance

import (
	"bytes"
	"errors"
	"testing"
)

func testKey(b byte) *[32]byte {
	var k [32]byte
	for i := range k {
		k[i] = b
	}
	return &k
}

func TestSealOpen(t *testing.T) {
	key := testKey(1)
	blob, err := Seal(key, "user-1", FieldClientID, []byte("my-client-id"))
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(blob, []byte("my-client-id")) {
		t.Fatal("blob contains the plaintext")
	}

	cases := []struct {
		name    string
		key     *[32]byte
		user    string
		field   string
		blob    []byte
		wantErr bool
	}{
		{"round trip", key, "user-1", FieldClientID, blob, false},
		{"another user", key, "user-2", FieldClientID, blob, true},
		{"fields swapped", key, "user-1", FieldClientSecret, blob, true},
		{"wrong key", testKey(2), "user-1", FieldClientID, blob, true},
		{"empty", key, "user-1", FieldClientID, nil, true},
		{"too short", key, "user-1", FieldClientID, blob[:1+12+15], true},
		{"unknown version", key, "user-1", FieldClientID, append([]byte{9}, blob[1:]...), true},
	}
	for _, tc := range cases {
		got, err := Open(tc.key, tc.user, tc.field, tc.blob)
		if tc.wantErr {
			if !errors.Is(err, ErrOpen) || got != nil {
				t.Errorf("%s: got %q, %v; want ErrOpen", tc.name, got, err)
			}
			continue
		}
		if err != nil || string(got) != "my-client-id" {
			t.Errorf("%s: got %q, %v", tc.name, got, err)
		}
	}
}

func TestOpenRefusesAnyFlippedByte(t *testing.T) {
	key := testKey(1)
	blob, _ := Seal(key, "u", FieldClientSecret, []byte("secret"))
	for i := range blob {
		bad := bytes.Clone(blob)
		bad[i] ^= 1
		if _, err := Open(key, "u", FieldClientSecret, bad); !errors.Is(err, ErrOpen) {
			t.Errorf("byte %d flipped: err = %v, want ErrOpen", i, err)
		}
	}
}

func TestSealIsFreshEachTime(t *testing.T) {
	a, _ := Seal(testKey(1), "u", FieldClientID, []byte("x"))
	b, _ := Seal(testKey(1), "u", FieldClientID, []byte("x"))
	if bytes.Equal(a, b) {
		t.Fatal("two seals of the same plaintext are identical")
	}
	if a[0] != KeyVersion {
		t.Errorf("version byte = %d", a[0])
	}
}
