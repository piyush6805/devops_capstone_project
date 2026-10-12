# Policy vendored from kubernetes-sigs/aws-load-balancer-controller v3.6.0.
resource "aws_iam_policy" "load_balancer" {
  name   = "${var.cluster_name}-load-balancer"
  policy = file("${path.module}/aws-load-balancer-policy.json")
}

resource "aws_iam_role" "load_balancer" {
  name               = "${var.cluster_name}-load-balancer"
  assume_role_policy = replace(aws_iam_role.ebs.assume_role_policy, "ebs-csi-controller-sa", "aws-load-balancer-controller")
}

resource "aws_iam_role_policy_attachment" "load_balancer" {
  role       = aws_iam_role.load_balancer.name
  policy_arn = aws_iam_policy.load_balancer.arn
}

output "load_balancer_role_arn" {
  value = aws_iam_role.load_balancer.arn
}
