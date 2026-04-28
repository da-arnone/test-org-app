from django.urls import path

from ..views.api import (
    ContractDetailView,
    ContractListView,
    CurrentOrganizationView,
    LoginView,
    SessionView,
)

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="org-app-login"),
    path("auth/session/", SessionView.as_view(), name="org-app-session"),
    path("organization/", CurrentOrganizationView.as_view(), name="org-app-current-org"),
    path("contracts/", ContractListView.as_view(), name="org-app-contracts"),
    path("contracts/<int:pk>/", ContractDetailView.as_view(), name="org-app-contract"),
]
