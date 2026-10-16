from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[1]
EXPECTED_REPO = "https://github.com/piyush6805/devops_capstone_project.git"


def load_one(path: Path) -> dict:
    documents = [item for item in yaml.safe_load_all(path.read_text(encoding="utf-8")) if item]
    assert len(documents) == 1, f"Expected one YAML document in {path}"
    return documents[0]


project = load_one(ROOT / "argocd" / "stockpilot-project.yaml")
application = load_one(ROOT / "argocd" / "stockpilot-application.yaml")
values = load_one(ROOT / "helm" / "stockpilot" / "values-gitops.yaml")

assert project["apiVersion"] == "argoproj.io/v1alpha1"
assert project["kind"] == "AppProject"
assert project["metadata"]["name"] == "stockpilot"
assert project["metadata"]["namespace"] == "argocd"
assert project["spec"]["sourceRepos"] == [EXPECTED_REPO]
assert project["spec"]["destinations"] == [
    {"server": "https://kubernetes.default.svc", "namespace": "stockpilot"}
]

assert application["apiVersion"] == "argoproj.io/v1alpha1"
assert application["kind"] == "Application"
assert application["metadata"]["name"] == "stockpilot"
assert application["metadata"]["namespace"] == "argocd"
assert application["spec"]["project"] == "stockpilot"
source = application["spec"]["source"]
assert source["repoURL"] == EXPECTED_REPO
assert source["targetRevision"] == "main"
assert source["path"] == "helm/stockpilot"
assert source["helm"]["releaseName"] == "stockpilot"
assert source["helm"]["valueFiles"] == ["values-aws.yaml", "values-gitops.yaml"]
assert application["spec"]["destination"]["namespace"] == "stockpilot"
assert application["spec"]["syncPolicy"]["automated"] == {
    "prune": True,
    "selfHeal": True,
    "allowEmpty": False,
}
assert "CreateNamespace=true" in application["spec"]["syncPolicy"]["syncOptions"]
assert application["metadata"]["finalizers"] == [
    "resources-finalizer.argocd.argoproj.io"
]

tag = values["backend"]["tag"]
assert len(tag) == 40 and all(character in "0123456789abcdef" for character in tag)
assert values["frontend"]["tag"] == tag
assert values["backend"]["image"].endswith("-backend")
assert values["frontend"]["image"].endswith("-frontend")

print(f"Argo CD project/application and SHA-pinned Helm values are valid ({tag}).")
