from django.urls import path

from .views import (
    AdminModerationTicketListView,
    AdminReviewModerationTicketView,
    CreateModerationTicketView,
)

urlpatterns = [
    path('moderation/tickets/', CreateModerationTicketView.as_view(), name='moderation-ticket-create'),
    path('admin/moderation/tickets/', AdminModerationTicketListView.as_view(), name='moderation-ticket-list'),
    path(
        'admin/moderation/tickets/<int:pk>/review/',
        AdminReviewModerationTicketView.as_view(),
        name='moderation-ticket-review',
    ),
]

