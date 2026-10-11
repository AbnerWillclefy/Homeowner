output "api_url" {
  description = "Set as the repository variable STAGING_API_URL."
  value       = module.http_api.api_url
}

output "web_url" {
  description = "Set as the repository variable STAGING_WEB_URL."
  value       = module.web.url
}

output "web_bucket_name" {
  value = module.web.bucket_name
}

output "web_distribution_id" {
  value = module.web.distribution_id
}

output "ecr_repo_url" {
  value = module.api.ecr_repository_url
}

output "function_name" {
  value = module.api.function_name
}

output "migrate_database_url_param" {
  description = "SSM parameter the deploy workflow reads to run migrations."
  value       = module.database.migrate_database_url_param
}
