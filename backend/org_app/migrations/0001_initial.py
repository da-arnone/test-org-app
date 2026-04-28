import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Organization",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("name", models.CharField(blank=True, max_length=255)),
            ],
        ),
        migrations.CreateModel(
            name="Contract",
            fields=[
                ("id", models.BigAutoField(primary_key=True, serialize=False)),
                ("ref", models.CharField(max_length=64, unique=True)),
                ("creation_date", models.DateField(default=django.utils.timezone.now)),
                ("user", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                (
                    "organization",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="contracts",
                        to="org_app.organization",
                    ),
                ),
            ],
            options={"ordering": ["-creation_date", "ref"]},
        ),
    ]
