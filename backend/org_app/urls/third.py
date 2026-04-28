from django.urls import path

from ..views.third import AuthoriseView, ContractInfoView, WhoisOrganizationView

urlpatterns = [
    path(
        "organizations/<int:pk>/",
        WhoisOrganizationView.as_view(),
        name="org-app-third-whois",
    ),
    path(
        "contracts/<str:ref>/",
        ContractInfoView.as_view(),
        name="org-app-third-contract",
    ),
    path("authorise/", AuthoriseView.as_view(), name="org-app-third-authorise"),
]
