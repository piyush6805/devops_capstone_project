resource "aws_iam_openid_connect_provider" "github" {
  count          = var.github_repository != "" && var.existing_github_oidc_provider_arn == "" ? 1 : 0
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

resource "aws_iam_role" "github" {
  count = var.github_repository == "" ? 0 : 1
  name  = "${var.cluster_name}-github-deploy"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect    = "Allow", Action = "sts:AssumeRoleWithWebIdentity",
    Principal = { Federated = var.existing_github_oidc_provider_arn != "" ? var.existing_github_oidc_provider_arn : aws_iam_openid_connect_provider.github[0].arn },
    Condition = { StringEquals = {
      "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com",
      "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:ref:refs/heads/main"
    } }
  }] })
}

resource "aws_iam_role_policy" "github" {
  count  = var.github_repository == "" ? 0 : 1
  role   = aws_iam_role.github[0].id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = "eks:DescribeCluster", Resource = aws_eks_cluster.main.arn }] })
}

resource "aws_eks_access_entry" "github" {
  count         = var.github_repository == "" ? 0 : 1
  cluster_name  = aws_eks_cluster.main.name
  principal_arn = aws_iam_role.github[0].arn
}

resource "aws_eks_access_policy_association" "github" {
  count         = var.github_repository == "" ? 0 : 1
  cluster_name  = aws_eks_cluster.main.name
  principal_arn = aws_iam_role.github[0].arn
  policy_arn    = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSAdminPolicy"
  access_scope {
    type       = "namespace"
    namespaces = ["stockpilot"]
  }
  depends_on = [aws_eks_access_entry.github]
}

resource "aws_eks_access_policy_association" "github_argocd" {
  count         = var.github_repository == "" ? 0 : 1
  cluster_name  = aws_eks_cluster.main.name
  principal_arn = aws_iam_role.github[0].arn
  policy_arn    = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSAdminPolicy"
  access_scope {
    type       = "namespace"
    namespaces = ["argocd"]
  }
  depends_on = [aws_eks_access_entry.github]
}
