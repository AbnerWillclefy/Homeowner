output "api_url" {
  value = module.http_api.api_url
}

output "web_url" {
  value = module.web.url
}

output "web_bucket_name" {
  value = module.web.bucket_name
}

output "web_distribution_id" {
  value = module.web.distribution_id
}

output "admin_url" {
  description = "The admin app's CloudFront URL; the deploy job (#329) reads it."
  value       = module.admin_web.url
}

output "admin_bucket_name" {
  description = "The admin app's private bucket; the deploy job (#329) syncs the build to it."
  value       = module.admin_web.bucket_name
}

output "admin_distribution_id" {
  description = "The admin app's CloudFront distribution; the deploy job (#329) invalidates it."
  value       = module.admin_web.distribution_id
}

output "cognito_client_id" {
  description = "The PWA's app client id; the deploy passes it to the web build as VITE_COGNITO_CLIENT_ID. Public."
  value       = module.auth.client_id
}

output "cognito_region" {
  description = "Region of the user pool; the deploy passes it to the web build as VITE_COGNITO_REGION. Public."
  value       = module.auth.region
}

output "cognito_password_policy" {
  description = "The pool's password rules as JSON; the deploy passes it to the web build as VITE_PASSWORD_POLICY. Public."
  value       = module.auth.password_policy
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
