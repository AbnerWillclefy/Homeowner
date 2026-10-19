variable "bucket_name" {
  description = "Name of the private S3 bucket holding the built web app. Bucket names are global, so include the account id."
  type        = string
}

variable "photos_origin_domain" {
  description = "Regional domain of the photo bucket. When set, /avatars/* is served from it as a second origin; empty (the default) changes nothing."
  type        = string
  default     = ""
}

variable "name" {
  description = "Name used for the Origin Access Control and the distribution comment."
  type        = string
}
