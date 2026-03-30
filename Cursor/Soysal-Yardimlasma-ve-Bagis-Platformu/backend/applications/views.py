from datetime import timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import CustomUser
from accounts.permissions import IsDonor, IsNeedOwner
from applications.models import ListingApplication
from listings.models import Listing
from processes.models import DonationProcess
from processes.utils import generate_shipping_code
from audit.utils import create_audit_log


class ApplyToListingView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsNeedOwner]

    def post(self, request, listing_id: int, *args, **kwargs):
        if request.user.is_suspended:
            return Response({'detail': 'Hesabiniz askiya alindi.'}, status=status.HTTP_403_FORBIDDEN)

        if request.user.verification_status != CustomUser.VERIFICATION_APPROVED:
            return Response({'detail': 'Ihtiyac sahibi onayi gerekli.'}, status=status.HTTP_403_FORBIDDEN)

        listing = get_object_or_404(Listing, pk=listing_id)
        if listing.status != Listing.STATUS_ACTIVE:
            return Response({'detail': 'Bu ilan aktif degil.'}, status=status.HTTP_400_BAD_REQUEST)

        existing = ListingApplication.objects.filter(listing=listing, need_user=request.user).first()
        if existing and existing.status != ListingApplication.STATUS_REJECTED:
            return Response({'detail': 'Bu ilan icin zaten bir basvuru var.'}, status=status.HTTP_400_BAD_REQUEST)

        # Haftalik maksimum 2 basvuru limiti (rolling 7 days).
        now = timezone.now()
        week_start = now - timedelta(days=7)
        submitted_count = ListingApplication.objects.filter(
            need_user=request.user,
            submitted_at__gte=week_start,
        ).count()

        # Yeni basvuru veya re-apply denemesi haftalik limiti tuketir.
        if existing is None and submitted_count >= 2:
            return Response(
                {'detail': 'Haftalik maksimum 2 basvuru limitinizi astiniz.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Baslangic otomatik kisitlama: son 30 gunde coklu red (simulasyon).
        # Not: PRD’de "şüpheli hesaplar" kural seti genisletilecek, MVP’de basit sinir koyuyoruz.
        rejected_30d = ListingApplication.objects.filter(
            need_user=request.user,
            status=ListingApplication.STATUS_REJECTED,
            submitted_at__gte=now - timedelta(days=30),
        ).count()
        if rejected_30d >= 2:
            request.user.is_suspended = True
            request.user.save(update_fields=['is_suspended'])
            create_audit_log(
                actor=request.user,
                action_type='user_suspended',
                target_type='user',
                target_id=str(request.user.id),
                metadata={'reason': 'son 30 gunde coklu red (MVP kural seti)'},
            )
            return Response({'detail': 'Hesabiniz guvenlik nedeniyle kisitlandi.'}, status=status.HTTP_403_FORBIDDEN)

        if existing is None:
            app = ListingApplication.objects.create(
                listing=listing,
                need_user=request.user,
                status=ListingApplication.STATUS_SUBMITTED,
            )
        else:
            app = existing
            app.status = ListingApplication.STATUS_SUBMITTED
            app.decided_at = None
            app.save(update_fields=['status', 'decided_at'])

        create_audit_log(
            actor=request.user,
            action_type='application_submitted',
            target_type='listing_application',
            target_id=str(app.id),
            metadata={'listing_id': listing.id},
        )

        return Response({'id': app.id, 'status': app.status, 'submitted_at': app.submitted_at}, status=status.HTTP_201_CREATED)


class ListingApplicationsForDonorView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDonor]

    def get(self, request, listing_id: int, *args, **kwargs):
        listing = get_object_or_404(Listing, pk=listing_id)
        if listing.donor != request.user:
            return Response({'detail': 'Bu ilana ait basvurulara erisim yok.'}, status=status.HTTP_403_FORBIDDEN)

        apps = (
            ListingApplication.objects.filter(listing=listing)
            .exclude(status=ListingApplication.STATUS_REJECTED)
            .order_by('-submitted_at')
        )

        items = [
            {
                'application_id': a.id,
                'status': a.status,
                'submitted_at': a.submitted_at,
                # PII disinda sadece anonim guven sinyali (MVP baslangici).
                'trust_score': getattr(a.need_user, 'trust_score', 0),
            }
            for a in apps
        ]
        return Response({'items': items})


class SelectApplicationView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsDonor]

    def post(self, request, listing_id: int, application_id: int, *args, **kwargs):
        if request.user.is_suspended:
            return Response({'detail': 'Hesabiniz askiya alindi.'}, status=status.HTTP_403_FORBIDDEN)

        now = timezone.now()

        listing = get_object_or_404(Listing, pk=listing_id)
        if listing.donor != request.user:
            return Response({'detail': 'Bu ilan icin seçim yapamazsiniz.'}, status=status.HTTP_403_FORBIDDEN)

        application = get_object_or_404(ListingApplication, pk=application_id, listing=listing)

        if application.status == ListingApplication.STATUS_SELECTED:
            return Response({'detail': 'Bu basvuru zaten secildi.'}, status=status.HTTP_400_BAD_REQUEST)

        if application.status == ListingApplication.STATUS_REJECTED:
            return Response({'detail': 'Reddedilmis basvuru secilemez.'}, status=status.HTTP_400_BAD_REQUEST)

        # Mark application as selected -> unlock controlled messaging (task-004).
        application.mark_selected()

        # Create DonationProcess if not exists.
        process, created_process = DonationProcess.objects.get_or_create(
            application=application,
            defaults={
                'shipping_code': generate_shipping_code(),
                'status': DonationProcess.STATUS_CODE_GENERATED,
                'destination_name': getattr(application.need_user, 'display_name', '') or '',
                'destination_phone_enc': application.need_user.phone,
                'destination_address_enc': application.need_user.address,
                'code_generated_at': now,
            },
        )

        if created_process:
            create_audit_log(
                actor=request.user,
                action_type='code_generated',
                target_type='process',
                target_id=str(process.id),
                metadata={'shipping_code': process.shipping_code},
            )
        else:
            # Ensure code_generated state is present if process existed.
            if process.status != DonationProcess.STATUS_CODE_GENERATED:
                process.status = DonationProcess.STATUS_CODE_GENERATED
                process.code_generated_at = process.code_generated_at or now
                process.save(update_fields=['status', 'code_generated_at'])

        return Response(
            {
                'ok': True,
                'application_id': application.id,
                'status': application.status,
                'shipping_code': process.shipping_code,
            },
            status=status.HTTP_200_OK,
        )
