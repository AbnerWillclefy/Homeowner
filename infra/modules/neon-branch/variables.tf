variable "project_id" {
  description = "Neon project the branch lives in."
  type        = string
}

variable "branch_name" {
  type = string
}

variable "role_name" {
  type = string
}

variable "database_name" {
  type = string
}

variable "ssm_path_prefix" {
  description = "Where the connection strings are written, for example /homeowner/staging."
  type        = string
}
