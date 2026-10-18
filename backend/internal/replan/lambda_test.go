package replan_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/lambda"
	"github.com/aws/aws-sdk-go-v2/service/lambda/types"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/dayplan"
	"github.com/AbnerWillclefy/Homeowner/backend/internal/replan"
)

type fakeClient struct {
	in  *lambda.InvokeInput
	ctx context.Context
	err error
}

func (f *fakeClient) Invoke(ctx context.Context, in *lambda.InvokeInput, _ ...func(*lambda.Options)) (*lambda.InvokeOutput, error) {
	f.in, f.ctx = in, ctx
	return &lambda.InvokeOutput{StatusCode: 202}, f.err
}

func TestLambdaInvokesTheAllocateFunctionAsynchronouslyWithTheReplanEvent(t *testing.T) {
	c := &fakeClient{}
	r := replan.NewLambda(c, "homeowner-staging-allocate")

	if err := r.Replan(context.Background(), "11111111-1111-1111-1111-111111111111"); err != nil {
		t.Fatal(err)
	}

	if c.in.InvocationType != types.InvocationTypeEvent {
		t.Fatalf("invocation type = %q, want Event", c.in.InvocationType)
	}
	if got := *c.in.FunctionName; got != "homeowner-staging-allocate" {
		t.Fatalf("function name = %q", got)
	}
	if c.in.Qualifier != nil {
		t.Fatalf("qualifier = %q, want none", *c.in.Qualifier)
	}
	var got dayplan.ReplanEvent
	if err := json.Unmarshal(c.in.Payload, &got); err != nil {
		t.Fatal(err)
	}
	if want := dayplan.NewReplanEvent("11111111-1111-1111-1111-111111111111"); got != want {
		t.Fatalf("payload = %+v, want %+v", got, want)
	}
	d, ok := c.ctx.Deadline()
	if !ok {
		t.Fatal("the invoke should run under its own timeout")
	}
	if left := time.Until(d); left <= 0 || left > replan.InvokeTimeout {
		t.Fatalf("time left on the invoke = %s, want within (0, %s]", left, replan.InvokeTimeout)
	}
}

func TestLambdaReturnsTheClientError(t *testing.T) {
	clientErr := errors.New("throttled")
	c := &fakeClient{err: clientErr}
	err := replan.NewLambda(c, "f").Replan(context.Background(), "h")
	if !errors.Is(err, clientErr) {
		t.Fatalf("err = %v, want it to wrap %v", err, clientErr)
	}
}
