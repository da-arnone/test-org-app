from django.urls import path

from ..views.api import (
    ContractDetailView,
    ContractListView,
    CurrentOrganizationView,
    LoginView,
    ProviderAnswersView,
    ProviderDetailView,
    ProviderFormsView,
    ProviderListView,
    SessionView,
    SubscriptionRequestCreateView,
    SubscriptionRequestListView,
)

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="org-app-login"),
    path("auth/session/", SessionView.as_view(), name="org-app-session"),
    path("organization/", CurrentOrganizationView.as_view(), name="org-app-current-org"),
    path("contracts/", ContractListView.as_view(), name="org-app-contracts"),
    path("contracts/<int:pk>/", ContractDetailView.as_view(), name="org-app-contract"),
    path("providers/", ProviderListView.as_view(), name="org-app-providers"),
    path("providers/<int:provider_id>/", ProviderDetailView.as_view(), name="org-app-provider"),
    path(
        "providers/<int:provider_id>/forms/",
        ProviderFormsView.as_view(),
        name="org-app-provider-forms",
    ),
    path(
        "providers/<int:provider_id>/answers/",
        ProviderAnswersView.as_view(),
        name="org-app-provider-answers",
    ),
    path(
        "subscriptions/requests/",
        SubscriptionRequestListView.as_view(),
        name="org-app-subscription-requests",
    ),
    path(
        "subscriptions/requests/create/",
        SubscriptionRequestCreateView.as_view(),
        name="org-app-subscription-request-create",
    ),
]
