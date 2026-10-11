FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

FROM gcr.io/distroless/static-debian12:nonroot
# Lambda Web Adapter: lets the plain net/http server run on Lambda (ADR 0002).
# Inert outside Lambda. Pinned; bump deliberately.
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter
COPY --from=build /out/api /api
# Lambda ignores USER and runs as its own unprivileged user, which cannot enter
# distroless's /home/nonroot (mode 0700, owned by 65532): start from / instead.
WORKDIR /
EXPOSE 8080
ENTRYPOINT ["/api"]
