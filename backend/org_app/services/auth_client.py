"""Auth integration for org-app against auth-app /third/auth.

This module keeps token handling and authorization checks centralized:
- extract_bearer_token(request): reads Authorization header
- validate_token(token): calls auth-app /third/auth/validate
- authorize_request(...): calls auth-app /third/auth/authorize
- current_org_id(request): resolves org context from header/query, with optional
  fallback to token profile context from /third/auth/whois.
"""
import json
import os
from typing import Optional
from urllib import error, request as urlrequest


AUTH_APP_URL = os.getenv("AUTH_APP_URL", "http://localhost:8001").rstrip("/")
ALLOWED_ORG_ROLES = {"org-app", "org-admin"}
PROVIDER_READ_PROFILE = {"appScope": "provider-app", "role": "provider-third"}


def extract_bearer_token(request) -> Optional[str]:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    return auth_header.replace("Bearer ", "", 1).strip() or None


def _post_json(path: str, payload: dict) -> Optional[dict]:
    url = f"{AUTH_APP_URL}{path}"
    body = json.dumps(payload).encode("utf-8")
    req = urlrequest.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlrequest.urlopen(req, timeout=5) as response:
            return json.loads(response.read().decode("utf-8"))
    except (error.URLError, TimeoutError, json.JSONDecodeError):
        return None


def issue_token(username: str, password: str) -> Optional[str]:
    payload = _post_json("/third/auth/token", {"username": username, "password": password})
    if not payload:
        return None
    data = payload.get("data") or {}
    return data.get("accessToken")


def whois(token: str) -> Optional[dict]:
    if not token:
        return None
    payload = _post_json("/third/auth/whois", {"token": token})
    if not payload:
        return None
    return payload.get("data") or None


def validate_token(token: str) -> Optional[dict]:
    if not token:
        return None
    payload = _post_json("/third/auth/validate", {"token": token})
    if not payload:
        return None
    data = payload.get("data") or {}
    if not data.get("valid"):
        return None
    return data.get("claims")


def authorize_request(token: str, context: Optional[str] = None) -> bool:
    if not token:
        return False
    for role in ALLOWED_ORG_ROLES:
        payload = _post_json(
            "/third/auth/authorize",
            {
                "token": token,
                "appScope": "org-app",
                "requiredRole": role,
                "context": context,
            },
        )
        if not payload:
            continue
        data = payload.get("data") or {}
        if bool(data.get("allowed")):
            return True
    return False


def _org_context_from_whois(token: str) -> Optional[int]:
    data = whois(token)
    if not data:
        return None
    profiles = data.get("profiles") or []
    for profile in profiles:
        if profile.get("appScope") != "org-app":
            continue
        if profile.get("role") not in ALLOWED_ORG_ROLES:
            continue
        context = profile.get("context")
        if context is None:
            continue
        if isinstance(context, int):
            return context
        if isinstance(context, str):
            digits = "".join(ch for ch in context if ch.isdigit())
            if digits:
                return int(digits)
    return None


def org_ids_from_profiles(profiles: list[dict]) -> list[int]:
    org_ids = []
    for profile in profiles:
        if profile.get("appScope") != "org-app" or profile.get("role") not in ALLOWED_ORG_ROLES:
            continue
        context = profile.get("context")
        if context is None:
            continue
        if isinstance(context, int):
            org_ids.append(context)
            continue
        if isinstance(context, str):
            digits = "".join(ch for ch in context if ch.isdigit())
            if digits:
                org_ids.append(int(digits))
    return sorted(set(org_ids))


def current_org_id(request, token: Optional[str] = None) -> Optional[int]:
    raw = request.headers.get("X-Organization-Id") or request.GET.get("organization_id")
    if raw is not None:
        try:
            return int(raw)
        except (TypeError, ValueError):
            return None
    if token:
        return _org_context_from_whois(token)
    return None


def has_provider_third_profile(token: str) -> bool:
    data = whois(token)
    if not data:
        return False
    profiles = data.get("profiles") or []
    for profile in profiles:
        if (
            profile.get("appScope") == PROVIDER_READ_PROFILE["appScope"]
            and profile.get("role") == PROVIDER_READ_PROFILE["role"]
        ):
            return True
    return False


def provider_ids_for_third_consultation(token: str) -> list[int]:
    data = whois(token)
    if not data:
        return []
    profiles = data.get("profiles") or []
    provider_ids = []
    for profile in profiles:
        if profile.get("appScope") != PROVIDER_READ_PROFILE["appScope"]:
            continue
        if profile.get("role") != PROVIDER_READ_PROFILE["role"]:
            continue
        context = profile.get("context")
        if context is None:
            continue
        if isinstance(context, int):
            provider_ids.append(context)
            continue
        if isinstance(context, str):
            digits = "".join(ch for ch in context if ch.isdigit())
            if digits:
                provider_ids.append(int(digits))
    return sorted(set(provider_ids))
