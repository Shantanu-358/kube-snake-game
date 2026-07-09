variable "aws_region" {
  description = "The AWS region to deploy the infrastructure to"
  type        = string
  default     = "ap-south-2"
}

variable "vpc_cidr" {
  description = "The CIDR block for the custom VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  description = "The CIDR block for the public subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "private_subnet_cidr" {
  description = "The CIDR block for the private subnet"
  type        = string
  default     = "10.0.2.0/24"
}

variable "instance_type" {
  description = "The EC2 instance type"
  type        = string
  default     = "c7i-flex.large"
}

variable "s3_bucket_prefix" {
  description = "The prefix for the unique S3 bucket name"
  type        = string
  default     = "portfolio-private-bucket-"
}
