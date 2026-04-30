"""Provider-app integration for org-app provider consultation flows."""
import json
import os
from typing import Any, Optional
from urllib import error, parse, request as urlrequest


PROVIDER_APP_URL = os.getenv("PROVIDER_APP_URL", "http://localhost:8002").rstrip("/")
PROVIDER_CLIENT_DEBUG = os.getenv("PROVIDER_CLIENT_DEBUG", "").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}


def _debug_log(message: str):
    if PROVIDER_CLIENT_DEBUG:
        print(f"[org-app provider-client] {message}")


def _request_json(
    path: str,
    token: Optional[str],
    query: Optional[dict[str, Any]] = None,
    organization_id: Optional[int] = None,
):
    url = f"{PROVIDER_APP_URL}{path}"
    if query:
        url = f"{url}?{parse.urlencode(query)}"

    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if organization_id is not None:
        headers["X-Organization-Id"] = str(organization_id)

    req = urlrequest.Request(url, headers=headers, method="GET")
    _debug_log(f"GET {url}")
    try:
        with urlrequest.urlopen(req, timeout=8) as response:
            body = json.loads(response.read().decode("utf-8"))
            _debug_log(f"OK {response.status} for {url}")
            return body, None, None
    except error.HTTPError as exc:
        detail = None
        try:
            body = exc.read().decode("utf-8")
            parsed = json.loads(body)
            if isinstance(parsed, dict):
                detail = parsed.get("detail") or parsed.get("message")
        except (UnicodeDecodeError, json.JSONDecodeError):
            detail = None
        _debug_log(f"HTTP {exc.code} for {url} detail={detail or '<none>'}")
        return None, exc.code, detail
    except (error.URLError, TimeoutError, json.JSONDecodeError):
        _debug_log(f"ERROR 502 for {url} detail=provider-app unavailable")
        return None, 502, "provider-app unavailable"


def _forms_path(provider_id: int) -> str:
    return f"/third/provider/providers/{provider_id}/forms/"


def list_providers(token: str, organization_id: Optional[int] = None):
    return _request_json(
        "/third/provider/providers/",
        token,
        organization_id=organization_id,
    )


def get_provider(token: str, provider_id: int, organization_id: Optional[int] = None):
    return _request_json(
        f"/third/provider/providers/{provider_id}/",
        token,
        organization_id=organization_id,
    )


def list_provider_forms(token: str, provider_id: int, organization_id: Optional[int] = None):
    return _request_json(
        _forms_path(provider_id),
        token,
        organization_id=organization_id,
    )


def get_provider_summary(token: str, provider_id: int, organization_id: Optional[int] = None):
    forms, status_code, detail = list_provider_forms(
        token, provider_id, organization_id=organization_id
    )
    if status_code:
        return None, status_code, detail
    forms_list = forms if isinstance(forms, list) else []
    return {
        "id": provider_id,
        "name": f"Provider #{provider_id}",
        "public_form_count": len(forms_list),
    }, None, None


def list_provider_answers(
    token: str,
    provider_id: int,
    organization_id: Optional[int] = None,
    include_private: bool = False,
):
    query = (
        {
            "include_private": "true",
            "includePrivate": "true",
        }
        if include_private
        else None
    )
    return _request_json(
        f"/third/provider/providers/{provider_id}/answers/",
        token,
        query=query,
        organization_id=organization_id,
    )
