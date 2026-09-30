"""Google sign-in at the API level, no browser: the Firebase Auth EMULATOR issues a Firebase ID token for a fake Google
account, the gateway (started in emulator mode) verifies it by asking the emulator, and answers with its own session.

Standard library only. See e2e/README.md for how to start the emulator and the gateway. It creates its own accounts
(emulator and gateway database), so run it only against test instances:

    python e2e/google-signin.emulator.api.py
    EMULATOR_URL=http://127.0.0.1:9099 GATEWAY_URL=http://localhost:3201/api python e2e/google-signin.emulator.api.py
"""
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request

EMU = os.environ.get("EMULATOR_URL", "http://127.0.0.1:9099").rstrip("/")
GW = os.environ.get("GATEWAY_URL", "http://localhost:3201/api").rstrip("/")
RUN = format(int(time.time()), "x")
results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok)))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f"  -- {detail}" if detail else ""))


def call(method, url, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    if body is not None:
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode() or "null")
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw


def emulator_google_token(sub, email, name, verified=True, provider="google.com"):
    """An ID token from the emulator for a fake Google (or other) account, through its signInWithIdp endpoint."""
    fake_google_id_token = json.dumps({"sub": sub, "email": email, "email_verified": verified, "name": name,
                                       "picture": "https://example.com/avatar.png"})
    status, body = call("POST", f"{EMU}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=fake-api-key", {
        "requestUri": "http://localhost", "returnIdpCredential": True, "returnSecureToken": True,
        "postBody": f"id_token={fake_google_id_token}&providerId={provider}",
    })
    assert status == 200, (status, body)
    return body["idToken"], body["localId"]


print("Google sign-in against the Firebase Auth emulator")
for _ in range(30):
    status, _ = call("GET", f"{GW}/health")
    if status == 200:
        break
    time.sleep(1)
check("test gateway (emulator mode) is up", status == 200, f"HTTP {status}")

print("1. sign up with Google (first sign-in creates the account)")
token1, uid1 = emulator_google_token(f"g-sub-1-{RUN}", f"Emu.Tester.{RUN}@Example.com", "Emu Tester")
payload = json.loads(base64.urlsafe_b64decode(token1.split(".")[1] + "=="))
check("the emulator's token is UNSIGNED (why the gateway asks the emulator instead of checking keys)",
      json.loads(base64.urlsafe_b64decode(token1.split(".")[0] + "==")).get("alg") == "none")
status, body = call("POST", f"{GW}/auth/google", {"idToken": token1, "persona_type": "personal"})
check("gateway accepts the Google token", status == 200 and isinstance(body, dict) and body.get("access_token"), f"HTTP {status} {str(body)[:100] if status != 200 else ''}")
user = (body or {}).get("user", {})
check("a new account was created from the token's identity", body.get("is_new_user") is True and user.get("email") == f"emu.tester.{RUN}@example.com"
      and user.get("full_name") == "Emu Tester" and user.get("auth_provider") == "google", str(user)[:120])
check("the sign-up choice (mode) was applied to the new account", user.get("persona_type") == "personal")
session = body.get("access_token")

print("2. the session works")
status, profile = call("GET", f"{GW}/users/profile", token=session)
check("profile readable with the session", status == 200 and profile.get("email") == f"emu.tester.{RUN}@example.com", f"HTTP {status}")
check("profile never exposes the password hash or the Firebase uid", "password" not in profile and "firebase_uid" not in profile)
status, ds = call("GET", f"{GW}/decision-forge/dataset", token=session)
check("a Google user reaches the DecisionForge data", status == 200 and ds.get("count") == 12, f"HTTP {status}")

print("3. sign in again")
token2, uid2 = emulator_google_token(f"g-sub-1-{RUN}", f"Emu.Tester.{RUN}@Example.com", "Emu Tester")
status, body2 = call("POST", f"{GW}/auth/google", {"idToken": token2, "persona_type": "business"})
check("same person, same account", status == 200 and body2["user"]["id"] == user["id"] and body2.get("is_new_user") is False)
check("sign-up choices are not re-applied to a returning person", body2["user"]["persona_type"] == "personal")

print("4. what must be refused")
status, _ = call("POST", f"{GW}/auth/google", {"idToken": token1[:-3] + "abc"})
check("a tampered token", status == 401, f"HTTP {status}")
status, _ = call("POST", f"{GW}/auth/google", {"idToken": "x" * 60})
check("garbage", status == 401, f"HTTP {status}")
unverified, _ = emulator_google_token(f"g-sub-2-{RUN}", f"unverified.{RUN}@example.com", "Un Verified", verified=False)
status, _ = call("POST", f"{GW}/auth/google", {"idToken": unverified})
check("a Google account with an unverified email", status == 401, f"HTTP {status}")
other, _ = emulator_google_token(f"gh-sub-3-{RUN}", f"github.{RUN}@example.com", "Git Hub", provider="github.com")
status, b = call("POST", f"{GW}/auth/google", {"idToken": other})
check("a valid token for a non-Google provider", status == 401, f"HTTP {status}")
status, _ = call("POST", f"{GW}/auth/google", {})
check("no token", status == 400, f"HTTP {status}")
status, _ = call("POST", f"{GW}/auth/firebase-login", {"email": f"emu.tester.{RUN}@example.com"})
check("the old email-only route cannot be used to sign in as that person", status == 404, f"HTTP {status}")

print("5. linking to an existing email + password account")
status, reg = call("POST", f"{GW}/auth/register", {"email": f"linker.{RUN}@example.com", "password": "registered-first-1", "full_name": "Linker", "monthly_income": 777})
check("register with email and password", status == 201, f"HTTP {status}")
status, _ = call("POST", f"{GW}/auth/login", {"email": f"linker.{RUN}@example.com", "password": "registered-first-1"})
check("password sign-in works before linking", status == 200)
tokenL, _ = emulator_google_token(f"g-sub-linker-{RUN}", f"linker.{RUN}@example.com", "Linker G")
status, linked = call("POST", f"{GW}/auth/google", {"idToken": tokenL})
check("Google sign-in for the same email opens the SAME account (data kept)", status == 200 and linked["user"]["id"] == reg["user"]["id"]
      and linked["user"]["monthly_income"] == 777 and linked.get("is_new_user") is False)
status, _ = call("POST", f"{GW}/auth/login", {"email": f"linker.{RUN}@example.com", "password": "registered-first-1"})
check("the old password is retired once the email is proven through Google", status == 401, f"HTTP {status}")

failed = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(failed)}/{len(results)} checks passed" + (f"; FAILED: {failed}" if failed else ""))
sys.exit(1 if failed else 0)
