"""Admin surface — full lifecycle management of organisations and contracts."""
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from ..models import Contract, Organization
from ..serializers import ContractSerializer, OrganizationSerializer


class OrganizationAdminViewSet(ModelViewSet):
    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer


class ContractAdminViewSet(ModelViewSet):
    queryset = Contract.objects.all()
    serializer_class = ContractSerializer

    @action(detail=True, methods=["post"])
    def attach(self, request, pk=None):
        contract = self.get_object()
        org_id = request.data.get("organization_id")
        try:
            organization = Organization.objects.get(pk=org_id)
        except Organization.DoesNotExist:
            return Response(
                {"detail": "organization not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        contract.organization = organization
        contract.save(update_fields=["organization"])
        return Response(ContractSerializer(contract).data)

    @action(detail=True, methods=["post"])
    def detach(self, request, pk=None):
        contract = self.get_object()
        contract.organization = None
        contract.save(update_fields=["organization"])
        return Response(ContractSerializer(contract).data)
