from django.urls import path

from .views import ApplyToListingView, ListingApplicationsForDonorView, SelectApplicationView

urlpatterns = [
    path('listings/<int:listing_id>/apply/', ApplyToListingView.as_view(), name='apply-to-listing'),
    path('listings/<int:listing_id>/applications/', ListingApplicationsForDonorView.as_view(), name='listing-applications'),
    path(
        'listings/<int:listing_id>/applications/<int:application_id>/select/',
        SelectApplicationView.as_view(),
        name='select-application',
    ),
]

