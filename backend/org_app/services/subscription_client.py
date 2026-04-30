"""Subscription-app integration for org-app via third API endpoints."""
import json
import os
from typing import Any, Optional
from urllib import error, parse, request as urlrequest


SUBSCRIPTION_APP_URL = os.getenv(
    "SUBSCRIPTION_APP_URL",
    os.getenv("SUSCRIPTION_APP_URL", "http://localhost:8003"),
).rstrip("/")
THIRD_SUBSCRIPTION_PATH = "/third/subscription/requests/"
THIRD_SUSCRIPTION_LEGACY_PATH = "/third/suscription/requests/"


def _request_json(
    path: str,
    token: Optional[str],
    method: str = "GET",
    body: Optional[dict[str, Any]] = None,
):
    url = f"{SUBSCRIPTION_APP_URL}{path}"
    headers = {"Accept": "application/json"}
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urlrequest.Request(url, data=data, headers=headers, method=method)
    try:
        with urlrequest.urlopen(req, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
            return payload, None, None
    except error.HTTPError as exc:
        detail = None
        try:
            raw = exc.read().decode("utf-8")
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                detail = parsed.get("detail") or parsed.get("message")
        except (UnicodeDecodeError, json.JSONDecodeError):
            detail = None
        return None, exc.code, detail
    except (error.URLError, TimeoutError, json.JSONDecodeError):
        return None, 502, "subscription-app unavailable"


def list_subscription_requests(token: str, organization_id: Optional[int] = None):
    query = {}
    if organization_id is not None:
        query["submitting_entity_type"] = "organization"
        query["submitting_entity_id"] = organization_id
    preferred_path = THIRD_SUBSCRIPTION_PATH
    if query:
        preferred_path = f"{preferred_path}?{parse.urlencode(query)}"

    payload, status_code, detail = _request_json(preferred_path, token, method="GET")
    if status_code != 404:
        return payload, status_code, detail

    # Backward compatibility for environments still exposing the legacy typo.
    legacy_path = THIRD_SUSCRIPTION_LEGACY_PATH
    if query:
        legacy_path = f"{legacy_path}?{parse.urlencode(query)}"
    return _request_json(legacy_path, token, method="GET")


def create_subscription_request(token: str, payload: dict[str, Any]):
    response_payload, status_code, detail = _request_json(
        THIRD_SUBSCRIPTION_PATH, token, method="POST", body=payload
    )
    if status_code != 404:
        return response_payload, status_code, detail

    return _request_json(
        THIRD_SUSCRIPTION_LEGACY_PATH, token, method="POST", body=payload
    )
