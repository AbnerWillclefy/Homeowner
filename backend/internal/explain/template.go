package explain

import (
	"fmt"
	"strings"
)

// phrase is a clause about a number of Tasks in each language. Each form
// takes the count as its one %d.
type phrase struct{ enOne, enMany, ptOne, ptMany string }

// phrases is the one table of sentences, keyed by the recorded reason ids
// (allocation.Reason and the reasons dayplan adds). A reason missing here
// reads as the generic sentence; TestEveryRecordedReasonIsHandled keeps the
// table complete. Pool reasons describe Tasks nobody holds.
var phrases = map[string]phrase{
	// Assigned.
	"deadline_today": {"%d task is due today", "%d tasks are due today", "%d tarefa vence hoje", "%d tarefas vencem hoje"},
	"importance":     {"%d task is important", "%d tasks are important", "%d tarefa é importante", "%d tarefas são importantes"},
	"lateness":       {"%d task has been waiting the longest", "%d tasks have been waiting the longest", "%d tarefa está esperando há mais tempo", "%d tarefas estão esperando há mais tempo"},
	"fits_energy":    {"%d task fits your energy", "%d tasks fit your energy", "%d tarefa cabe na sua energia", "%d tarefas cabem na sua energia"},
	"liked":          {"%d task is one you like", "%d tasks are ones you like", "%d tarefa é uma de que você gosta", "%d tarefas são de que você gosta"},
	"spared_dislike": {"%d task is one that someone else would dislike more", "%d tasks are ones that someone else would dislike more", "%d tarefa é uma de que outra pessoa gosta ainda menos", "%d tarefas são de que outra pessoa gosta ainda menos"},
	"turn_taking":    {"%d task is your turn", "%d tasks are your turn", "%d tarefa é a sua vez", "%d tarefas são a sua vez"},
	"taken":          {"%d task is one you took from the pool", "%d tasks are ones you took from the pool", "%d tarefa é uma que você pegou das tarefas em aberto", "%d tarefas são que você pegou das tarefas em aberto"},
	"swapped":        {"%d task came to you in a swap", "%d tasks came to you in a swap", "%d tarefa veio para você em uma troca", "%d tarefas vieram para você em uma troca"},
	// Pool.
	"no_energy_left":      {"%d task did not fit anyone's energy today", "%d tasks did not fit anyone's energy today", "%d tarefa não coube na energia de ninguém hoje", "%d tarefas não couberam na energia de ninguém hoje"},
	"restricted_for_all":  {"%d task stays out because everyone has a restriction on it", "%d tasks stay out because everyone has a restriction on them", "%d tarefa ficou de fora porque todos têm uma restrição sobre ela", "%d tarefas ficaram de fora porque todos têm uma restrição sobre elas"},
	"two_person_deferred": {"%d task needs two people and waits for another day", "%d tasks need two people and wait for another day", "%d tarefa precisa de duas pessoas e fica para outro dia", "%d tarefas precisam de duas pessoas e ficam para outro dia"},
	"weekday_not_allowed": {"%d task is not allowed on this weekday", "%d tasks are not allowed on this weekday", "%d tarefa não é permitida neste dia da semana", "%d tarefas não são permitidas neste dia da semana"},
	"invalid_effort":      {"%d task was left out because its effort is not valid", "%d tasks were left out because their effort is not valid", "%d tarefa ficou de fora porque o esforço dela não é válido", "%d tarefas ficaram de fora porque o esforço delas não é válido"},
	"refused":             {"%d task was refused and is back in the pool", "%d tasks were refused and are back in the pool", "%d tarefa foi recusada e voltou para as tarefas em aberto", "%d tarefas foram recusadas e voltaram para as tarefas em aberto"},
	"added_after_plan":    {"%d task was added after the plan was made", "%d tasks were added after the plan was made", "%d tarefa foi adicionada depois do plano", "%d tarefas foram adicionadas depois do plano"},
}

// generic stands in for a reason the table does not know, so a new reason
// never yields blank text.
var (
	genericTask = phrase{"%d task was planned for you", "%d tasks were planned for you", "%d tarefa foi planejada para você", "%d tarefas foram planejadas para você"}
	genericPool = phrase{"%d task stays in the pool", "%d tasks stay in the pool", "%d tarefa ficou nas tarefas em aberto", "%d tarefas ficaram nas tarefas em aberto"}
)

// Known reports whether the reason has its own sentence.
func Known(reason string) bool { _, ok := phrases[reason]; return ok }

// Template writes the explanation from the facts alone, in both languages: it
// is what every Resident gets when no model text is used, so it is complete by
// itself. It groups Tasks by reason (in the order of first appearance), says
// which are shared with a partner, and mentions the pool only through its
// reasons.
func Template(f Facts) Texts {
	var en, pt []string
	switch {
	case len(f.Tasks) == 0 && f.Energy <= 0:
		en = append(en, "You have no energy set for today, so you have no tasks.")
		pt = append(pt, "Você está sem energia hoje, então não tem tarefas.")
	case len(f.Tasks) == 0:
		en = append(en, "You have no tasks today: nothing fit your energy.")
		pt = append(pt, "Você não tem nenhuma tarefa hoje: nada coube na sua energia.")
	default:
		en, pt = groupSentences(f.Tasks, genericTask)
		if shared := count(f.Tasks, func(t Task) bool { return t.People > 1 }); shared > 0 {
			en = append(en, fmt.Sprintf("Tasks shared with someone else: %d.", shared))
			pt = append(pt, fmt.Sprintf("Tarefas compartilhadas com outra pessoa: %d.", shared))
		}
	}
	if len(f.Pool) > 0 {
		pen, ppt := groupSentences(poolTasks(f.Pool), genericPool)
		en, pt = append(en, pen...), append(pt, ppt...)
	}
	return Texts{EnUS: strings.Join(en, " "), PtBR: strings.Join(pt, " ")}
}

func poolTasks(reasons []string) []Task {
	out := make([]Task, len(reasons))
	for i, r := range reasons {
		out[i] = Task{Reason: r}
	}
	return out
}

// groupSentences makes one sentence per reason, in order of first appearance.
// An unknown reason is counted under the generic phrase.
func groupSentences(tasks []Task, generic phrase) (en, pt []string) {
	var order []string
	n := map[string]int{}
	for _, t := range tasks {
		key := t.Reason
		if !Known(key) {
			key = ""
		}
		if n[key] == 0 {
			order = append(order, key)
		}
		n[key]++
	}
	for _, key := range order {
		p, ok := phrases[key]
		if !ok {
			p = generic
		}
		en = append(en, plural(n[key], p.enOne, p.enMany)+".")
		pt = append(pt, plural(n[key], p.ptOne, p.ptMany)+".")
	}
	return en, pt
}

func plural(n int, one, many string) string {
	if n == 1 {
		return fmt.Sprintf(one, n)
	}
	return fmt.Sprintf(many, n)
}

func count(ts []Task, f func(Task) bool) int {
	n := 0
	for _, t := range ts {
		if f(t) {
			n++
		}
	}
	return n
}
