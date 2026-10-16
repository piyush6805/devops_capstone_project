mock_provider "aws" {
  mock_data "aws_availability_zones" {
    defaults = { names = ["ap-south-1a", "ap-south-1b"] }
  }
  mock_resource "aws_iam_role" {
    defaults = { arn = "arn:aws:iam::123456789012:role/mock" }
  }
  mock_resource "aws_eks_cluster" {
    defaults = {
      arn      = "arn:aws:eks:ap-south-1:123456789012:cluster/stockpilot-eks"
      identity = [{ oidc = [{ issuer = "https://oidc.eks.ap-south-1.amazonaws.com/id/MOCK" }] }]
    }
  }
  mock_resource "aws_iam_openid_connect_provider" {
    defaults = { arn = "arn:aws:iam::123456789012:oidc-provider/mock" }
  }
  mock_resource "aws_iam_policy" {
    defaults = { arn = "arn:aws:iam::123456789012:policy/mock" }
  }
}

run "network_and_cluster" {
  command = plan
  assert {
    condition     = length(aws_subnet.public) == 2 && length(aws_subnet.private) == 2
    error_message = "The architecture must span two public and two private subnets."
  }
  assert {
    condition     = aws_eks_node_group.main.scaling_config[0].desired_size == 2
    error_message = "The capstone must start with two worker nodes."
  }
  assert {
    condition     = aws_eks_cluster.main.version == "1.35" && aws_eks_cluster.main.upgrade_policy[0].support_type == "STANDARD"
    error_message = "Use the selected version with standard support."
  }
  assert {
    condition     = length(aws_iam_role.github) == 0
    error_message = "GitHub access must be opt-in."
  }
}

run "github_main_branch_only" {
  command = apply
  variables {
    github_repository = "example/stockpilot"
  }
  assert {
    condition     = jsondecode(aws_iam_role.github[0].assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"] == "repo:example/stockpilot:ref:refs/heads/main"
    error_message = "OIDC trust must be restricted to this repository's main branch."
  }
  assert {
    condition     = length(aws_eks_access_policy_association.github_argocd[0].access_scope[0].namespaces) == 1 && contains(aws_eks_access_policy_association.github_argocd[0].access_scope[0].namespaces, "argocd")
    error_message = "The GitHub deploy role must be scoped to the Argo CD namespace to update and observe the GitOps application."
  }
}

run "reject_single_worker" {
  command = plan
  variables {
    node_count = 1
  }
  expect_failures = [var.node_count]
}
