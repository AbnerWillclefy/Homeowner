package evals

import (
	"bytes"
	"fmt"
	"io"
	"maps"
	"slices"
	"text/tabwriter"
)

const na = "n/a"

// stat is a number that may be undefined (nothing to divide), decided once
// where it is built so a row never repeats the check.
type stat struct {
	v  float64
	ok bool
}

// format prints the value with a Printf verb, or n/a when it is undefined.
func (s stat) format(verb string) string {
	if !s.ok {
		return na
	}
	return fmt.Sprintf(verb, s.v)
}

// Render writes the comparison as plain text: one row per metric with a
// baseline and an llm column, and with verbose a per-day section. It is a pure
// function of the Report. Whatever the numbers say, it is a report, not a gate.
func Render(w io.Writer, r Report, verbose bool) error {
	// Everything is written to a buffer, which cannot fail, and copied out once.
	var buf bytes.Buffer
	fmt.Fprintf(&buf, "Allocator evals  model: %s  days: %d  llm runs per day: %d\n", r.Model, len(r.Days), r.Runs)
	if r.LLMSkipped {
		fmt.Fprintln(&buf, "llm column skipped: ANTHROPIC_API_KEY is not set (or -baseline-only was given)")
	}
	fmt.Fprintln(&buf)

	var base, llm []Outcome
	for _, d := range r.Days {
		base = append(base, d.Baseline)
		llm = append(llm, d.LLM...)
	}
	b, l := Summarize(base), Summarize(llm)

	tw := tabwriter.NewWriter(&buf, 0, 8, 2, ' ', 0)
	text := func(label, bv, lv string) {
		if r.LLMSkipped {
			lv = "skipped"
		}
		fmt.Fprintf(tw, "%s\t%s\t%s\n", label, bv, lv)
	}
	row := func(label string, bv, lv stat, verb string) { text(label, bv.format(verb), lv.format(verb)) }
	// perPlan and perFairPlan are defined only when the Summary has plans, or
	// plans with a defined fairness.
	perPlan := func(s Summary, v float64) stat { return stat{v, s.Plans > 0} }
	perFairPlan := func(s Summary, v float64) stat { return stat{v, s.FairnessRuns > 0} }
	score := func(s Summary) stat { v, ok := s.Score(); return stat{v, ok} }

	text("metric", "baseline", "llm")
	text("runs", fmt.Sprint(b.Runs), fmt.Sprint(l.Runs))
	text("no plan", fmt.Sprint(b.NoPlan), fmt.Sprint(l.NoPlan))
	row("violations (mean per plan)", perPlan(b, b.ViolationsMean), perPlan(l, l.ViolationsMean), "%.2f")
	row("violations (worst plan)", perPlan(b, float64(b.ViolationsWorst)), perPlan(l, float64(l.ViolationsWorst)), "%.0f")
	// Only the kinds that occurred get a row, so a new kind is never dropped.
	kinds := slices.Collect(maps.Keys(b.ByKind))
	kinds = append(kinds, slices.Collect(maps.Keys(l.ByKind))...)
	slices.Sort(kinds)
	kinds = slices.Compact(kinds)
	for _, k := range kinds {
		row("  "+string(k), perPlan(b, b.ByKind[k]), perPlan(l, l.ByKind[k]), "%.2f")
	}
	pct := func(s stat) stat { return stat{s.v * 100, s.ok} }
	row("tasks placed", pct(perPlan(b, b.TasksPlacedRatio)), pct(perPlan(l, l.TasksPlacedRatio)), "%.1f%%")
	row("effort placed", pct(perPlan(b, b.EffortPlacedRatio)), pct(perPlan(l, l.EffortPlacedRatio)), "%.1f%%")
	row("fairness spread", perFairPlan(b, b.SpreadMean), perFairPlan(l, l.SpreadMean), "%.2f")
	row("fairness gini", perFairPlan(b, b.GiniMean), perFairPlan(l, l.GiniMean), "%.2f")
	row("preference score", score(b), score(l), "%.2f")
	text("  liked/neutral/disliked", split(b.PrefFit), split(l.PrefFit))
	if err := tw.Flush(); err != nil {
		return err
	}

	if verbose {
		renderDays(&buf, r)
	}
	_, err := w.Write(buf.Bytes())
	return err
}

func renderDays(w io.Writer, r Report) {
	fmt.Fprintf(w, "\nper day\n\n")
	tw := tabwriter.NewWriter(w, 0, 8, 2, ' ', 0)
	fmt.Fprintln(tw, "day\tallocator\tviolations\ttasks\teffort\tspread\tpreference")
	line := func(day, who string, o Outcome) {
		if o.NoPlan {
			fmt.Fprintf(tw, "%s\t%s\tno plan\t%s\t%s\t%s\t%s\n", day, who, na, na, na, na)
			return
		}
		m := o.Metrics
		v, ok := m.Score()
		fmt.Fprintf(tw, "%s\t%s\t%d\t%d/%d\t%d/%d\t%s\t%s\n", day, who, m.Violations,
			m.TasksPlaced, m.TasksTotal, m.EffortPlaced, m.EffortTotal,
			stat{m.Spread, m.FairnessOK}.format("%.2f"), stat{v, ok}.format("%.2f"))
	}
	for _, d := range r.Days {
		line(d.Name, "baseline", d.Baseline)
		for i, o := range d.LLM {
			line(d.Name, fmt.Sprintf("llm #%d", i+1), o)
		}
	}
	tw.Flush()
}

// split prints the liked/neutral/disliked counts, or n/a with no assignments.
func split(p PrefFit) string {
	if p.Assignments == 0 {
		return na
	}
	return fmt.Sprintf("%d/%d/%d", p.Liked, p.Neutral, p.Disliked)
}
