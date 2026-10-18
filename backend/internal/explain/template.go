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
type clause struct{ en, pt string }

// clauses is the one table of reasons, keyed by the recorded reason ids
// (allocation.Reason and the reasons dayplan adds). Only reasons of assigned
// Tasks have a clause; the pool is told by its count.
// TestEveryRecordedReasonIsHandled keeps the table and poolReasons complete.
var clauses = map[string]clause{
	"deadline_today": {"work due today", "tarefas com prazo hoje"},
	"importance":     {"important work", "tarefas importantes"},
	"lateness":       {"work that waited longest", "tarefas que esperam há mais tempo"},
	"turn_taking":    {"taking turns", "revezamento"},
	"liked":          {"work you like", "tarefas de que você gosta"},
	"spared_dislike": {"less of what you dislike", "menos do que você não gosta"},
	"fits_energy":    {"work sized for your energy", "tarefas do tamanho da sua energia"},
	"taken":          {"work you took on", "tarefas que você pegou"},
	"swapped":        {"swapped work", "tarefas trocadas"},
}

// otherClause stands in for a reason the table does not know, so a new reason
// never yields blank text or a raw id.
var otherClause = clause{"other work", "outras tarefas"}

// priority breaks ties between reasons of the same count: the earlier wins.
var priority = []string{"deadline_today", "importance", "lateness", "turn_taking", "liked", "spared_dislike", "fits_energy", "taken", "swapped"}

// poolReasons are the reasons of Tasks nobody holds. The summary tells the pool
// by its count and by no_energy_left, so they need no clause.
var poolReasons = []string{
	reasonNoEnergyLeft, "restricted_for_all", "two_person_deferred", "weekday_not_allowed",
	"invalid_effort", "refused", "added_after_plan",
}

// Known reports whether the reason is one the template was written for.
func Known(reason string) bool {
	_, ok := clauses[reason]
	return ok || slices.Contains(poolReasons, reason)
}

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
			add(Texts{plural(n, "You still hold %d task.", "You still hold %d tasks."), plural(n, "Você ainda tem %d tarefa.", "Você ainda tem %d tarefas.")}.fill(n))
		}
	case SituationNothingFits:
		add(Texts{
			plural(pool, "%d open task needs more Energy than you have left.", "%d open tasks need more Energy than you have left."),
			plural(pool, "%d tarefa em aberto pede mais energia do que você tem.", "%d tarefas em aberto pedem mais energia do que você tem."),
		}.fill(pool))
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

func restLead(f Facts) Texts {
	noBaseline := f.Checkin != CheckinDrained
	n := len(f.Pool)
	switch {
	case noBaseline && n > 0:
		return Texts{
			plural(n, "No energy is set for today, so %d open task waits for tomorrow.", "No energy is set for today, so %d open tasks wait for tomorrow."),
			plural(n, "Não há energia definida para hoje, então %d tarefa em aberto fica para amanhã.", "Não há energia definida para hoje, então %d tarefas em aberto ficam para amanhã."),
		}.fill(n)
	case noBaseline:
		return Texts{"No energy is set for today, so the open work waits for tomorrow.", "Não há energia definida para hoje, então o trabalho em aberto fica para amanhã."}
	case n > 0:
		return Texts{
			plural(n, "%d open task waits for tomorrow.", "%d open tasks wait for tomorrow."),
			plural(n, "%d tarefa em aberto fica para amanhã.", "%d tarefas em aberto ficam para amanhã."),
		}.fill(n)
	}
	return Texts{"The open work waits for tomorrow.", "O trabalho em aberto fica para amanhã."}
}

func poolSentence(n int) Texts {
	return Texts{
		plural(n, "%d open task still waits.", "%d open tasks still wait."),
		plural(n, "%d tarefa em aberto ainda espera.", "%d tarefas em aberto ainda esperam."),
	}.fill(n)
}

// reasonsSentence names the day's main reason or two: the most frequent among
// the Tasks, ties by priority, unknown reasons counted together and last.
func reasonsSentence(ts []Task) Texts {
	n := map[string]int{}
	for _, t := range ts {
		key := t.Reason
		if _, ok := clauses[key]; !ok {
			key = ""
		}
		n[key]++
	}
	rank := func(r string) int {
		if i := slices.Index(priority, r); i >= 0 {
			return i
		}
		return len(priority)
	}
	order := slices.SortedFunc(maps.Keys(n), func(a, b string) int {
		return cmp.Or(cmp.Compare(n[b], n[a]), cmp.Compare(rank(a), rank(b)))
	})
	order = order[:min(2, len(order))]
	var en, pt []string
	for _, key := range order {
		c, ok := clauses[key]
		if !ok {
			c = otherClause
		}
		en, pt = append(en, c.en), append(pt, c.pt)
	}
	return Texts{
		"Your day is mostly " + strings.Join(en, " and ") + ".",
		"Seu dia é feito de " + strings.Join(pt, " e ") + ".",
	}
}

// fill puts n in the one %d of each language.
func (t Texts) fill(n int) Texts {
	return Texts{fmt.Sprintf(t.EnUS, n), fmt.Sprintf(t.PtBR, n)}
}

// plural picks the singular form for 1 and the plural otherwise. The forms are
// still templates (their %d is filled by Texts.fill).
func plural(n int, one, many string) string {
	if n == 1 {
		return one
	}
	return many
}
