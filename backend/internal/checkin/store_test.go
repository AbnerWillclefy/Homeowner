package checkin_test

import (
	"errors"
	"reflect"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/checkin"
)

func TestNewValidatesAndDeduplicatesTheCheckIn(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name    string
		level   string
		demands []string
		want    checkin.CheckIn
		wantErr error
	}{
		{"no demands gives an empty, non-nil list", "normal", nil,
			checkin.CheckIn{Level: checkin.Normal, Demands: []string{}}, nil},
		{"a repeated demand is kept once, in first-seen order", "low", []string{"bending", "heights", "bending"},
			checkin.CheckIn{Level: checkin.Low, Demands: []string{"bending", "heights"}}, nil},
		{"an unknown level is refused", "tired", nil, checkin.CheckIn{}, checkin.ErrInvalidLevel},
		{"an empty level is refused", "", nil, checkin.CheckIn{}, checkin.ErrInvalidLevel},
		{"an unknown demand is refused", "normal", []string{"bending", "flying"}, checkin.CheckIn{}, checkin.ErrUnknownDemand},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, err := checkin.New(tc.level, tc.demands)
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("err = %v, want %v", err, tc.wantErr)
			}
			if !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("got %+v, want %+v", got, tc.want)
			}
		})
	}
}
