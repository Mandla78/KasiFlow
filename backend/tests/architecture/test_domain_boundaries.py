"""
Domain boundaries, enforced. These fail the build if someone reaches
into code they shouldn't.

1. IDENTITY IS SEALED. Code outside src/domains/identity may only use:
     src.core.decorators (auth_required, current_user)
     src.domains.identity.accounts.services (read a user)
   Never identity's tables, repositories, token/session logic or routes.
2. No feature reads ANOTHER feature's repositories (go through its services).
3. src/shared never imports a domain (tools don't know the business).
"""
from __future__ import annotations

import ast
from pathlib import Path

SRC = Path(__file__).resolve().parents[2] / "src"

IDENTITY_PUBLIC = ("src.domains.identity.accounts.services",)

# The only files allowed to import every feature: they plug features into the app.
WIRING = {"src", "src.api", "src.master_scheduler.registry"}


def _modules():
    for path in SRC.rglob("*.py"):
        if "__pycache__" in path.parts:
            continue
        name = ".".join(path.relative_to(SRC.parent).with_suffix("").parts)
        yield path, name.removesuffix(".__init__")  # a package is named without __init__


def _imports(path: Path) -> list[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    found = []
    pkg = ".".join(path.relative_to(SRC.parent).with_suffix("").parts[:-1])
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            found += [a.name for a in node.names]
        elif isinstance(node, ast.ImportFrom):
            if node.level:  # relative import -> absolute
                base = pkg.split(".")
                base = base[: len(base) - (node.level - 1)] if node.level > 1 else base
                mod = ".".join(base + ([node.module] if node.module else []))
            else:
                mod = node.module or ""
            found.append(mod)
            found += [f"{mod}.{a.name}" for a in node.names]
    return found


def _feature(module: str):
    """('identity', 'auth') for src.domains.identity.auth.services.x"""
    parts = module.split(".")
    if len(parts) >= 4 and parts[:2] == ["src", "domains"]:
        return parts[2], parts[3]
    return None


def test_identity_is_sealed():
    problems = []
    for path, module in _modules():
        if module.startswith("src.domains.identity") or module.startswith("src.core") or module in WIRING:
            continue  # identity itself, core, and the files that wire features into the app
        for imp in _imports(path):
            if imp.startswith("src.domains.identity") and not imp.startswith(IDENTITY_PUBLIC):
                problems.append(f"{module} imports {imp}")
    assert not problems, "Outside code reached into identity:\n" + "\n".join(problems)


def test_no_feature_reads_another_features_repositories():
    problems = []
    for path, module in _modules():
        mine = _feature(module)
        if not mine:
            continue
        for imp in _imports(path):
            theirs = _feature(imp)
            if theirs and theirs != mine and ".repositories" in imp:
                problems.append(f"{module} imports {imp}")
    assert not problems, "Use the other feature's services instead:\n" + "\n".join(problems)


def test_shared_never_imports_a_domain():
    problems = []
    for path, module in _modules():
        if not module.startswith("src.shared"):
            continue
        for imp in _imports(path):
            if imp.startswith("src.domains"):
                problems.append(f"{module} imports {imp}")
    assert not problems, "shared/ must not know the business:\n" + "\n".join(problems)
