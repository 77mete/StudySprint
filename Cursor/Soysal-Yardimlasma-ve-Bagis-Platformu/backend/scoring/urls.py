from django.urls import path

from .views import CreateProcessRatingView

urlpatterns = [
    path('ratings/processes/<int:process_id>/create/', CreateProcessRatingView.as_view(), name='process-rating-create'),
]

