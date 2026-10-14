package allocation

import "cmp"

// compareCandidates orders two Residents who fit the Task, best first:
// the one who likes the Chore, then neutral, then the one who dislikes it;
// between two who dislike it, the one who did it longest ago (never done
// first); then the one with more Energy left. A full tie is left to the stable
// sort over Residents sorted by ID.
func compareCandidates(a, b Resident, leftA, leftB int, t Task) int {
	pa, pb := a.Preferences[t.ChoreID], b.Preferences[t.ChoreID]
	order := cmp.Compare(pa, pb)
	if order == 0 && pa == Dislike {
		order = compareLastDone(a, b, t.ChoreID)
	}
	return cmp.Or(order, cmp.Compare(leftB, leftA))
}

// compareLastDone orders by the Date of the last Completion of the Chore,
// oldest first, with never done before any Date.
func compareLastDone(a, b Resident, choreID string) int {
	da, doneA := a.LastDone[choreID]
	db, doneB := b.LastDone[choreID]
	switch {
	case doneA && doneB:
		return cmp.Compare(da, db)
	case doneA:
		return 1
	case doneB:
		return -1
	}
	return 0
}

// decidingReason says why the chosen Residents (indices into residents, in
// order) took the Task rather than the passed-over ones. It compares each
// chosen Resident with each passed-over one and reports the first pair where a
// Preference (liked, or spared_dislike) or turn-taking put the chosen one
// ahead, and where the order by Energy alone (most left, then lowest index)
// would have put the other first. It reports false when no pair qualifies:
// Energy or the Resident ID decided, and the urgency reason applies.
func decidingReason(residents []Resident, left, chosen, passed []int, t Task) (Reason, bool) {
	for _, c := range chosen {
		for _, p := range passed {
			if left[c] > left[p] || (left[c] == left[p] && c < p) {
				continue // Energy alone would have chosen c anyway.
			}
			pc, pp := residents[c].Preferences[t.ChoreID], residents[p].Preferences[t.ChoreID]
			switch {
			case pc < pp && pc == Like:
				return ReasonLiked, true
			case pc < pp:
				return ReasonSparedDislike, true
			case pc == pp && pc == Dislike && compareLastDone(residents[c], residents[p], t.ChoreID) < 0:
				return ReasonTurnTaking, true
			}
		}
	}
	return "", false
}
