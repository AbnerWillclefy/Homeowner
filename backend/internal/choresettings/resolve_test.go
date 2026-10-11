package choresettings_test

import (
	"reflect"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/choresettings"
)

func TestResolve(t *testing.T) {
	t.Parallel()
	dishes := choresettings.Chore{Category: "kitchen", Demands: []string{"heavy_lifting", "heights"}}
	plain := choresettings.Chore{Category: "kitchen", Demands: []string{}}

	tests := []struct {
		name     string
		chore    choresettings.Chore
		general  choresettings.General
		specific choresettings.Specific
		want     choresettings.Effective
	}{
		{
			name:  "nothing set is neutral by default",
			chore: plain,
			want:  choresettings.Effective{Preference: "neutral", Source: "default", RestrictedBy: []string{}},
		},
		{
			name:     "specific dislike",
			chore:    plain,
			specific: choresettings.Specific{Preference: "dislike"},
			want:     choresettings.Effective{Preference: "dislike", Source: "specific", RestrictedBy: []string{}},
		},
		{
			name:    "general preference of the category applies",
			chore:   plain,
			general: choresettings.General{Preferences: map[string]string{"kitchen": "dislike"}},
			want:    choresettings.Effective{Preference: "dislike", Source: "general", RestrictedBy: []string{}},
		},
		{
			name:     "specific neutral beats a general dislike",
			chore:    plain,
			general:  choresettings.General{Preferences: map[string]string{"kitchen": "dislike"}},
			specific: choresettings.Specific{Preference: "neutral"},
			want:     choresettings.Effective{Preference: "neutral", Source: "specific", RestrictedBy: []string{}},
		},
		{
			name:     "specific like beats a general dislike",
			chore:    plain,
			general:  choresettings.General{Preferences: map[string]string{"kitchen": "dislike"}},
			specific: choresettings.Specific{Preference: "like"},
			want:     choresettings.Effective{Preference: "like", Source: "specific", RestrictedBy: []string{}},
		},
		{
			name:    "a general preference on another category is ignored",
			chore:   plain,
			general: choresettings.General{Preferences: map[string]string{"floors": "like"}},
			want:    choresettings.Effective{Preference: "neutral", Source: "default", RestrictedBy: []string{}},
		},
		{
			name:    "general restriction on a demand of the chore",
			chore:   dishes,
			general: choresettings.General{Restrictions: []string{"heavy_lifting"}},
			want: choresettings.Effective{Preference: "neutral", Source: "default",
				Restricted: true, RestrictedBy: []string{"heavy_lifting"}},
		},
		{
			name:    "general restrictions are listed in the chore's demand order",
			chore:   dishes,
			general: choresettings.General{Restrictions: []string{"heights", "heavy_lifting", "bending"}},
			want: choresettings.Effective{Preference: "neutral", Source: "default",
				Restricted: true, RestrictedBy: []string{"heavy_lifting", "heights"}},
		},
		{
			name:    "general restriction on a demand the chore lacks does nothing",
			chore:   plain,
			general: choresettings.General{Restrictions: []string{"heavy_lifting"}},
			want:    choresettings.Effective{Preference: "neutral", Source: "default", RestrictedBy: []string{}},
		},
		{
			name:     "specific restriction on a chore without demands",
			chore:    plain,
			specific: choresettings.Specific{Restricted: true},
			want: choresettings.Effective{Preference: "neutral", Source: "default",
				Restricted: true, RestrictedBy: []string{}, RestrictedByChore: true},
		},
		{
			name:     "specific restriction adds to the general one, both reasons shown",
			chore:    dishes,
			general:  choresettings.General{Restrictions: []string{"heights"}},
			specific: choresettings.Specific{Restricted: true},
			want: choresettings.Effective{Preference: "neutral", Source: "default",
				Restricted: true, RestrictedBy: []string{"heights"}, RestrictedByChore: true},
		},
		{
			name:     "restricted and disliked together",
			chore:    plain,
			specific: choresettings.Specific{Preference: "dislike", Restricted: true},
			want: choresettings.Effective{Preference: "dislike", Source: "specific",
				Restricted: true, RestrictedBy: []string{}, RestrictedByChore: true},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := choresettings.Resolve(tt.chore, tt.general, tt.specific)
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("Resolve = %+v, want %+v", got, tt.want)
			}
		})
	}
}
