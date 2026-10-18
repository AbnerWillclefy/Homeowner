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
	if _, ok := c.ctx.Deadline(); !ok {
		t.Fatal("the invoke should run under its own timeout")
	}
}

func TestLambdaReturnsTheClientError(t *testing.T) {
	c := &fakeClient{err: errors.New("throttled")}
	err := replan.NewLambda(c, "f").Replan(context.Background(), "h")
	if err == nil {
		t.Fatal("want an error")
	}
}

func TestLambdaTimeoutIsShort(t *testing.T) {
	c := &fakeClient{}
	_ = replan.NewLambda(c, "f").Replan(context.Background(), "h")
	d, _ := c.ctx.Deadline()
	if time.Until(d) > 10*time.Second {
		t.Fatalf("timeout too long: %s", time.Until(d))
	}
}
