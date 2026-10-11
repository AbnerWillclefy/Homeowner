output "issuer" {
  description = "The token issuer (iss claim) and the base of the JWKS URL; the API's COGNITO_ISSUER."
  value       = "https://cognito-idp.${data.aws_region.current.region}.amazonaws.com/${aws_cognito_user_pool.this.id}"
}

output "client_id" {
  description = "The PWA app client id; the API's COGNITO_CLIENT_ID and the web build's VITE_COGNITO_CLIENT_ID."
  value       = aws_cognito_user_pool_client.web.id
}

output "user_pool_id" {
  value = aws_cognito_user_pool.this.id
}

output "region" {
  description = "Region of the pool; the web build's VITE_COGNITO_REGION."
  value       = data.aws_region.current.region
}

output "password_policy" {
  description = "The pool's password rules as one JSON object; the web build's VITE_PASSWORD_POLICY. Public."
  value = jsonencode({
    minimum_length    = aws_cognito_user_pool.this.password_policy[0].minimum_length
    require_lowercase = aws_cognito_user_pool.this.password_policy[0].require_lowercase
    require_uppercase = aws_cognito_user_pool.this.password_policy[0].require_uppercase
    require_numbers   = aws_cognito_user_pool.this.password_policy[0].require_numbers
    require_symbols   = aws_cognito_user_pool.this.password_policy[0].require_symbols
  })
}
