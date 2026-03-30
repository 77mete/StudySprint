from django.urls import path

from .views import AdminModerateListingView, ListingCollectionView, ListingDetailView

urlpatterns = [
    path('listings/', ListingCollectionView.as_view(), name='listings-collection'),
    path('listings/<int:pk>/', ListingDetailView.as_view(), name='listings-detail'),
    path('admin/listings/<int:pk>/moderate/', AdminModerateListingView.as_view(), name='admin-listing-moderate'),
]

