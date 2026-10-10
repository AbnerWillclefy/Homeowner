# Mirror the work stack: Go, React, Terraform on AWS serverless, within $20/month

The backend is Go on AWS Lambda (built as container images), the app is React, and infrastructure is Terraform on AWS, with Postgres on Neon, Cognito for sign-in and the Anthropic API for LLM calls. Staging and production share one AWS account. Everything lives in one repo. The project exists as much to practise the stack used at work as to ship a product, but infrastructure must stay under $10–20 a month, so wherever the work stack's usual shape costs real money we kept the tools and changed the shape.

## Considered Options

- **ECS Fargate** (how work runs Go containers): rejected because an always-on service plus a load balancer costs tens of dollars a month. Lambda container images keep Docker in the deploy path for pennies.
- **Aurora Serverless v2 with the Data API**: near-zero cost, but the Data API is an AWS SDK rather than the Postgres protocol, so local Docker Postgres and production would talk to the database differently. Neon keeps one `pgx` code path everywhere with no VPC or NAT Gateway (about $33/month).
- **Flutter** for mobile: dropped with the move to a PWA, see ADR 0005.
