package explain

import (
	"cmp"
	"fmt"
	"maps"
	"slices"
	"strings"
)

// Situation is the kind of day the facts describe. A day has exactly one.
type Situation string

// The situations, in the order SituationOf checks them.
const (
	SituationRest        Situation = "rest"
	SituationLow         Situation = "low"
	SituationNothingFits Situation = "nothing_fits"
	SituationFree        Situation = "free"
	SituationFull        Situation = "full"
	SituationShared      Situation = "shared"
	SituationLight       Situation = "light"
)

// fullShare is the part of the Energy, as numerator over denominator, from
// which a day counts as full: the Effort of the Tasks is at least 3/4 of it.
const (
	fullNum = 3
	fullDen = 4
)

// reasonNoEnergyLeft is the pool reason that says the open work did not fit.
const reasonNoEnergyLeft = "no_energy_left"

// SituationOf is the one situation the facts are in. The first that matches
// wins: rest, low, nothing_fits, free, full, shared, light. Normal and
// Energized Check-ins have no situation of their own.
func SituationOf(f Facts) Situation {
	switch {
	case f.Checkin == CheckinDrained || f.Energy <= 0:
		return SituationRest
	case f.Checkin == CheckinLow:
		return SituationLow
	case slices.Contains(f.Pool, reasonNoEnergyLeft):
		return SituationNothingFits
	case len(f.Tasks) == 0:
		return SituationFree
	}
	used := 0
	for _, t := range f.Tasks {
		used += t.Effort
	}
	switch {
	case used*fullDen >= f.Energy*fullNum:
		return SituationFull
	case slices.ContainsFunc(f.Tasks, func(t Task) bool { return t.People > 1 }):
		return SituationShared
	}
	return SituationLight
}

// clause is a noun phrase about the day's Tasks in each language, for "Your
// day is mostly ...". It is about the day, never about one Task, so it does
// not repeat the "Why:" line of a card.
type clause struct{ id, en, pt string }

// clauses is the one table of reasons of assigned Tasks (allocation.Reason and
// the reasons dayplan adds), in priority order: the earlier breaks a tie
// between reasons of the same count. The pool is told by its count, so its
// reasons need no clause. TestEveryRecordedReasonIsHandled keeps the table
// complete.
var clauses = []clause{
	{"deadline_today", "work due today", "tarefas com prazo hoje"},
	{"importance", "important work", "tarefas importantes"},
	{"lateness", "work that waited longest", "tarefas que esperam há mais tempo"},
	{"turn_taking", "taking turns", "revezamento"},
	{"liked", "work you like", "tarefas de que você gosta"},
	{"spared_dislike", "less of what you dislike", "menos do que você não gosta"},
	{"fits_energy", "work sized for your energy", "tarefas do tamanho da sua energia"},
	{"taken", "work you took on", "tarefas que você pegou"},
	{"swapped", "swapped work", "tarefas trocadas"},
}

// otherClause stands in for a reason the table does not know, so a new reason
// never yields blank text or a raw id.
var otherClause = clause{"", "other work", "outras tarefas"}

// Template writes the explanation of the day from the facts alone, in both
// languages: a headline from the situation, and a detail of at most two
// sentences. It is what every Resident gets when no model text is used, so it
// is complete by itself. It names no Resident, Chore or Streak.
func Template(f Facts) Summary {
	sit := SituationOf(f)
	return Summary{Headline: headline(sit, len(f.Tasks) > 0), Detail: detail(sit, f)}
}

func headline(s Situation, hasTasks bool) Texts {
	switch s {
	case SituationRest:
		return Texts{"Rest is the plan today.", "Hoje o plano é descansar."}
	case SituationLow:
		return Texts{"A lighter day, with Low Energy.", "Dia mais leve, com energia baixa."}
	case SituationNothingFits:
		if hasTasks {
			return Texts{"Nothing more fits today.", "Nada mais cabe hoje."}
		}
		return Texts{"Nothing fits your Energy today.", "Nada cabe na energia que você tem hoje."}
	case SituationFree:
		return Texts{"Nothing needs you today.", "Nada precisa de você hoje."}
	case SituationFull:
		return Texts{"A full day, close to all your Energy.", "Dia cheio, perto de toda a sua energia."}
	case SituationShared:
		return Texts{"Some of today's work is shared.", "Parte do trabalho de hoje é compartilhada."}
	}
	return Texts{"A light day with room to spare.", "Dia leve, com folga."}
}

func detail(s Situation, f Facts) Texts {
	var en, pt []string
	add := func(t Texts) { en, pt = append(en, t.EnUS), append(pt, t.PtBR) }
	pool := len(f.Pool)
	switch s {
	case SituationRest:
		add(restLead(f))
		if n := len(f.Tasks); n > 0 {
			add(counted(n, "You still hold %d task.", "You still hold %d tasks.", "Você ainda tem %d tarefa.", "Você ainda tem %d tarefas."))
		}
	case SituationNothingFits:
		add(counted(pool,
			"%d open task needs more Energy than you have left.", "%d open tasks need more Energy than you have left.",
			"%d tarefa em aberto pede mais energia do que você tem.", "%d tarefas em aberto pedem mais energia do que você tem."))
		if len(f.Tasks) > 0 {
			add(reasonsSentence(f.Tasks))
		}
	case SituationFree:
		add(Texts{"There is no work for you today.", "Não há nenhum trabalho para você hoje."})
		if pool > 0 {
			add(poolSentence(pool))
		}
	default:
		if len(f.Tasks) > 0 {
			add(reasonsSentence(f.Tasks))
		}
		if pool > 0 {
			add(poolSentence(pool))
		}
	}
	if len(en) == 0 {
		add(Texts{"Nothing else is open.", "Não há mais nada em aberto."})
	}
	return Texts{strings.Join(en, " "), strings.Join(pt, " ")}
}

// restLead is the lead of a day of rest. Without a Drained Check-in to rest on,
// it first says that no energy is set; then it says what happens to the open work.
func restLead(f Facts) Texts {
	var en, pt []string
	if f.Checkin != CheckinDrained {
		en, pt = append(en, "No energy is set for today."), append(pt, "Não há energia definida para hoje.")
	}
	wait := Texts{"The open work waits for tomorrow.", "O trabalho em aberto fica para amanhã."}
	if n := len(f.Pool); n > 0 {
		wait = counted(n,
			"%d open task waits for tomorrow.", "%d open tasks wait for tomorrow.",
			"%d tarefa em aberto fica para amanhã.", "%d tarefas em aberto ficam para amanhã.")
	}
	en, pt = append(en, wait.EnUS), append(pt, wait.PtBR)
	return Texts{strings.Join(en, " "), strings.Join(pt, " ")}
}

func poolSentence(n int) Texts {
	return counted(n,
		"%d open task still waits.", "%d open tasks still wait.",
		"%d tarefa em aberto ainda espera.", "%d tarefas em aberto ainda esperam.")
}

// reasonsSentence names the day's main reason or two: the most frequent among
// the Tasks, ties by priority, unknown reasons counted together and last.
func reasonsSentence(ts []Task) Texts {
	// rank is the index in clauses; reasons the table does not know share
	// otherClause, after the known ones.
	rank := func(reason string) int {
		return slices.IndexFunc(clauses, func(c clause) bool { return c.id == reason })
	}
	n := map[int]int{}
	for _, t := range ts {
		r := rank(t.Reason)
		if r < 0 {
			r = len(clauses)
		}
		n[r]++
	}
	order := slices.SortedFunc(maps.Keys(n), func(a, b int) int {
		return cmp.Or(cmp.Compare(n[b], n[a]), cmp.Compare(a, b))
	})
	order = order[:min(2, len(order))]
	var en, pt []string
	for _, r := range order {
		c := otherClause
		if r < len(clauses) {
			c = clauses[r]
		}
		en, pt = append(en, c.en), append(pt, c.pt)
	}
	return Texts{
		"Your day is mostly " + strings.Join(en, " and ") + ".",
		"Seu dia é feito de " + strings.Join(pt, " e ") + ".",
	}
}

// counted is the sentence in each language with its one %d filled by n, in the
// singular form for 1 and the plural otherwise.
func counted(n int, enOne, enMany, ptOne, ptMany string) Texts {
	if n == 1 {
		return Texts{fmt.Sprintf(enOne, n), fmt.Sprintf(ptOne, n)}
	}
	return Texts{fmt.Sprintf(enMany, n), fmt.Sprintf(ptMany, n)}
}
