from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdmin, IsDonor
from audit.utils import create_audit_log
from .models import Listing
from .serializers import ListingSerializer


class ListingCollectionView(APIView):
    """
    - GET: ilanlari listele (anonim)
    - POST: bagisci ilan olusturur
    """

    permission_classes = [permissions.AllowAny]

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated(), IsDonor()]
        return [permissions.AllowAny()]

    def get(self, request, *args, **kwargs):
        qs = Listing.objects.filter(status=Listing.STATUS_ACTIVE).order_by('-created_at')
        serializer = ListingSerializer(qs, many=True)
        return Response({'items': serializer.data})

    def post(self, request, *args, **kwargs):
        if request.user.is_suspended:
            return Response({'detail': 'Hesabiniz askiya alindi.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = ListingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        listing = serializer.save(donor=request.user)
        return Response(ListingSerializer(listing).data, status=status.HTTP_201_CREATED)


class ListingDetailView(APIView):
    """
    - GET: ilan detay
    - PUT/PATCH/DELETE: sadece bagisci
    """

    permission_classes = [permissions.AllowAny]

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [permissions.IsAuthenticated(), IsDonor()]
        return [permissions.AllowAny()]

    def get(self, request, pk: int, *args, **kwargs):
        listing = get_object_or_404(Listing, pk=pk)
        serializer = ListingSerializer(listing)
        return Response(serializer.data)

    def put(self, request, pk: int, *args, **kwargs):
        if request.user.is_suspended:
            return Response({'detail': 'Hesabiniz askiya alindi.'}, status=status.HTTP_403_FORBIDDEN)
        listing = get_object_or_404(Listing, pk=pk)
        if listing.donor != request.user:
            return Response({'detail': 'Bu ilani duzenleyemezsiniz.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = ListingSerializer(listing, data=request.data, partial=False)
        serializer.is_valid(raise_exception=True)
        listing = serializer.save()
        return Response(ListingSerializer(listing).data)

    def patch(self, request, pk: int, *args, **kwargs):
        if request.user.is_suspended:
            return Response({'detail': 'Hesabiniz askiya alindi.'}, status=status.HTTP_403_FORBIDDEN)
        listing = get_object_or_404(Listing, pk=pk)
        if listing.donor != request.user:
            return Response({'detail': 'Bu ilani duzenleyemezsiniz.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = ListingSerializer(listing, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        listing = serializer.save()
        return Response(ListingSerializer(listing).data)

    def delete(self, request, pk: int, *args, **kwargs):
        if request.user.is_suspended:
            return Response({'detail': 'Hesabiniz askiya alindi.'}, status=status.HTTP_403_FORBIDDEN)
        listing = get_object_or_404(Listing, pk=pk)
        if listing.donor != request.user:
            return Response({'detail': 'Bu ilani silemezsiniz.'}, status=status.HTTP_403_FORBIDDEN)

        listing.status = Listing.STATUS_DELETED
        listing.save(update_fields=['status'])
        return Response({'ok': True}, status=status.HTTP_200_OK)


class AdminModerateListingView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request, pk: int, *args, **kwargs):
        listing = get_object_or_404(Listing, pk=pk)

        status_value = request.data.get('status')
        allowed = {Listing.STATUS_PAUSED, Listing.STATUS_DELETED}
        if status_value not in allowed:
            return Response({'detail': 'Gecersiz status.'}, status=status.HTTP_400_BAD_REQUEST)

        listing.status = status_value
        listing.save(update_fields=['status'])

        create_audit_log(
            actor=request.user,
            action_type='listing_moderated',
            target_type='listing',
            target_id=str(listing.id),
            metadata={'status': status_value},
        )

        return Response({'ok': True, 'id': listing.id, 'status': listing.status})
