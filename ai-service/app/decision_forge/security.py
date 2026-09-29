"""
Service-to-service protection for the DecisionForge routes.

The ai-service is meant to sit behind the NestJS gateway, which authenticates users (JWT) and
passes the caller's id as the workspace. If AI_SERVICE_TOKEN is set, every request must also
carry the same value in `X-Internal-Token`, so the service cannot be called directly by anyone
who can merely reach its URL. When the variable is unset (local development) the check is off.
"""
import hmac
import os
from typing import Optional

from fastapi import Header, HTTPException


def verify_internal_token(x_internal_token: Optional[str] = Header(default=None)) -> None:
    expected = os.environ.get("AI_SERVICE_TOKEN", "")
    if not expected:
        return
    if not x_internal_token or not hmac.compare_digest(x_internal_token.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Invalid or missing service token.")
