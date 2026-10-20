output "bucket_name" {
  value = aws_s3_bucket.this.bucket
}

output "bucket_arn" {
  value = aws_s3_bucket.this.arn
}

output "bucket_regional_domain_name" {
  description = "The origin domain the web distribution uses for /avatars/*."
  value       = aws_s3_bucket.this.bucket_regional_domain_name
}
