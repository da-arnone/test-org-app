from rest_framework import serializers

from .models import Contract, Organization


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ["id", "name"]


class ContractSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contract
        fields = ["id", "ref", "creation_date", "user", "description", "organization"]
        read_only_fields = ["id", "creation_date"]


class ContractDescriptiveUpdateSerializer(serializers.ModelSerializer):
    """Used by the App surface — only descriptive fields may be updated."""

    class Meta:
        model = Contract
        fields = ["description"]
