output "database_url_param" {
  description = "Name of the SSM parameter holding the pooled connection string."
  value       = aws_ssm_parameter.database_url.name
}

output "migrate_database_url_param" {
  description = "Name of the SSM parameter holding the direct connection string."
  value       = aws_ssm_parameter.migrate_database_url.name
}
