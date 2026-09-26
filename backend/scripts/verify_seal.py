"""
Check a record seal WITHOUT our server's code: only the seal, our public
keys (GET /api/v1/proof/keys) and two open libraries. Written standalone
on purpose -- it imports nothing from Akayza -- so anyone (a funder, an
auditor, a judge) can see a seal is ours and hasn't been altered.

  python scripts/verify_seal.py seal.json keys.json
  python scripts/verify_seal.py seal.json http://localhost:5000/api/v1/proof/keys

It checks: the key ids, both signatures (Ed25519, RFC 8032; ML-DSA-65,
NIST FIPS 204) over the seal's header, and that the leaves rebuild the
signed Merkle root (RFC 6962). It can't tell whether the records changed
since -- only the owner's "Check my record" compares with today's data.
"""
from __future__ import annotations

import base64
import hashlib
import json
import sys
import urllib.request

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

DOMAIN = b"akayza-record-seal-v1\n"
HEADER = ("v", "alg", "business", "sealed_at", "count", "root")


def canonical(obj) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def merkle_root(leaves: list[bytes]) -> bytes:
    if not leaves:
        return hashlib.sha256(b"").digest()
    if len(leaves) == 1:
        return leaves[0]
    k = 1
    while k * 2 < len(leaves):
        k *= 2
    return hashlib.sha256(b"\x01" + merkle_root(leaves[:k]) + merkle_root(leaves[k:])).digest()


def verify(seal: dict, keys: dict) -> dict:
    """{"ed25519": bool, "ml_dsa_65": bool | None, "tree": bool}"""
    message = DOMAIN + canonical({k: seal[k] for k in HEADER})
    kid = lambda b64: hashlib.sha256(base64.b64decode(b64)).hexdigest()[:16]  # noqa: E731

    ed = keys["ed25519"]
    ok_ed = kid(ed["public_key"]) == seal["key_ids"]["ed25519"]
    try:
        Ed25519PublicKey.from_public_bytes(base64.b64decode(ed["public_key"])).verify(base64.b64decode(seal["sig"]["ed25519"]), message)
    except (InvalidSignature, ValueError):
        ok_ed = False

    ok_ml = None
    if "ML-DSA-65" in seal["alg"]:
        from dilithium_py.ml_dsa import ML_DSA_65

        ml = keys.get("ml_dsa_65")
        sig = seal["sig"].get("ml_dsa_65")
        ok_ml = bool(ml and sig and kid(ml["public_key"]) == seal["key_ids"]["ml_dsa_65"])
        if ok_ml:
            try:
                ok_ml = ML_DSA_65.verify(base64.b64decode(ml["public_key"]), message, base64.b64decode(sig))
            except Exception:
                ok_ml = False

    ids = [(k, i) for k, i, _ in seal["leaves"]]
    tree = (
        len(ids) == seal["count"]
        and ids == sorted(ids)
        and len(set(ids)) == len(ids)
        and merkle_root([bytes.fromhex(h) for _, _, h in seal["leaves"]]).hex() == seal["root"]
    )
    return {"ed25519": ok_ed, "ml_dsa_65": ok_ml, "tree": tree}


def _load(where: str) -> dict:
    if where.startswith(("http://", "https://")):
        with urllib.request.urlopen(where, timeout=10) as r:  # noqa: S310 -- a URL the person chose
            body = json.load(r)
        return body.get("data", {}).get("keys", body)
    with open(where, encoding="utf-8") as f:
        body = json.load(f)
    return body.get("data", {}).get("keys", body) if "data" in body else body


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(__doc__)
        return 2
    seal = _load(argv[1])
    seal = seal.get("seal", seal)
    result = verify(seal, _load(argv[2]))
    mark = lambda v: "valid" if v else ("not in this seal" if v is None else "INVALID")  # noqa: E731
    print(f"Seal of {seal['count']} records, sealed {seal['sealed_at']}")
    print(f"  Ed25519 signature    {mark(result['ed25519'])}")
    print(f"  ML-DSA-65 signature  {mark(result['ml_dsa_65'])}")
    print(f"  Merkle tree          {'intact' if result['tree'] else 'ALTERED'}")
    good = result["ed25519"] and result["tree"] and result["ml_dsa_65"] is not False
    print("This seal is ours and unaltered." if good else "This seal is NOT valid.")
    return 0 if good else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
