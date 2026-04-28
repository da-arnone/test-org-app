from rest_framework.routers import DefaultRouter

from ..views.admin import ContractAdminViewSet, OrganizationAdminViewSet

router = DefaultRouter()
router.register(r"organizations", OrganizationAdminViewSet)
router.register(r"contracts", ContractAdminViewSet)

urlpatterns = router.urls
