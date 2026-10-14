package allocation

import "testing"

func TestPlanPreferences(t *testing.T) {
	runPlanCases(t, []planCase{
		// Soft rules: an essential Chore is still assigned despite dislikes.
		{"essential chore is assigned to the only resident with energy even if disliked",
			state(rs(resident("a", 5).dislikes("t"), resident("b", 0)), task("t", 2, importance(Essential))),
			[]Assignment{give("t", "a", ReasonImportance)}, nil},
		{"essential chore disliked by everyone is still assigned",
			state(rs(resident("a", 3).dislikes("t"), resident("b", 3).dislikes("t")), task("t", 2, importance(Essential))),
			[]Assignment{give("t", "a", ReasonImportance)}, nil},
		{"preference never outranks importance when energy is short",
			state(rs(resident("a", 2).dislikes("ess").likes("nice")),
				task("ess", 2, importance(Essential)), task("nice", 2, importance(NiceToHave))),
			[]Assignment{give("ess", "a", ReasonImportance)}, []PoolEntry{pool("nice", ReasonNoEnergyLeft)}},

		// Likes pull a Chore towards a Resident.
		{"a liker beats a neutral resident with more energy",
			state(rs(resident("a", 2).likes("t"), resident("b", 5)), task("t", 2)),
			[]Assignment{give("t", "a", ReasonLiked)}, nil},
		{"a liker who already would have won keeps the urgency reason",
			state(rs(resident("a", 5).likes("t"), resident("b", 2)), task("t", 2, importance(Essential))),
			[]Assignment{give("t", "a", ReasonImportance)}, nil},
		{"a neutral resident beats a disliker with more energy",
			state(rs(resident("a", 5).dislikes("t"), resident("b", 2)), task("t", 2)),
			[]Assignment{give("t", "b", ReasonSparedDislike)}, nil},
		{"a restriction beats a like",
			state(rs(resident("a", 5).likes("t").cannotDoChore("chore-t"), resident("b", 2)), task("t", 2)),
			[]Assignment{give("t", "b", ReasonFitsEnergy)}, nil},
		{"a liker who is restricted leaves the task in the pool",
			state(rs(resident("a", 5).likes("t").cannotDoChore("chore-t")), task("t", 2)),
			nil, []PoolEntry{pool("t", ReasonRestrictedForAll)}},

		// Turn-taking among dislikers.
		{"the disliker who did it longest ago takes the turn",
			state(rs(resident("a", 3).dislikes("t").lastDid("t", today-1), resident("b", 3).dislikes("t").lastDid("t", today-7)),
				task("t", 2)),
			[]Assignment{give("t", "b", ReasonTurnTaking)}, nil},
		{"and the turn comes back round",
			state(rs(resident("a", 3).dislikes("t").lastDid("t", today-7), resident("b", 3).dislikes("t").lastDid("t", today-1)),
				task("t", 2)),
			[]Assignment{give("t", "a", ReasonFitsEnergy)}, nil},
		{"never done comes before any date",
			state(rs(resident("a", 3).dislikes("t").lastDid("t", today-30), resident("b", 3).dislikes("t")), task("t", 2)),
			[]Assignment{give("t", "b", ReasonTurnTaking)}, nil},
		{"equal last dates fall to energy",
			state(rs(resident("a", 2).dislikes("t").lastDid("t", today-3), resident("b", 4).dislikes("t").lastDid("t", today-3)),
				task("t", 2)),
			[]Assignment{give("t", "b", ReasonFitsEnergy)}, nil},
		{"equal dates and energy fall to the lowest id",
			state(rs(resident("b", 3).dislikes("t"), resident("a", 3).dislikes("t")), task("t", 2)),
			[]Assignment{give("t", "a", ReasonFitsEnergy)}, nil},
		{"history of another chore does not count",
			state(rs(resident("a", 3).dislikes("t").lastDid("other", today-30), resident("b", 3).dislikes("t").lastDid("t", today-1)),
				task("t", 2)),
			[]Assignment{give("t", "a", ReasonFitsEnergy)}, nil},
		{"history does not matter for residents who do not dislike the chore",
			state(rs(resident("a", 2).lastDid("t", today-1), resident("b", 4).lastDid("t", today-30)), task("t", 2)),
			[]Assignment{give("t", "b", ReasonFitsEnergy)}, nil},

		// Two-person Tasks use the same ranking.
		{"a liker is in the pair",
			state(rs(resident("a", 1).likes("t"), resident("b", 5), resident("c", 3)), task("t", 1, people(2))),
			[]Assignment{give("t", "a", ReasonLiked), give("t", "b", ReasonLiked)}, nil},
		{"with only dislikers the two least recent take it",
			state(rs(resident("a", 5).dislikes("t").lastDid("t", today-1), resident("b", 5).dislikes("t").lastDid("t", today-9),
				resident("c", 5).dislikes("t").lastDid("t", today-5)), task("t", 1, people(2))),
			[]Assignment{give("t", "b", ReasonTurnTaking), give("t", "c", ReasonTurnTaking)}, nil},

		// No regression: neutral and no history is today's behaviour.
		{"all neutral keeps the urgency reasons and the energy order",
			state(rs(resident("a", 2), resident("b", 5)), task("t1", 2, importance(Essential)), task("t2", 2, lateBy(2))),
			[]Assignment{give("t1", "b", ReasonImportance), give("t2", "b", ReasonLateness)}, nil},
	})
}

func TestCheckAcceptsADislikedChore(t *testing.T) {
	s := state(rs(resident("a", 3).dislikes("t")), task("t", 2))
	plan := DayPlan{Assignments: []Assignment{give("t", "a", ReasonFitsEnergy)}}
	if v := Check(plan, s); len(v) != 0 {
		t.Errorf("Check rejected a plan for a disliked Chore: %+v", v)
	}
}
