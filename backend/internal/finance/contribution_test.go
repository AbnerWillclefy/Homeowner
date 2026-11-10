package finance

import (
	"slices"
	"testing"
	"time"
)

var contributionNow = time.Date(2030, time.January, 1, 0, 0, 0, 0, time.UTC)

// due is the first day of the month `offset` months after the current one.
func due(offset int) *time.Time { d := contributionNow.AddDate(0, offset, 0); return &d }

func i64(v int64) *int64 { return &v }

func TestSplitContribution(t *testing.T) {
	t.Parallel()
	type want struct {
		reserve    int64
		reserveOff int // months after the current one; -1 for none
		saved      []int64
		amounts    []int64
		offs       []int
		late       []bool // nil: none late
		unassigned int64
	}
	g := func(id string, target int64, d *time.Time) ContributionGoal { return ContributionGoal{id, target, d} }
	for name, c := range map[string]struct {
		in   ContributionIn
		want want
	}{
		"rounding: R$ 9,99 at 33% is 3,30 and 6,69": {
			ContributionIn{ReserveTarget: i64(100000), Goals: []ContributionGoal{g("a", 100_000_000, nil)}, Base: 999, SharePercent: 33},
			want{330, -1, []int64{0}, []int64{669}, []int{-1}, nil, 0},
		},
		"rounding: half rounds up": {
			ContributionIn{ReserveTarget: i64(100000), Goals: []ContributionGoal{g("a", 100_000_000, nil)}, Base: 50, SharePercent: 1},
			want{1, -1, []int64{0}, []int64{49}, []int{-1}, nil, 0},
		},
		"rounding: below half rounds down": {
			ContributionIn{ReserveTarget: i64(100000), Goals: []ContributionGoal{g("a", 100_000_000, nil)}, Base: 49, SharePercent: 1},
			want{0, -1, []int64{0}, []int64{49}, []int{-1}, nil, 0},
		},
		"reserve reaches its target this month, the rest goes to Goals": {
			ContributionIn{ReserveTarget: i64(200), Goals: []ContributionGoal{g("a", 100_000_000, nil)}, Base: 1000, SharePercent: 50},
			want{200, 0, []int64{0}, []int64{800}, []int{-1}, nil, 0},
		},
		"reserve already full: everything to Goals": {
			ContributionIn{ReserveTarget: i64(500), ReserveSaved: 500, Goals: []ContributionGoal{g("a", 100_000_000, nil)}, Base: 1000, SharePercent: 50},
			want{0, 0, []int64{0}, []int64{1000}, []int{-1}, nil, 0},
		},
		"reserve saved above its target counts as full": {
			ContributionIn{ReserveTarget: i64(500), ReserveSaved: 900, Goals: []ContributionGoal{g("a", 100_000_000, nil)}, Base: 1000, SharePercent: 50},
			want{0, 0, []int64{0}, []int64{1000}, []int{-1}, nil, 0},
		},
		"reserve fell below its target: takes its share again": {
			ContributionIn{ReserveTarget: i64(500), ReserveSaved: 400, Goals: []ContributionGoal{g("a", 100_000_000, nil)}, Base: 1000, SharePercent: 50},
			want{100, 0, []int64{0}, []int64{900}, []int{-1}, nil, 0},
		},
		"no reserve target: everything to Goals": {
			ContributionIn{Goals: []ContributionGoal{g("a", 100_000_000, nil)}, Base: 1000, SharePercent: 50},
			want{0, -1, []int64{0}, []int64{1000}, []int{-1}, nil, 0},
		},
		"pot fills the dated Goal before an earlier undated one": {
			ContributionIn{Goals: []ContributionGoal{g("a", 100, nil), g("b", 100, due(5))}, GoalsPot: 150},
			want{0, -1, []int64{50, 100}, []int64{0, 0}, []int{-1, -1}, []bool{false, false}, 0},
		},
		"pot fills dated Goals earliest date first": {
			ContributionIn{Goals: []ContributionGoal{g("a", 100, due(6)), g("b", 100, due(2))}, GoalsPot: 130},
			want{0, -1, []int64{30, 100}, []int64{0, 0}, []int{-1, -1}, []bool{true, false}, 0},
		},
		"pot fills undated Goals in order, each up to its target": {
			ContributionIn{Goals: []ContributionGoal{g("a", 100, nil), g("b", 100, nil)}, GoalsPot: 150},
			want{0, -1, []int64{100, 50}, []int64{0, 0}, []int{-1, -1}, nil, 0},
		},
		"pot larger than every target: the surplus is unassigned": {
			ContributionIn{Goals: []ContributionGoal{g("a", 100, nil)}, GoalsPot: 500},
			want{0, -1, []int64{100}, []int64{0}, []int{-1}, nil, 400},
		},
		"Goal already full from the pot is reached this month": {
			ContributionIn{Goals: []ContributionGoal{g("a", 100, nil), g("b", 1000, nil)}, GoalsPot: 100, Base: 50},
			want{0, -1, []int64{100, 0}, []int64{0, 50}, []int{0, 19}, nil, 0},
		},
		"dated Goal missing R$ 1.200 with 4 months left takes R$ 300": {
			ContributionIn{Goals: []ContributionGoal{g("a", 1200, due(3))}, Base: 300},
			want{0, -1, []int64{0}, []int64{300}, []int{3}, []bool{false}, 0},
		},
		"dated Goal's monthly amount rounds up": {
			ContributionIn{Goals: []ContributionGoal{g("a", 1000, due(2)), g("b", 1000, nil)}, Base: 334},
			want{0, -1, []int64{0, 0}, []int64{334, 0}, []int{2, 5}, []bool{false, false}, 0},
		},
		"dated Goal due this month takes everything it misses": {
			ContributionIn{Goals: []ContributionGoal{g("a", 500, due(0))}, Base: 1000},
			want{0, -1, []int64{0}, []int64{500}, []int{0}, []bool{false}, 500},
		},
		"date in the past asks for everything now and is late": {
			ContributionIn{Goals: []ContributionGoal{g("a", 500, due(-7))}, Base: 1000},
			want{0, -1, []int64{0}, []int64{500}, []int{0}, []bool{true}, 500},
		},
		"money short for two dated Goals: earliest paid first, the other is late": {
			ContributionIn{Goals: []ContributionGoal{g("a", 1000, due(1)), g("b", 1000, due(2))}, Base: 600},
			want{0, -1, []int64{0, 0}, []int64{500, 100}, []int{1, 3}, []bool{false, true}, 0},
		},
		"same date: the order breaks the tie": {
			ContributionIn{Goals: []ContributionGoal{g("a", 100, due(0)), g("b", 100, due(0))}, Base: 100},
			want{0, -1, []int64{0, 0}, []int64{100, 0}, []int{0, 1}, []bool{false, true}, 0},
		},
		"after dated Goals the rest goes to the first unfilled Goal in order": {
			ContributionIn{Goals: []ContributionGoal{g("a", 1000, nil), g("b", 120, due(5))}, Base: 100},
			want{0, -1, []int64{0, 0}, []int64{80, 20}, []int{11, 5}, []bool{false, false}, 0},
		},
		"what passes a target flows to the next Goal": {
			ContributionIn{Goals: []ContributionGoal{g("a", 50, nil), g("b", 100, nil)}, Base: 100},
			want{0, -1, []int64{0, 0}, []int64{50, 50}, []int{0, 1}, nil, 0},
		},
		"no Goals: the Goals' share is unassigned": {
			ContributionIn{ReserveTarget: i64(1000), Base: 1000, SharePercent: 30},
			want{300, 3, nil, nil, nil, nil, 700},
		},
		"every Goal full: the money is unassigned": {
			ContributionIn{Goals: []ContributionGoal{g("a", 100, nil)}, Base: 1000},
			want{0, -1, []int64{0}, []int64{100}, []int{0}, nil, 900},
		},
		"base zero: no amounts and no months, the pot still fills": {
			ContributionIn{ReserveTarget: i64(100), Goals: []ContributionGoal{g("a", 100, nil), g("b", 100, due(3))}, GoalsPot: 150, SharePercent: 50},
			want{0, -1, []int64{50, 100}, []int64{0, 0}, []int{-1, -1}, []bool{false, false}, 0},
		},
		"dated Goal full from the pot is not late even when the date has passed": {
			ContributionIn{Goals: []ContributionGoal{g("a", 100, due(-2))}, GoalsPot: 100, Base: 50},
			want{0, -1, []int64{100}, []int64{0}, []int{0}, []bool{false}, 50},
		},
		"negative base is no base": {
			ContributionIn{Goals: []ContributionGoal{g("a", 100, nil)}, Base: -500},
			want{0, -1, []int64{0}, []int64{0}, []int{-1}, nil, 0},
		},
		"reached in the 120th month": {
			ContributionIn{Goals: []ContributionGoal{g("a", 12000, nil)}, Base: 100},
			want{0, -1, []int64{0}, []int64{100}, []int{119}, nil, 0},
		},
		"not reached within 120 months: no month, and late when dated": {
			ContributionIn{Goals: []ContributionGoal{g("a", 12100, nil), g("b", 1, due(130))}, Base: 100},
			want{0, -1, []int64{0, 0}, []int64{99, 1}, []int{-1, 0}, []bool{false, false}, 0},
		},
		"dated Goal not reached within 120 months is late": {
			ContributionIn{Goals: []ContributionGoal{g("a", 13000, due(200))}, Base: 100},
			want{0, -1, []int64{0}, []int64{100}, []int{-1}, []bool{true}, 0},
		},
	} {
		c.in.Now = contributionNow
		got := SplitContribution(c.in)
		w := c.want
		check := func(field string, ok bool) {
			if !ok {
				t.Errorf("%s: %s wrong, got %+v", name, field, got)
			}
		}
		check("ReserveAmount", got.ReserveAmount == w.reserve)
		check("Unassigned", got.Unassigned == w.unassigned)
		wantReserveMonth := monthAt(contributionNow, w.reserveOff)
		check("ReserveMonth", (got.ReserveMonth == nil) == (wantReserveMonth == nil) && (wantReserveMonth == nil || got.ReserveMonth.Equal(*wantReserveMonth)))
		check("Goals length", len(got.Goals) == len(w.amounts))
		if len(got.Goals) != len(w.amounts) {
			continue
		}
		var total int64 = got.ReserveAmount + got.Unassigned
		for i, gc := range got.Goals {
			total += gc.Amount
			m := monthAt(contributionNow, w.offs[i])
			check("Goal ID", gc.ID == c.in.Goals[i].ID)
			check("Saved", gc.Saved == w.saved[i])
			check("Amount", gc.Amount == w.amounts[i])
			check("Month", (gc.Month == nil) == (m == nil) && (m == nil || gc.Month.Equal(*m)))
			check("Late", gc.Late == (w.late != nil && w.late[i]))
		}
		// the parts always add up to the money given, plus the pot's surplus
		var potLeft int64
		for _, gc := range got.Goals {
			potLeft += gc.Saved
		}
		if surplus := max(c.in.GoalsPot, 0) - potLeft; c.in.Base > 0 && total != c.in.Base+surplus {
			t.Errorf("%s: parts add up to %d, want base %d + pot surplus %d", name, total, c.in.Base, surplus)
		}
	}
}

func TestExtra(t *testing.T) {
	t.Parallel()
	goal := func(target int64) []ContributionGoal { return []ContributionGoal{{ID: "a", Target: target}} }
	five, zero, six := 5, 0, 6
	for name, c := range map[string]struct {
		in       ContributionIn
		leftover int64
		ok       bool
		want     ContributionExtra
	}{
		"leftover equal to the base: no answer": {ContributionIn{Base: 100}, 100, false, ContributionExtra{}},
		"leftover below the base: no answer":    {ContributionIn{Base: 100}, 50, false, ContributionExtra{}},
		"reserve months sooner": {
			ContributionIn{ReserveTarget: i64(1000), Base: 100, SharePercent: 100}, 200, true,
			ContributionExtra{100, &five},
		},
		"extra does not move the month: zero sooner": {
			ContributionIn{ReserveTarget: i64(100), Base: 200, SharePercent: 100}, 300, true,
			ContributionExtra{100, &zero},
		},
		"reserve full: the first unfilled Goal": {
			ContributionIn{ReserveTarget: i64(500), ReserveSaved: 500, Goals: goal(1000), Base: 100, SharePercent: 50}, 250, true,
			ContributionExtra{150, &six},
		},
		"no reserve target: the first unfilled Goal skips a Goal full from the pot": {
			ContributionIn{Goals: []ContributionGoal{{ID: "a", Target: 10}, {ID: "b", Target: 1000}}, GoalsPot: 10, Base: 100}, 250, true,
			ContributionExtra{150, &six},
		},
		"reserve full and no unfilled Goal: nothing sooner": {
			ContributionIn{Goals: goal(10), GoalsPot: 10, Base: 100}, 250, true,
			ContributionExtra{Extra: 150},
		},
		"not reached either way: absent": {
			ContributionIn{ReserveTarget: i64(1_000_000_000), Base: 1, SharePercent: 100}, 2, true,
			ContributionExtra{Extra: 1},
		},
		"reached only with the extra: absent": {
			ContributionIn{ReserveTarget: i64(13000), Base: 100, SharePercent: 100}, 1000, true,
			ContributionExtra{Extra: 900},
		},
		"base zero: absent": {
			ContributionIn{ReserveTarget: i64(1000), SharePercent: 100}, 100, true,
			ContributionExtra{Extra: 100},
		},
	} {
		c.in.Now = contributionNow
		got, ok := Extra(c.in, c.leftover)
		if ok != c.ok || got.Extra != c.want.Extra || (got.MonthsSooner == nil) != (c.want.MonthsSooner == nil) ||
			(got.MonthsSooner != nil && *got.MonthsSooner != *c.want.MonthsSooner) {
			t.Errorf("%s: Extra = %+v, %v; want %+v, %v", name, got, ok, c.want, c.ok)
		}
	}
}

func TestOverLimit(t *testing.T) {
	t.Parallel()
	for name, c := range map[string]struct {
		totals, limits map[string]int64
		want           []CategoryOver
	}{
		"none over":                        {map[string]int64{"food": 100}, map[string]int64{"food": 200}, nil},
		"exactly at the limit is not over": {map[string]int64{"food": 200}, map[string]int64{"food": 200}, nil},
		"one cent over":                    {map[string]int64{"food": 201}, map[string]int64{"food": 200}, []CategoryOver{{"food", 1}}},
		"largest amount over first": {
			map[string]int64{"food": 300, "fun": 900, "rent": 1000},
			map[string]int64{"food": 200, "fun": 100, "rent": 950},
			[]CategoryOver{{"fun", 800}, {"food", 100}, {"rent", 50}},
		},
		"ties by category":                       {map[string]int64{"b": 20, "a": 20}, map[string]int64{"a": 10, "b": 10}, []CategoryOver{{"a", 10}, {"b", 10}}},
		"category without a limit is ignored":    {map[string]int64{"food": 999}, map[string]int64{}, nil},
		"category without spending is not over":  {map[string]int64{}, map[string]int64{"food": 100}, nil},
		"a refund-negative category is not over": {map[string]int64{"food": -50}, map[string]int64{"food": 100}, nil},
		"nil maps":                               {nil, nil, nil},
	} {
		if got := OverLimit(c.totals, c.limits); !slices.Equal(got, c.want) {
			t.Errorf("%s: OverLimit = %v, want %v", name, got, c.want)
		}
	}
}
