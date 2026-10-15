package evals

import (
	"fmt"
	"io"
	"text/tabwriter"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/allocation"
)

// kindOrder fixes the order of the violation rows.
var kindOrder = []allocation.ViolationKind{
	allocation.OverEnergy, allocation.BrokenRestriction, allocation.UnknownTask, allocation.DuplicateTask,
	allocation.WrongResidentCount, allocation.UnknownResident, allocation.WeekdayNotAllowed,
}

const na = "n/a"

// Render writes the comparison as plain text: one row per metric with a
// baseline and an llm column, and with verbose a per-day section. It is a pure
// function of the Report. Whatever the numbers say, it is a report, not a gate.
func Render(w io.Writer, r Report, verbose bool) error {
	if _, err := fmt.Fprintf(w, "Allocator evals  model: %s  days: %d  llm runs per day: %d\n", r.Model, len(r.Days), r.Runs); err != nil {
		return err
	}
	if r.LLMSkipped {
		if _, err := fmt.Fprintln(w, "llm column skipped: ANTHROPIC_API_KEY is not set (or -baseline-only was given)"); err != nil {
			return err
		}
	}
	if _, err := fmt.Fprintln(w); err != nil {
		return err
	}

	var base, llm []Outcome
	for _, d := range r.Days {
		base = append(base, d.Baseline)
		llm = append(llm, d.LLM...)
	}
	b, l := Summarize(base), Summarize(llm)

	tw := tabwriter.NewWriter(w, 0, 8, 2, ' ', 0)
	row := func(label, bv, lv string) {
		if r.LLMSkipped {
			lv = "skipped"
		}
		fmt.Fprintf(tw, "%s\t%s\t%s\n", label, bv, lv)
	}
	row("metric", "baseline", "llm")
	row("runs", fmt.Sprint(b.Runs), fmt.Sprint(l.Runs))
	row("no plan", fmt.Sprint(b.NoPlan), fmt.Sprint(l.NoPlan))
	row("violations (mean per plan)", num(b.ViolationsMean, b.Plans > 0), num(l.ViolationsMean, l.Plans > 0))
	row("violations (worst plan)", count(b.ViolationsWorst, b.Plans > 0), count(l.ViolationsWorst, l.Plans > 0))
	for _, k := range kindOrder {
		if b.ByKind[k] == 0 && l.ByKind[k] == 0 {
			continue
		}
		row("  "+string(k), num(b.ByKind[k], b.Plans > 0), num(l.ByKind[k], l.Plans > 0))
	}
	row("tasks placed", pct(b.TasksPlacedRatio, b.Plans > 0), pct(l.TasksPlacedRatio, l.Plans > 0))
	row("effort placed", pct(b.EffortPlacedRatio, b.Plans > 0), pct(l.EffortPlacedRatio, l.Plans > 0))
	row("fairness spread", num(b.SpreadMean, b.FairnessRuns > 0), num(l.SpreadMean, l.FairnessRuns > 0))
	row("fairness gini", num(b.GiniMean, b.FairnessRuns > 0), num(l.GiniMean, l.FairnessRuns > 0))
	bs, bok := b.PreferenceScore()
	ls, lok := l.PreferenceScore()
	row("preference score", num(bs, bok), num(ls, lok))
	row("  liked/neutral/disliked", split(b, bok), split(l, lok))
	if err := tw.Flush(); err != nil {
		return err
	}

	if verbose {
		return renderDays(w, r)
	}
	return nil
}

func renderDays(w io.Writer, r Report) error {
	if _, err := fmt.Fprintf(w, "\nper day\n\n"); err != nil {
		return err
	}
	tw := tabwriter.NewWriter(w, 0, 8, 2, ' ', 0)
	fmt.Fprintln(tw, "day\tallocator\tviolations\ttasks\teffort\tspread\tpreference")
	line := func(day, who string, o Outcome) {
		if o.NoPlan {
			fmt.Fprintf(tw, "%s\t%s\tno plan\t%s\t%s\t%s\t%s\n", day, who, na, na, na, na)
			return
		}
		m := o.Metrics
		score, ok := m.PreferenceScore()
		fmt.Fprintf(tw, "%s\t%s\t%d\t%d/%d\t%d/%d\t%s\t%s\n", day, who, m.Violations,
			m.TasksPlaced, m.TasksTotal, m.EffortPlaced, m.EffortTotal, num(m.Spread, m.FairnessOK), num(score, ok))
	}
	for _, d := range r.Days {
		line(d.Name, "baseline", d.Baseline)
		for i, o := range d.LLM {
			line(d.Name, fmt.Sprintf("llm #%d", i+1), o)
		}
	}
	return tw.Flush()
}

func num(v float64, ok bool) string {
	if !ok {
		return na
	}
	return fmt.Sprintf("%.2f", v)
}

func pct(v float64, ok bool) string {
	if !ok {
		return na
	}
	return fmt.Sprintf("%.1f%%", v*100)
}

func count(n int, ok bool) string {
	if !ok {
		return na
	}
	return fmt.Sprint(n)
}

func split(s Summary, ok bool) string {
	if !ok {
		return na
	}
	return fmt.Sprintf("%d/%d/%d", s.Liked, s.Neutral, s.Disliked)
}
