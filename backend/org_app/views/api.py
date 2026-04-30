"""App surface — read-oriented access scoped to the user's organisation.

Contract creation, deletion, and attach/detach are not available here —
they live on the admin surface. The only mutation allowed is updating
descriptive fields (currently `description`).
"""
import json

from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Contract, Organization
from ..serializers import (
    ContractDescriptiveUpdateSerializer,
    ContractSerializer,
    OrganizationSerializer,
)
from ..services.auth_client import (
    authorize_request,
    current_org_id,
    extract_bearer_token,
    issue_token,
    org_ids_from_profiles,
    validate_token,
    whois,
)
from ..services.provider_client import (
    get_provider,
    list_provider_answers,
    list_provider_forms,
    list_providers,
)
from ..services.subscription_client import (
    create_subscription_request,
    list_subscription_requests,
)


def _require_authorized_org_context(request):
    token = extract_bearer_token(request)
    if not token:
        return (
            None,
            Response(
                {"detail": "missing bearer token (Authorization: Bearer <token>)"},
                status=401,
            ),
            None,
        )
    claims = validate_token(token)
    if not claims:
        return None, Response({"detail": "invalid token"}, status=401), None

    org_id = current_org_id(request, token=token)
    if org_id is None:
        return (
            None,
            Response(
                {
                    "detail": (
                        "no organisation context (set X-Organization-Id header or "
                        "provide token with org-app context profile)"
                    )
                },
                status=400,
            ),
            None,
        )
    if not authorize_request(token, context=f"org-{org_id:03d}"):
        return (
            None,
            Response({"detail": "forbidden for this organisation"}, status=403),
            None,
        )
    return org_id, None, claims


def _require_provider_consultation_access(request):
    org_id, error, _claims = _require_authorized_org_context(request)
    if error:
        return None, None, error

    token = extract_bearer_token(request)
    if not token:
        return None, None, Response({"detail": "missing bearer token"}, status=401)
    return org_id, token, None


class LoginView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        try:
            data = json.loads((request.body or b"{}").decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            data = {}

        username = data.get("username")
        password = data.get("password")
        if not username or not password:
            return Response({"detail": "username and password are required"}, status=400)

        token = issue_token(username, password)
        if not token:
            return Response({"detail": "invalid credentials"}, status=401)

        session = whois(token)
        if not session:
            return Response({"detail": "login succeeded but profile lookup failed"}, status=502)

        profiles = session.get("profiles") or []
        org_ids = org_ids_from_profiles(profiles)
        if not org_ids:
            return Response(
                {"detail": "no org-app profile is assigned to this user"},
                status=403,
            )

        return Response(
            {
                "accessToken": token,
                "user": {
                    "userId": session.get("userId"),
                    "username": session.get("username"),
                    "profiles": profiles,
                    "organizationIds": org_ids,
                },
            }
        )


class SessionView(APIView):
    def get(self, request):
        token = extract_bearer_token(request)
        if not token:
            return Response({"detail": "missing bearer token"}, status=401)
        claims = validate_token(token)
        if not claims:
            return Response({"detail": "invalid token"}, status=401)

        session = whois(token)
        if not session:
            return Response({"detail": "failed to load session from auth-app"}, status=502)

        profiles = session.get("profiles") or []
        org_ids = org_ids_from_profiles(profiles)
        return Response(
            {
                "userId": session.get("userId"),
                "username": session.get("username"),
                "profiles": profiles,
                "organizationIds": org_ids,
            }
        )


class CurrentOrganizationView(APIView):
    def get(self, request):
        org_id, error, _claims = _require_authorized_org_context(request)
        if error:
            return error
        try:
            organization = Organization.objects.get(pk=org_id)
        except Organization.DoesNotExist:
            return Response({"detail": "organisation not found"}, status=404)
        return Response(OrganizationSerializer(organization).data)


class ContractListView(APIView):
    def get(self, request):
        org_id, error, _claims = _require_authorized_org_context(request)
        if error:
            return error
        contracts = Contract.objects.filter(organization_id=org_id)
        return Response(ContractSerializer(contracts, many=True).data)


class ContractDetailView(APIView):
    def _fetch(self, pk, org_id):
        try:
            return Contract.objects.get(pk=pk, organization_id=org_id), None
        except Contract.DoesNotExist:
            return None, Response({"detail": "contract not found"}, status=404)

    def get(self, request, pk):
        org_id, error, _claims = _require_authorized_org_context(request)
        if error:
            return error
        contract, missing = self._fetch(pk, org_id)
        if missing:
            return missing
        return Response(ContractSerializer(contract).data)

    def patch(self, request, pk):
        org_id, error, _claims = _require_authorized_org_context(request)
        if error:
            return error
        contract, missing = self._fetch(pk, org_id)
        if missing:
            return missing
        serializer = ContractDescriptiveUpdateSerializer(
            contract, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ContractSerializer(contract).data)


class ProviderListView(APIView):
    """Read-only public provider list proxied from provider-app."""

    def get(self, request):
        org_id, token, error = _require_provider_consultation_access(request)
        if error:
            return error
        payload, status_code, detail = list_providers(token, organization_id=org_id)
        if status_code:
            return Response({"detail": detail or "failed to fetch providers"}, status=status_code)
        return Response(payload)


class ProviderDetailView(APIView):
    """Read-only public provider details proxied from provider-app."""

    def get(self, request, provider_id):
        org_id, token, error = _require_provider_consultation_access(request)
        if error:
            return error
        payload, status_code, detail = get_provider(
            token,
            provider_id,
            organization_id=org_id,
        )
        if status_code:
            return Response({"detail": detail or "failed to fetch provider"}, status=status_code)
        return Response(payload)


class ProviderFormsView(APIView):
    """Read-only public provider forms proxied from provider-app."""

    def get(self, request, provider_id):
        org_id, token, error = _require_provider_consultation_access(request)
        if error:
            return error
        payload, status_code, detail = list_provider_forms(
            token,
            provider_id,
            organization_id=org_id,
        )
        if status_code:
            return Response(
                {"detail": detail or "failed to fetch provider forms"},
                status=status_code,
            )
        return Response(payload)


class ProviderAnswersView(APIView):
    """Provider answers proxied from provider-app (private answers when authorized)."""

    def get(self, request, provider_id):
        org_id, token, error = _require_provider_consultation_access(request)
        if error:
            return error
        payload, status_code, detail = list_provider_answers(
            token,
            provider_id,
            organization_id=org_id,
            include_private=True,
        )
        if status_code:
            return Response(
                {"detail": detail or "failed to fetch provider answers"},
                status=status_code,
            )
        return Response(payload)


class SubscriptionRequestListView(APIView):
    """List subscription requests for the current organisation (proxied to subscription-app)."""

    def get(self, request):
        org_id, token, error = _require_provider_consultation_access(request)
        if error:
            return error
        payload, status_code, detail = list_subscription_requests(token, organization_id=org_id)
        if status_code:
            return Response(
                {"detail": detail or "failed to fetch subscription requests"},
                status=status_code,
            )
        return Response(payload)


class SubscriptionRequestCreateView(APIView):
    """Create a subscription request for private provider data (proxied to subscription-app)."""

    def post(self, request):
        org_id, token, error = _require_provider_consultation_access(request)
        if error:
            return error
        provider_id = request.data.get("provider_id")
        if provider_id is None:
            return Response({"detail": "provider_id is required"}, status=400)
        body = {
            "submitting_entity_id": org_id,
            "submitting_entity_type": "organization",
            "submitee_entity_id": int(provider_id),
            "submitee_entity_type": "provider",
            "requested_private_fields": request.data.get("requested_private_fields") or [],
            "reason": request.data.get("reason", ""),
        }
        payload, status_code, detail = create_subscription_request(token, body)
        if status_code:
            return Response(
                {"detail": detail or "failed to create subscription request"},
                status=status_code,
            )
        return Response(payload, status=201)
