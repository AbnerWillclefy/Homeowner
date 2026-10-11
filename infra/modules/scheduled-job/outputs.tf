output "function_name" {
  value = aws_lambda_function.this.function_name
}

output "function_arn" {
  value = aws_lambda_function.this.arn
}

output "rule_arn" {
  value = aws_cloudwatch_event_rule.this.arn
}
