from django.urls import path

from .views import DonationProcessStatusView, MarkDeliveredView, MarkShippedView, MyDonationProcessesView

urlpatterns = [
    path('processes/me/', MyDonationProcessesView.as_view(), name='my-processes'),
    path('processes/<int:process_id>/status/', DonationProcessStatusView.as_view(), name='process-status'),
    path('processes/<int:process_id>/shipped/', MarkShippedView.as_view(), name='process-shipped'),
    path('processes/<int:process_id>/delivered/', MarkDeliveredView.as_view(), name='process-delivered'),
]

