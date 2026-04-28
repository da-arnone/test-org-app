from django.urls import include, path

urlpatterns = [
    path("admin/org/", include("org_app.urls.admin")),
    path("api/org/", include("org_app.urls.api")),
    path("third/org/", include("org_app.urls.third")),
]
