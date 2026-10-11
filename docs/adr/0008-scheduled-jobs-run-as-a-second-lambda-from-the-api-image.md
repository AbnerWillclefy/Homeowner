# Scheduled jobs run as a second Lambda from the API image

The daily Allocation job is started by an EventBridge schedule and runs as its own Lambda function built from the same container image as the API, started with the command `events` instead of `serve`. In that mode the Go binary serves an HTTP server whose only routes are `POST /events` and `GET /healthz`; Lambda Web Adapter, already in the image (ADR 0002), forwards any non-HTTP event to `POST /events`, so the schedule reaches Go without new dependencies. The function has no function URL and is not behind the HTTP API, and its resource policy lets only the EventBridge rule invoke it, so no job route is reachable from the internet and the API server has no job route at all.

The handler also checks that the body is an EventBridge scheduled event. That is a guard against stray invocations, not authentication; the protection is that nothing public points at the function.

Future scheduled work (for example the push nudge) follows the same pattern: a new command, a new function from the same image, a new rule, using the `scheduled-job` Terraform module.

## Considered Options

- **A job route on the API server, guarded by a secret**: rejected. The `$default` route of the HTTP API proxies every path, so the route would be on the internet, and one leaked or logged secret would let anyone trigger it.
- **A Go Lambda handler with `aws-lambda-go`**: works without an HTTP server, but needs the image to run two kinds of entry point and the adapter extension to stay out of the way, which cannot be tested locally. Reusing the adapter keeps one way of running Go on Lambda and lets the job's handler be tested over plain HTTP against the real database.
- **A second image and ECR repository**: rejected. It doubles the build and push in the deploy for no gain; `image_config.command` selects the mode.

## Consequences

An invocation the handler rejects or fails does not make the Lambda invocation fail: the adapter returns the response body. That is acceptable because the job plans each Home "at or after" its Allocation time, so the next tick, 15 minutes later, covers a missed one. Failures are visible in the logs, not as Lambda errors.
