variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "cluster_name" {
  type    = string
  default = "stockpilot-eks"
}

variable "kubernetes_version" {
  type    = string
  default = "1.35"
}

variable "node_count" {
  type    = number
  default = 2
  validation {
    condition     = var.node_count >= 2 && var.node_count <= 4
    error_message = "Use between two and four nodes for this capstone."
  }
}

variable "github_repository" {
  description = "Optional owner/repository for main-branch GitHub OIDC deployment; empty disables it."
  type        = string
  default     = ""
  validation {
    condition     = var.github_repository == "" || can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "Use owner/repository, or leave empty."
  }
}

variable "existing_github_oidc_provider_arn" {
  description = "Reuse an existing account GitHub OIDC provider rather than creating a duplicate."
  type        = string
  default     = ""
}

variable "api_allowed_cidrs" {
  description = "Use your public IP /32. Broader access is needed for an optional GitHub-hosted deployment runner."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}
