from django.urls import path

from .views import ProcessMessageListView, ProcessMessageSendView

urlpatterns = [
    path('messages/processes/<int:process_id>/', ProcessMessageListView.as_view(), name='process-message-list'),
    path('messages/processes/<int:process_id>/send/', ProcessMessageSendView.as_view(), name='process-message-send'),
]

