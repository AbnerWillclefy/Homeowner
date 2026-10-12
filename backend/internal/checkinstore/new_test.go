package checkinstore_test

import (
	"errors"
	"reflect"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/checkin"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/checkinstore"
)

func TestNewValidatesAndDeduplicatesTheCheckIn(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name    string
		level   string
		demands []string
		want    checkinstore.CheckIn
		wantErr error
	}{
		{"no demands gives an empty, non-nil list", "normal", nil,
			checkinstore.CheckIn{Level: checkin.Normal, Demands: []string{}}, nil},
		{"a repeated demand is kept once, in first-seen order", "low", []string{"bending", "heights", "bending"},
			checkinstore.CheckIn{Level: checkin.Low, Demands: []string{"bending", "heights"}}, nil},
		{"an unknown level is refused", "tired", nil, checkinstore.CheckIn{}, checkinstore.ErrInvalidLevel},
		{"an empty level is refused", "", nil, checkinstore.CheckIn{}, checkinstore.ErrInvalidLevel},
		{"an unknown demand is refused", "normal", []string{"bending", "flying"}, checkinstore.CheckIn{}, checkinstore.ErrUnknownDemand},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, err := checkinstore.New(tc.level, tc.demands)
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("err = %v, want %v", err, tc.wantErr)
			}
			if !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("got %+v, want %+v", got, tc.want)
			}
		})
	}
}
