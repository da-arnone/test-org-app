from django.db import models
from django.utils import timezone


class Organization(models.Model):
    """Top-level entity. Every user session is scoped to exactly one Organization."""

    name = models.CharField(max_length=255, blank=True)

    def __str__(self) -> str:
        return self.name or f"Organization #{self.pk}"


class Contract(models.Model):
    """Belongs to one Organization. Lifecycle managed by the admin surface only."""

    ref = models.CharField(max_length=64, unique=True)
    creation_date = models.DateField(default=timezone.localdate)
    user = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    organization = models.ForeignKey(
        Organization,
        related_name="contracts",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )

    class Meta:
        ordering = ["-creation_date", "ref"]

    def __str__(self) -> str:
        return self.ref
