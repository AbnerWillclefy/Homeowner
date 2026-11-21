package choresettings_test

import (
	"net/http"
	"reflect"
	"testing"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
)

func responsibleOf(t *testing.T, c *apitest.Client, choreID string) any {
	t.Helper()
	m := apitest.ChoreByID(t, c, choreID)
	v, present := m["responsibleResidentId"]
	if !present {
		t.Fatalf("chore has no responsibleResidentId key: %v", m)
	}
	return v
}

func setResponsible(c *apitest.Client, choreID string, residentID any) apitest.Response {
	return c.Put("/home/chores/"+choreID+"/responsible", map[string]any{"residentId": residentID})
}

func TestSettingAndClearingAChoresResponsibleResident(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	b := apitest.ExtraResident(t, app, a, "b@example.com")
	bID := apitest.ResidentID(t, b)
	dishes := apitest.ChoreIn(t, a, "kitchen", []string{})

	if got := responsibleOf(t, a, dishes); got != nil {
		t.Fatalf("new chore responsible = %v, want null", got)
	}
	// A sets B: any Resident can set it for any Resident.
	apitest.ExpectStatus(t, setResponsible(a, dishes, bID), http.StatusNoContent)
	if got := responsibleOf(t, b, dishes); got != bID {
		t.Fatalf("after set = %v, want %s", got, bID)
	}
	apitest.ExpectStatus(t, setResponsible(a, dishes, bID), http.StatusNoContent) // idempotent
	apitest.ExpectStatus(t, b.Delete("/home/chores/"+dishes+"/responsible"), http.StatusNoContent)
	if got := responsibleOf(t, a, dishes); got != nil {
		t.Fatalf("after clear = %v, want null", got)
	}
	apitest.ExpectStatus(t, b.Delete("/home/chores/"+dishes+"/responsible"), http.StatusNoContent) // already Nobody
}

func TestSettingAResidentOutsideTheHomeIsUnknownResident(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	other := apitest.HomeWithResident(t, app, "x@example.com")
	dishes := apitest.ChoreIn(t, a, "kitchen", []string{})
	for name, id := range map[string]string{
		"resident of another home": apitest.ResidentID(t, other),
		"random uuid":              missingChoreID,
		"malformed id":             "not-a-uuid",
	} {
		r := setResponsible(a, dishes, id)
		if r.Status != http.StatusUnprocessableEntity || r.Body["error"] != "unknown_resident" {
			t.Errorf("%s: %d %s, want 422 unknown_resident", name, r.Status, r.Raw)
		}
	}
	if got := responsibleOf(t, a, dishes); got != nil {
		t.Errorf("responsible = %v, want null", got)
	}
}

func TestResponsibleBodyAndChoreErrors(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	b := apitest.HomeWithResident(t, app, "b@example.com")
	aID := apitest.ResidentID(t, a)
	dishes := apitest.ChoreIn(t, a, "kitchen", []string{})
	path := "/home/chores/" + dishes + "/responsible"

	for name, body := range map[string]any{
		"extra key":  map[string]any{"residentId": aID, "x": 1},
		"missing id": map[string]any{},
		"empty id":   map[string]any{"residentId": ""},
	} {
		if r := a.Put(path, body); r.Status != http.StatusBadRequest {
			t.Errorf("%s: %d %s, want 400", name, r.Status, r.Raw)
		}
	}
	// Another Home's Chore and an unknown or malformed one are the same 404.
	for _, id := range []string{dishes, missingChoreID, "nope"} {
		if r := setResponsible(b, id, apitest.ResidentID(t, b)); r.Status != http.StatusNotFound {
			t.Errorf("PUT %s: %d %s, want 404", id, r.Status, r.Raw)
		}
		if r := b.Delete("/home/chores/" + id + "/responsible"); r.Status != http.StatusNotFound {
			t.Errorf("DELETE %s: %d %s, want 404", id, r.Status, r.Raw)
		}
	}
	if got := responsibleOf(t, a, dishes); got != nil {
		t.Errorf("responsible = %v, want null", got)
	}
}

func TestARestrictedResidentCannotBeMadeResponsible(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	b := apitest.ExtraResident(t, app, a, "b@example.com")
	bID := apitest.ResidentID(t, b)
	heavy := apitest.ChoreIn(t, a, "outdoor", []string{"heavy_lifting", "bending"})
	bare := apitest.ChoreIn(t, a, "kitchen", []string{})

	// A specific Restriction.
	apitest.ExpectStatus(t, b.Put("/home/chores/"+bare+"/restriction", nil), http.StatusNoContent)
	r := setResponsible(a, bare, bID)
	if r.Status != http.StatusUnprocessableEntity || r.Body["error"] != "responsible_restricted" ||
		r.Body["restrictedByChore"] != true || r.Body["residentId"] != bID ||
		!reflect.DeepEqual(r.Body["restrictedBy"], []any{}) {
		t.Errorf("specific: %d %s", r.Status, r.Raw)
	}
	// A general Restriction on one of its Demands.
	apitest.ExpectStatus(t, b.Put("/me/restrictions/heavy_lifting", nil), http.StatusNoContent)
	r = setResponsible(a, heavy, bID)
	if r.Status != http.StatusUnprocessableEntity || r.Body["error"] != "responsible_restricted" ||
		r.Body["restrictedByChore"] != false || !reflect.DeepEqual(r.Body["restrictedBy"], []any{"heavy_lifting"}) {
		t.Errorf("general: %d %s", r.Status, r.Raw)
	}
	for _, id := range []string{bare, heavy} {
		if got := responsibleOf(t, a, id); got != nil {
			t.Errorf("chore %s responsible = %v, want null", id, got)
		}
	}
}

func TestRestrictionsThatDoNotApplyDoNotBlockResponsibility(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	aID := apitest.ResidentID(t, a)
	dishes := apitest.ChoreIn(t, a, "kitchen", []string{"bending"})

	// A general Restriction on a Demand the Chore lacks, and a day-only one.
	apitest.ExpectStatus(t, a.Put("/me/restrictions/heights", nil), http.StatusNoContent)
	apitest.CheckIn(t, a, "low", "bending")
	apitest.ExpectStatus(t, setResponsible(a, dishes, aID), http.StatusNoContent)
	if got := responsibleOf(t, a, dishes); got != aID {
		t.Errorf("responsible = %v, want %s", got, aID)
	}
}

func TestASpecificRestrictionClearsOnlyTheRestrictedResidentsResponsibility(t *testing.T) {
	t.Parallel()
	app := apitest.Start(t)
	a := apitest.HomeWithResident(t, app, "a@example.com")
	b := apitest.ExtraResident(t, app, a, "b@example.com")
	aID, bID := apitest.ResidentID(t, a), apitest.ResidentID(t, b)
	mine := apitest.ChoreIn(t, a, "kitchen", []string{})
	theirs := apitest.ChoreIn(t, a, "kitchen", []string{})
	apitest.ExpectStatus(t, setResponsible(a, mine, aID), http.StatusNoContent)
	apitest.ExpectStatus(t, setResponsible(a, theirs, aID), http.StatusNoContent)

	// B restricting themselves changes nothing about A's responsibility.
	apitest.ExpectStatus(t, b.Put("/home/chores/"+mine+"/restriction", nil), http.StatusNoContent)
	if got := responsibleOf(t, a, mine); got != aID {
		t.Errorf("after B's restriction = %v, want %s", got, aID)
	}
	// A restricting themselves clears it, and the Restriction is saved.
	apitest.ExpectStatus(t, a.Put("/home/chores/"+mine+"/restriction", nil), http.StatusNoContent)
	if got := responsibleOf(t, a, mine); got != nil {
		t.Errorf("after own restriction = %v, want null", got)
	}
	if got := toEffective(t, myView(t, a)["chores"].(map[string]any)[mine]); !got.RestrictedByChore {
		t.Errorf("restriction not saved: %+v", got)
	}
	if got := responsibleOf(t, a, theirs); got != aID {
		t.Errorf("other chore = %v, want untouched %s", got, aID)
	}
	// Removing the Restriction restores nothing.
	apitest.ExpectStatus(t, a.Delete("/home/chores/"+mine+"/restriction"), http.StatusNoContent)
	if got := responsibleOf(t, a, mine); got != nil {
		t.Errorf("after removing = %v, want null", got)
	}
	_ = bID
}
