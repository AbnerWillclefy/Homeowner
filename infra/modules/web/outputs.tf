output "bucket_name" {
  value = aws_s3_bucket.this.bucket
}

output "distribution_id" {
  value = aws_cloudfront_distribution.this.id
}

output "distribution_arn" {
  value = aws_cloudfront_distribution.this.arn
}

output "domain_name" {
  description = "The default CloudFront domain, for example dxxxx.cloudfront.net."
  value       = aws_cloudfront_distribution.this.domain_name
}

output "url" {
  value = "https://${aws_cloudfront_distribution.this.domain_name}"
}
