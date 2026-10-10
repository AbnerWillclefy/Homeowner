output "api_url" {
  description = "Base URL of the API, without a trailing slash."
  value       = aws_apigatewayv2_api.this.api_endpoint
}
