package llmalloc

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/explain"
)

// Explainer writes the plain-language explanation of a Home's Day Plan through
// the same Client the Allocator uses: one call covers every Resident of the
// Home. Like the Allocator it is never trusted: the caller keeps the template
// for any Resident whose text is missing or fails explain.Valid.
//
// The model sees opaque ids, numbers, reason ids and the Category vocabulary
// only: no names, no Chore titles, no free text. The text is advisory prose;
// the plan was refereed before and the reason labels on each card stay the
// ground truth.
type Explainer struct {
	client Client
}

// NewExplainer returns an Explainer that asks client.
func NewExplainer(client Client) *Explainer { return &Explainer{client: client} }

// Explain asks the model for one text per Resident and returns the valid ones
// by Resident id. Client errors are returned as they are; an answer that is
// not a well-formed list is ErrInvalidResponse. An entry with an unknown or
// repeated Resident id, or whose text fails explain.Valid, is dropped, so a
// Resident can be missing from the result.
func (e *Explainer) Explain(ctx context.Context, residents []explain.ResidentFacts) (map[string]explain.Texts, error) {
	in := explainInput{Residents: make([]explainResident, len(residents))}
	for i, r := range residents {
		in.Residents[i] = explainResident{ResidentID: r.ResidentID, Facts: r.Facts}
		if in.Residents[i].Facts.Tasks == nil {
			in.Residents[i].Facts.Tasks = []explain.Task{}
		}
		if in.Residents[i].Facts.Pool == nil {
			in.Residents[i].Facts.Pool = []string{}
		}
	}
	user, err := json.Marshal(in)
	if err != nil {
		return nil, fmt.Errorf("llm: build explanation prompt: %w", err)
	}
	raw, err := e.client.Complete(ctx, Request{
		System:    explainSystemPrompt,
		User:      string(user),
		Schema:    explainSchema,
		MaxTokens: min(256+400*len(residents), 4000),
	})
	if err != nil {
		return nil, err
	}
	return decodeExplanations(raw, residents)
}

const explainSystemPrompt = `You explain today's household Day Plan to each Resident of one Home.

The user message is JSON: for each Resident, their energy, the Tasks they were given and the reasons of the Tasks left in the pool.
Each Task has the reason it was given (deadline_today, importance, lateness, fits_energy, liked, spared_dislike, turn_taking, taken, swapped), its category, effort, importance and people (2 means shared with a partner). Pool reasons say why Tasks nobody holds were left out.

Write for each Resident, in the second person ("you"), two or three plain, warm sentences saying why their day looks the way it does.
Use only the facts given. Do not invent reasons, names, times or promises, and do not mention other Residents.
Write each text twice: once in English (en_US) and once in Brazilian Portuguese (pt_BR), at most 400 characters each, plain text only with no links, markup or line breaks.
Answer for every Resident, using their resident_id exactly as given.`

var explainSchema = map[string]any{
	"type":                 "object",
	"additionalProperties": false,
	"required":             []string{"explanations"},
	"properties": map[string]any{
		"explanations": map[string]any{
			"type": "array",
			"items": map[string]any{
				"type":                 "object",
				"additionalProperties": false,
				"required":             []string{"resident_id", "en_US", "pt_BR"},
				"properties": map[string]any{
					"resident_id": map[string]any{"type": "string"},
					"en_US":       map[string]any{"type": "string"},
					"pt_BR":       map[string]any{"type": "string"},
				},
			},
		},
	},
}

type explainInput struct {
	Residents []explainResident `json:"residents"`
}

type explainResident struct {
	ResidentID string        `json:"resident_id"`
	Facts      explain.Facts `json:"facts"`
}

type explainAnswer struct {
	Explanations *[]struct {
		ResidentID string `json:"resident_id"`
		EnUS       string `json:"en_US"`
		PtBR       string `json:"pt_BR"`
	} `json:"explanations"`
}

// decodeExplanations reads the answer strictly, like decode.
func decodeExplanations(raw json.RawMessage, residents []explain.ResidentFacts) (map[string]explain.Texts, error) {
	if len(raw) > maxAnswerBytes {
		return nil, fmt.Errorf("%w: %d bytes", ErrInvalidResponse, len(raw))
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	var a explainAnswer
	if err := dec.Decode(&a); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidResponse, err)
	}
	if err := dec.Decode(&json.RawMessage{}); err != io.EOF {
		return nil, fmt.Errorf("%w: data after the answer", ErrInvalidResponse)
	}
	if a.Explanations == nil {
		return nil, fmt.Errorf("%w: explanations are required", ErrInvalidResponse)
	}

	known := make(map[string]bool, len(residents))
	for _, r := range residents {
		known[r.ResidentID] = true
	}
	seen := map[string]int{}
	for _, x := range *a.Explanations {
		seen[x.ResidentID]++
	}
	out := map[string]explain.Texts{}
	for _, x := range *a.Explanations {
		t := explain.Texts{EnUS: x.EnUS, PtBR: x.PtBR}
		if known[x.ResidentID] && seen[x.ResidentID] == 1 && explain.Valid(t) {
			out[x.ResidentID] = t
		}
	}
	return out, nil
}
