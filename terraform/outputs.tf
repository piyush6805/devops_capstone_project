output "cluster_name" {
  value = aws_eks_cluster.main.name
}
output "vpc_id" {
  value = aws_vpc.main.id
}
output "kubeconfig_command" {
  value = "aws eks update-kubeconfig --region ${var.aws_region} --name ${aws_eks_cluster.main.name}"
}
output "github_deploy_role_arn" {
  value = try(aws_iam_role.github[0].arn, null)
}
