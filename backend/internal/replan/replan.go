// Package replan is the staging-only way to ask the Allocation function to plan
// one Home again. The API route POST /dev/replan calls a Replanner; the real one
// invokes the Allocation Lambda asynchronously, the fake records the Home ids.
package replan

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/lambda"
	"github.com/aws/aws-sdk-go-v2/service/lambda/types"

	"github.com/AbnerWillclefy/Homeowner/backend/internal/dayplan"
)

// Replanner asks for a fresh plan of one Home. It returns once the request is
// queued, not when the plan exists.
type Replanner interface {
	Replan(ctx context.Context, homeID string) error
}

// invokeTimeout bounds queueing the invocation; an Event invoke returns as soon
// as Lambda accepts it.
const invokeTimeout = 5 * time.Second

// lambdaClient is the slice of the AWS Lambda client the adapter needs.
type lambdaClient interface {
	Invoke(ctx context.Context, in *lambda.InvokeInput, opts ...func(*lambda.Options)) (*lambda.InvokeOutput, error)
}

// Lambda is the Replanner that invokes the Allocation function.
type Lambda struct {
	client   lambdaClient
	function string
}

// NewLambda returns a Replanner that invokes function through client. Pass a
// *lambda.Client in production.
func NewLambda(client lambdaClient, function string) *Lambda {
	return &Lambda{client: client, function: function}
}

// Replan sends the replan event for homeID with invocation type Event, so
// Lambda queues it and answers at once. The number of retries is a property of
// the function's event invoke config (infra), not of this call.
func (l *Lambda) Replan(ctx context.Context, homeID string) error {
	payload, err := json.Marshal(dayplan.NewReplanEvent(homeID))
	if err != nil {
		return fmt.Errorf("encode replan event: %w", err)
	}
	ctx, cancel := context.WithTimeout(ctx, invokeTimeout)
	defer cancel()
	_, err = l.client.Invoke(ctx, &lambda.InvokeInput{
		FunctionName:   aws.String(l.function),
		InvocationType: types.InvocationTypeEvent,
		Payload:        payload,
	})
	if err != nil {
		return fmt.Errorf("invoke %s: %w", l.function, err)
	}
	return nil
}
