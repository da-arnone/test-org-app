"""Interface surface — the only org-app surface other components may call.

Exposes WHOIS-style identity resolution and an AUTHORISE callback used by
peer components (provider-app, subscription-app, auth-app) when they need to
check whether an organisation is permitted to perform an action.
"""
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Contract, Organization
from ..serializers import ContractSerializer, OrganizationSerializer


class WhoisOrganizationView(APIView):
    """Identity resolution: who is this organisation?"""

    def get(self, request, pk):
        try:
            organization = Organization.objects.get(pk=pk)
        except Organization.DoesNotExist:
            return Response({"detail": "organisation not found"}, status=404)
        return Response(OrganizationSerializer(organization).data)


class ContractInfoView(APIView):
    """Cross-component contract lookup by ref."""

    def get(self, request, ref):
        try:
            contract = Contract.objects.get(ref=ref)
        except Contract.DoesNotExist:
            return Response({"detail": "contract not found"}, status=404)
        return Response(ContractSerializer(contract).data)


class AuthoriseView(APIView):
    """AUTHORISE callback.

    Body: { "organization_id": <int>, "action": <str> }

    For the POC any known organisation is permitted to perform any action.
    The shape of the response is what other components consume; the policy
    that lives behind it can grow without changing the contract.
    """

    def post(self, request):
        org_id = request.data.get("organization_id")
        action = request.data.get("action")
        if org_id is None or not action:
            return Response(
                {"detail": "organization_id and action are required"}, status=400
            )
        try:
            organization = Organization.objects.get(pk=org_id)
        except Organization.DoesNotExist:
            return Response(
                {"permitted": False, "detail": "organisation not found"},
                status=404,
            )
        return Response(
            {
                "permitted": True,
                "organization_id": organization.pk,
                "action": action,
            }
        )
