package voice_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/admin"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/platform/apitest"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/voice"
)

// call is one scripted tool call of the fake model.
type call struct {
	Name  string `json:"name"`
	Input any    `json:"input"`
}

// say scripts the fake model to answer with calls.
func say(app *apitest.App, calls ...call) {
	if calls == nil {
		calls = []call{}
	}
	b, _ := json.Marshal(calls)
	app.Voice.Answer(string(b))
}

func create(in map[string]any) call { return call{"create_chore", in} }

func edit(in map[string]any) call { return call{"edit_chore", in} }

// trash is a create_chore input that passes the Chore rules.
func trash() map[string]any {
	return map[string]any{"name": "Take out the trash", "category": "kitchen", "baseEffort": 2,
		"importance": "normal", "intervalDays": 3}
}

func interpret(c *apitest.Client, transcript string) apitest.Response {
	return c.Post("/home/voice/interpret", map[string]any{"transcript": transcript, "locale": "en-US"})
}

func setup(t *testing.T) (*apitest.App, *apitest.Client) {
	t.Helper()
	app := apitest.Start(t, apitest.WithVoice())
	return app, apitest.HomeWithResident(t, app, "a@example.com")
}

func actions(t *testing.T, r apitest.Response) []any {
	t.Helper()
	a, ok := r.Body["actions"].([]any)
	if !ok {
		t.Fatalf("no actions array: %s", r.Raw)
	}
	return a
}

func voiceCalls(t *testing.T, app *apitest.App) int {
	t.Helper()
	var n int
	if err := app.DB.QueryRow(context.Background(), `SELECT COALESCE(sum(calls), 0) FROM voice_calls`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func userID(t *testing.T, c *apitest.Client) string {
	t.Helper()
	return c.Get("/me").Body["id"].(string)
}

func seed(t *testing.T, app *apitest.App, id string, calls int) {
	t.Helper()
	if _, err := app.DB.Exec(context.Background(),
		`INSERT INTO voice_calls (user_id, call_date, calls) VALUES ($1, $2, $3)`,
		id, allocation.DateOf(apitest.StartTime).Time(), calls); err != nil {
		t.Fatal(err)
	}
}

func TestCreateChoreProposesARequestTheScreensAccept(t *testing.T) {
	app, me := setup(t)
	say(app, create(trash()))

	r := interpret(me, "create a Chore: take out the trash every 3 days, normal importance")
	if r.Status != http.StatusOK || r.Body["status"] != "ok" || r.Body["remaining"] != float64(19) {
		t.Fatalf("interpret = %d %s", r.Status, r.Raw)
	}
	as := actions(t, r)
	if len(as) != 1 {
		t.Fatalf("actions = %s, want one", r.Raw)
	}
	a := as[0].(map[string]any)
	req := a["request"].(map[string]any)
	if a["kind"] != "create_chore" || a["choreName"] != "Take out the trash" || req["method"] != "POST" || req["path"] != "/home/chores" {
		t.Fatalf("action = %v", a)
	}
	if p := me.Post("/home/chores", req["body"]); p.Status != http.StatusCreated {
		t.Fatalf("POST the proposed body = %d %s, want 201", p.Status, p.Raw)
	}
	if got := len(apitest.ListChores(t, me)); got != 1 {
		t.Fatalf("chores = %d, want only the one the test created: voice never writes", got)
	}
}

func TestChoreBreakingARuleIsDropped(t *testing.T) {
	app, me := setup(t)
	bad := trash()
	bad["baseEffort"] = 9

	say(app, create(bad))
	r := interpret(me, "create a heavy chore")
	if r.Body["status"] != "nothing_understood" || len(actions(t, r)) != 0 {
		t.Fatalf("effort 9 = %s, want nothing_understood", r.Raw)
	}

	say(app, create(bad), create(trash()))
	r = interpret(me, "create two chores")
	if r.Body["status"] != "ok" || len(actions(t, r)) != 1 {
		t.Fatalf("one valid, one not = %s, want only the valid one", r.Raw)
	}
}

func TestCreateChoreFillsDefaultsTheModelLeftOut(t *testing.T) {
	app, me := setup(t)
	in := trash()
	in["people"], in["demands"], in["allowedWeekdays"] = nil, nil, nil
	say(app, create(in))

	body := actions(t, interpret(me, "trash"))[0].(map[string]any)["request"].(map[string]any)["body"].(map[string]any)
	if body["people"] != float64(1) || !reflect.DeepEqual(body["demands"], []any{}) ||
		!reflect.DeepEqual(body["allowedWeekdays"], []any{}) || body["buildsUp"] != false {
		t.Fatalf("body = %v, want the defaults", body)
	}
}

// stored creates a Chore with every field set, returning its id.
func stored(t *testing.T, me *apitest.Client, name string) string {
	t.Helper()
	return apitest.CreateChore(t, me, map[string]any{
		"name": name, "category": "bathroom", "demands": []string{"bending"},
		"baseEffort": 4, "importance": "essential", "people": 2,
		"intervalDays": 7, "allowedWeekdays": []int{2, 4}, "buildsUp": true,
	})
}

func TestEditChoreKeepsEveryFieldNotMentioned(t *testing.T) {
	app, me := setup(t)
	id := stored(t, me, "Clean bathroom")
	say(app, edit(map[string]any{"chore_ids": []string{id}, "baseEffort": 2}))

	r := interpret(me, "make the bathroom cleaning easier")
	a := actions(t, r)[0].(map[string]any)
	req := a["request"].(map[string]any)
	if a["kind"] != "edit_chore" || a["choreId"] != id || a["choreName"] != "Clean bathroom" ||
		req["method"] != "PUT" || req["path"] != "/home/chores/"+id ||
		!reflect.DeepEqual(a["changed"], []any{"baseEffort"}) {
		t.Fatalf("action = %v", a)
	}
	want := map[string]any{
		"name": "Clean bathroom", "category": "bathroom", "demands": []any{"bending"},
		"baseEffort": float64(2), "importance": "essential", "people": float64(2),
		"intervalDays": float64(7), "allowedWeekdays": []any{float64(2), float64(4)}, "buildsUp": true,
	}
	if !reflect.DeepEqual(req["body"], want) {
		t.Fatalf("body = %v, want %v", req["body"], want)
	}
	if p := me.Put("/home/chores/"+id, req["body"]); p.Status != http.StatusOK {
		t.Fatalf("PUT the proposed body = %d %s", p.Status, p.Raw)
	}
}

func TestEditChoreCanMakeItOneOffOrAnyDay(t *testing.T) {
	app, me := setup(t)
	id := stored(t, me, "Clean bathroom")

	say(app, edit(map[string]any{"chore_ids": []string{id}, "one_off": true, "allowedWeekdays": []int{}}))
	a := actions(t, interpret(me, "once, any day"))[0].(map[string]any)
	body := a["request"].(map[string]any)["body"].(map[string]any)
	if v, present := body["intervalDays"]; !present || v != nil || !reflect.DeepEqual(body["allowedWeekdays"], []any{}) ||
		!reflect.DeepEqual(a["changed"], []any{"intervalDays", "allowedWeekdays"}) {
		t.Fatalf("action = %v", a)
	}
}

func TestEditThatChangesNothingOrBreaksARuleIsDropped(t *testing.T) {
	app, me := setup(t)
	id := stored(t, me, "Clean bathroom")
	for name, in := range map[string]map[string]any{
		"same value":   {"chore_ids": []string{id}, "baseEffort": 4},
		"bad effort":   {"chore_ids": []string{id}, "baseEffort": 9},
		"bad category": {"chore_ids": []string{id}, "category": "spaceship"},
		"no ids":       {"chore_ids": []string{}, "baseEffort": 2},
	} {
		say(app, edit(in))
		if r := interpret(me, "edit"); r.Body["status"] != "nothing_understood" {
			t.Errorf("%s = %s, want nothing_understood", name, r.Raw)
		}
	}
}

func TestEditMatchingTwoChoresListsBothAsCandidates(t *testing.T) {
	app, me := setup(t)
	a, b := stored(t, me, "Clean bathroom upstairs"), stored(t, me, "Clean bathroom downstairs")
	say(app, edit(map[string]any{"chore_ids": []string{a, b, a}, "importance": "nice_to_have"}))

	got := actions(t, interpret(me, "make the bathroom nice to have"))
	if len(got) != 1 {
		t.Fatalf("actions = %v, want one", got)
	}
	act := got[0].(map[string]any)
	if act["request"] != nil || act["choreId"] != nil {
		t.Fatalf("a candidates action carries no top-level request: %v", act)
	}
	cs := act["candidates"].([]any)
	if len(cs) != 2 {
		t.Fatalf("candidates = %v, want 2 (the repeated id collapses)", cs)
	}
	for i, id := range []string{a, b} {
		c := cs[i].(map[string]any)
		if c["choreId"] != id || c["kind"] != "edit_chore" ||
			c["request"].(map[string]any)["path"] != "/home/chores/"+id ||
			c["request"].(map[string]any)["body"].(map[string]any)["importance"] != "nice_to_have" {
			t.Fatalf("candidate %d = %v", i, c)
		}
	}
}

func TestIdsOfAnotherHomeOrNeverSentAreDropped(t *testing.T) {
	app, me := setup(t)
	mine := stored(t, me, "Clean bathroom")
	other := apitest.HomeWithResident(t, app, "b@example.com")
	theirs := stored(t, other, "Secret chore of Home B")

	say(app, edit(map[string]any{"chore_ids": []string{theirs}, "baseEffort": 1}),
		edit(map[string]any{"chore_ids": []string{"5b8c4a52-3c3a-4a52-8f4f-0b7c4d1f5a11", "not-a-uuid"}, "baseEffort": 1}))
	r := interpret(me, "edit")
	if r.Body["status"] != "nothing_understood" {
		t.Fatalf("foreign and unknown ids = %s, want nothing_understood", r.Raw)
	}
	sent := app.Voice.LastRequest().User
	if strings.Contains(sent, theirs) || strings.Contains(sent, "Secret chore") || !strings.Contains(sent, mine) {
		t.Fatalf("the model saw %s: want Home A's Chore and nothing of Home B", sent)
	}

	say(app, edit(map[string]any{"chore_ids": []string{theirs, mine}, "baseEffort": 1}))
	cs := actions(t, interpret(me, "edit"))
	if len(cs) != 1 || cs[0].(map[string]any)["choreId"] != mine {
		t.Fatalf("mixed ids = %v, want only Home A's Chore", cs)
	}
}

func TestMoreThanFiveToolCallsIsTooManyAndStillCounts(t *testing.T) {
	app, me := setup(t)
	var six []call
	for range 6 {
		six = append(six, create(trash()))
	}
	say(app, six...)

	r := interpret(me, "do lots")
	if r.Status != http.StatusOK || r.Body["status"] != "too_many" || len(actions(t, r)) != 0 || r.Body["remaining"] != float64(19) {
		t.Fatalf("six calls = %s", r.Raw)
	}
	if n := voiceCalls(t, app); n != 1 {
		t.Fatalf("voice_calls = %d, want 1", n)
	}
}

func TestNotUnderstoodDoesNotCountTowardTheFiveAndYieldsNothing(t *testing.T) {
	app, me := setup(t)
	say(app, call{"not_understood", map[string]any{}})
	if r := interpret(me, "mumble"); r.Body["status"] != "nothing_understood" {
		t.Fatalf("not_understood = %s", r.Raw)
	}
	say(app, create(trash()), create(trash()), call{"not_understood", map[string]any{}},
		call{"not_understood", map[string]any{}}, call{"not_understood", map[string]any{}}, call{"not_understood", map[string]any{}})
	if r := interpret(me, "trash"); r.Body["status"] != "ok" || len(actions(t, r)) != 1 {
		t.Fatalf("one action beside not_understood = %s", r.Raw)
	}
	names := map[string]bool{}
	for _, tool := range app.Voice.LastRequest().Tools {
		names[tool.Name] = true
	}
	if !names["create_chore"] || !names["edit_chore"] || !names["not_understood"] {
		t.Fatalf("tools = %v", names)
	}
}

func TestDailyLimitAnswers429OnTheTwentyFirstCall(t *testing.T) {
	app, me := setup(t)
	say(app)
	seed(t, app, userID(t, me), 19)

	if r := interpret(me, "x"); r.Status != http.StatusOK || r.Body["remaining"] != float64(0) {
		t.Fatalf("20th = %d %s", r.Status, r.Raw)
	}
	before := app.Voice.Calls()
	r := interpret(me, "x")
	if r.Status != http.StatusTooManyRequests || r.Body["error"] != "voice_daily_limit" {
		t.Fatalf("21st = %d %s", r.Status, r.Raw)
	}
	if app.Voice.Calls() != before {
		t.Fatal("the model was called after the limit")
	}
	var skipped int
	if err := app.DB.QueryRow(context.Background(),
		`SELECT count(*) FROM llm_call_events WHERE service = 'voice' AND outcome = 'skipped_cap'`).Scan(&skipped); err != nil || skipped != 1 {
		t.Fatalf("skipped_cap events = %d %v, want 1", skipped, err)
	}
}

func TestTwoConcurrentRequestsAtCallTwentyLetExactlyOnePass(t *testing.T) {
	app, me := setup(t)
	say(app)
	seed(t, app, userID(t, me), 19)

	var wg sync.WaitGroup
	var mu sync.Mutex
	statuses := map[int]int{}
	for range 2 {
		wg.Go(func() {
			s := interpret(me, "x").Status
			mu.Lock()
			statuses[s]++
			mu.Unlock()
		})
	}
	wg.Wait()
	if statuses[200] != 1 || statuses[429] != 1 {
		t.Fatalf("statuses = %v, want one 200 and one 429", statuses)
	}
}

func TestAFailedModelCallStillCounts(t *testing.T) {
	app, me := setup(t)
	app.Voice.Fail(errors.New("boom SECRET-TRANSCRIPT-ECHO"))

	r := interpret(me, "x")
	if r.Status != http.StatusBadGateway || strings.Contains(string(r.Raw), "boom") {
		t.Fatalf("failed call = %d %s, want 502 without the cause", r.Status, r.Raw)
	}
	if n := voiceCalls(t, app); n != 1 {
		t.Fatalf("voice_calls = %d, want the failed call counted", n)
	}
	if app.Logs.Contains("SECRET-TRANSCRIPT-ECHO") {
		t.Fatal("the model error text reached the logs")
	}
}

func TestAnAnswerThatIsNotAToolCallListIs502(t *testing.T) {
	app, me := setup(t)
	app.Voice.Answer(`{"nope": true}`)
	if r := interpret(me, "x"); r.Status != http.StatusBadGateway {
		t.Fatalf("bad answer = %d %s, want 502", r.Status, r.Raw)
	}
	var outcome string
	if err := app.DB.QueryRow(context.Background(), `SELECT outcome FROM llm_call_events WHERE service = 'voice'`).Scan(&outcome); err != nil || outcome != "invalid_response" {
		t.Fatalf("outcome = %q %v", outcome, err)
	}
}

func TestAnOversizedAnswerIs502(t *testing.T) {
	app, me := setup(t)
	app.Voice.Answer(`[{"name":"not_understood","input":{"reason":"` + strings.Repeat("a", 70<<10) + `"}}]`)
	if r := interpret(me, "x"); r.Status != http.StatusBadGateway {
		t.Fatalf("oversized answer = %d, want 502", r.Status)
	}
	var outcome string
	if err := app.DB.QueryRow(context.Background(), `SELECT outcome FROM llm_call_events WHERE service = 'voice'`).Scan(&outcome); err != nil || outcome != "invalid_response" {
		t.Fatalf("outcome = %q %v", outcome, err)
	}
}

func TestABlockedModelCallTimesOutWith504(t *testing.T) {
	restore := voice.SetCallTimeout(100 * time.Millisecond)
	defer restore()
	app, me := setup(t)
	app.Voice.Block()

	start := time.Now()
	r := interpret(me, "x")
	if r.Status != http.StatusGatewayTimeout || time.Since(start) > 5*time.Second {
		t.Fatalf("blocked = %d after %s", r.Status, time.Since(start))
	}
	if n := voiceCalls(t, app); n != 1 {
		t.Fatalf("voice_calls = %d, want 1", n)
	}
	var outcome string
	if err := app.DB.QueryRow(context.Background(), `SELECT outcome FROM llm_call_events WHERE service = 'voice'`).Scan(&outcome); err != nil || outcome != "timeout" {
		t.Fatalf("outcome = %q %v", outcome, err)
	}
}

func TestVoiceOffAnswers503(t *testing.T) {
	app := apitest.Start(t)
	me := apitest.HomeWithResident(t, app, "a@example.com")
	if r := interpret(me, "x"); r.Status != http.StatusServiceUnavailable {
		t.Fatalf("voice off = %d %s, want 503", r.Status, r.Raw)
	}
}

func TestBadRequestsAreRefusedBeforeAnyCallOrReservation(t *testing.T) {
	app, me := setup(t)
	say(app, create(trash()))
	for name, body := range map[string]map[string]any{
		"empty":         {"transcript": "", "locale": "en-US"},
		"blank":         {"transcript": "  \t ", "locale": "en-US"},
		"501 runes":     {"transcript": strings.Repeat("é", 501), "locale": "pt-BR"},
		"control char":  {"transcript": "water\u0007 plants", "locale": "en-US"},
		"newline":       {"transcript": "water\nplants", "locale": "en-US"},
		"bad locale":    {"transcript": "water plants", "locale": "fr-FR"},
		"no locale":     {"transcript": "water plants"},
		"unknown field": {"transcript": "water plants", "locale": "en-US", "x": 1},
	} {
		if r := me.Post("/home/voice/interpret", body); r.Status != http.StatusBadRequest {
			t.Errorf("%s = %d %s, want 400", name, r.Status, r.Raw)
		}
	}
	if r := me.SendRaw("POST", "/home/voice/interpret", []byte("{")); r.Status != http.StatusBadRequest {
		t.Errorf("malformed JSON = %d", r.Status)
	}
	if app.Voice.Calls() != 0 || voiceCalls(t, app) != 0 {
		t.Fatalf("calls = %d, voice_calls = %d, want none", app.Voice.Calls(), voiceCalls(t, app))
	}
	// 500 runes of two bytes each is fine: runes are counted, not bytes.
	if r := me.Post("/home/voice/interpret", map[string]any{"transcript": strings.Repeat("é", 500), "locale": "pt-BR"}); r.Status != http.StatusOK {
		t.Errorf("500 runes = %d %s, want 200", r.Status, r.Raw)
	}
}

func TestThePromptCarriesOnlyTheTranscriptLocaleAndChoreBasics(t *testing.T) {
	app, me := setup(t)
	id := stored(t, me, "Clean bathroom")
	me.Put("/me/name", map[string]any{"name": "Zelda Hyrule"})
	me.Put("/me/restrictions/bending", nil)
	me.Put("/me/preferences/bathroom", map[string]any{"level": "dislike"})
	me.Put("/home/chores/"+id+"/preference", map[string]any{"level": "dislike"})
	other := apitest.HomeWithResident(t, app, "b@example.com")
	stored(t, other, "Home B chore")
	say(app)
	interpret(me, "hello")

	var msg struct {
		Locale, Transcript string
		Chores             []map[string]any
	}
	user := app.Voice.LastRequest().User
	if err := json.Unmarshal([]byte(user), &msg); err != nil {
		t.Fatalf("the user message is not JSON: %v", err)
	}
	var top map[string]any
	_ = json.Unmarshal([]byte(user), &top)
	for k := range top {
		if k != "locale" && k != "transcript" && k != "chores" {
			t.Errorf("top-level key %q is not allowed", k)
		}
	}
	allowed := map[string]bool{"id": true, "title": true, "category": true, "effort": true, "importance": true,
		"people": true, "interval_days": true, "allowed_weekdays": true}
	if len(msg.Chores) != 1 || msg.Chores[0]["id"] != id || msg.Chores[0]["title"] != "Clean bathroom" {
		t.Fatalf("chores = %v", msg.Chores)
	}
	for k := range msg.Chores[0] {
		if !allowed[k] {
			t.Errorf("chore key %q is not allowed", k)
		}
	}
	lower := strings.ToLower(user)
	for _, banned := range []string{userID(t, me), "zelda", "energy", "restriction", "preference", "check", "demands", "home b"} {
		if strings.Contains(lower, strings.ToLower(banned)) {
			t.Errorf("the prompt contains %q: %s", banned, user)
		}
	}
	if sys := app.Voice.LastRequest().System; !strings.Contains(sys, "data") {
		t.Errorf("the system prompt does not call the transcript data: %q", sys)
	}
}

func TestTheTranscriptIsNeverLogged(t *testing.T) {
	app, me := setup(t)
	const secret = "zebra-unicorn-secret"
	say(app, create(trash()))
	interpret(me, "create "+secret)
	interpret(me, secret+"\u0007")
	app.Voice.Fail(errors.New("down"))
	interpret(me, secret)
	if app.Logs.Contains(secret) {
		t.Fatalf("the transcript is in the logs: %s", app.Logs.String())
	}
	var stored int
	if err := app.DB.QueryRow(context.Background(), `SELECT count(*) FROM llm_call_events WHERE model LIKE '%'||$1||'%'`, secret).Scan(&stored); err != nil || stored != 0 {
		t.Fatalf("transcript stored: %d %v", stored, err)
	}
}

func TestTheModelsTextNeverReachesTheResponse(t *testing.T) {
	app, me := setup(t)
	chatty := trash()
	chatty["note"] = "MODELTEXT"
	say(app, create(trash()), call{"say", map[string]any{"text": "MODELTEXT"}}, create(chatty),
		edit(map[string]any{"chore_ids": []string{}, "name": "MODELTEXT"}))

	r := interpret(me, "x")
	if r.Body["status"] != "ok" || len(actions(t, r)) != 1 || strings.Contains(string(r.Raw), "MODELTEXT") {
		t.Fatalf("response = %s", r.Raw)
	}
}

func TestAnEditNamesTheChoreFromTheStoreNotTheModel(t *testing.T) {
	app, me := setup(t)
	id := stored(t, me, "Clean bathroom")
	say(app, edit(map[string]any{"chore_ids": []string{id}, "baseEffort": 1, "choreName": "MODELTEXT"}))
	if r := interpret(me, "x"); r.Body["status"] != "nothing_understood" || strings.Contains(string(r.Raw), "MODELTEXT") {
		t.Fatalf("an unknown field must drop the call: %s", r.Raw)
	}
}

func TestEveryCallRecordsAVoiceEventThatAdminAIShows(t *testing.T) {
	app, me := setup(t)
	say(app, create(trash()), create(trash()), create(trash()), create(map[string]any{}))
	if r := interpret(me, "x"); r.Status != http.StatusOK {
		t.Fatal(r.Raw)
	}
	var outcome string
	var sent, accepted int
	var home *string
	if err := app.DB.QueryRow(context.Background(), `
		SELECT outcome, items_sent, items_accepted, home_id::text FROM llm_call_events WHERE service = 'voice'`).
		Scan(&outcome, &sent, &accepted, &home); err != nil {
		t.Fatal(err)
	}
	if outcome != "accepted" || sent != 4 || accepted != 1 || home == nil {
		t.Fatalf("event = %s sent %d accepted %d home %v, want accepted 4/1 with the Home", outcome, sent, accepted, home)
	}

	res := app.SignInAsSuperAdmin("admin@example.com").Get("/admin/ai?range=7d")
	var ai admin.AIResponse
	if err := json.Unmarshal(res.Raw, &ai); err != nil {
		t.Fatal(err)
	}
	total := 0
	for _, d := range ai.Days {
		total += d.Services.Voice.Outcomes.Accepted
	}
	if total != 1 {
		t.Fatalf("/admin/ai voice accepted = %d, want 1: %s", total, res.Raw)
	}
}
