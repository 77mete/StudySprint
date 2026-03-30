from django.urls import path

from .views import LoginView, MeView, AdminPendingNeedVerificationsView, AdminSuspendUserView, NeedVerificationMeView, NeedVerificationReviewView, RegisterView

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/me/', MeView.as_view(), name='me'),
    path('need-verification/me/', NeedVerificationMeView.as_view(), name='need-verification-me'),
    path('admin/need-verifications/<int:pk>/review/', NeedVerificationReviewView.as_view(), name='need-verification-review'),
    path('admin/need-verifications/pending/', AdminPendingNeedVerificationsView.as_view(), name='need-verifications-pending'),
    path('admin/users/<int:pk>/suspend/', AdminSuspendUserView.as_view(), name='admin-user-suspend'),
]

