from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import CustomUser
from audit.utils import create_audit_log
from processes.models import DonationProcess


def _get_participants(process: DonationProcess) -> tuple[CustomUser, CustomUser]:
    return process.donor, process.need_user


class MyDonationProcessesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        if getattr(user, "is_suspended", False):
            return Response({'detail': 'Hesabiniz askiya alindi.'}, status=status.HTTP_403_FORBIDDEN)

        qs1 = DonationProcess.objects.select_related(
            'application__listing',
            'application__need_user',
            'application__listing__donor',
        ).filter(application__need_user=user)

        qs2 = DonationProcess.objects.select_related(
            'application__listing',
            'application__need_user',
            'application__listing__donor',
        ).filter(application__listing__donor=user)

        processes = (qs1 | qs2).order_by('-created_at')

        items = []
        for p in processes:
            donor_user, _ = _get_participants(p)
            items.append(
                {
                    'process_id': p.id,
                    'status': p.status,
                    'application_status': p.application.status,
                    'listing_title': p.application.listing.title,
                    'shipping_code': p.shipping_code if user == donor_user or user.is_staff else None,
                }
            )
        return Response({'items': items})


class DonationProcessStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, process_id: int, *args, **kwargs):
        if getattr(request.user, "is_suspended", False):
            return Response({'detail': 'Hesabiniz askiya alindi.'}, status=status.HTTP_403_FORBIDDEN)

        process = get_object_or_404(
            DonationProcess.objects.select_related('application__listing__donor', 'application__need_user'),
            pk=process_id,
        )

        donor_user, need_user = _get_participants(process)
        if request.user != donor_user and request.user != need_user and not request.user.is_staff:
            return Response({'detail': 'Bu surece erisim yok.'}, status=status.HTTP_403_FORBIDDEN)

        return Response(
            {
                'process_id': process.id,
                'status': process.status,
                'shipping_code': process.shipping_code if request.user == donor_user or request.user.is_staff else None,
                'application_status': process.application.status,
                'listing_title': process.application.listing.title,
            }
        )


class MarkShippedView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, process_id: int, *args, **kwargs):
        if getattr(request.user, "is_suspended", False):
            return Response({'detail': 'Hesabiniz askiya alindi.'}, status=status.HTTP_403_FORBIDDEN)

        if getattr(request.user, "role", None) != CustomUser.ROLE_DONOR and not request.user.is_staff:
            return Response({'detail': 'Sadece bagisci islem yapabilir.'}, status=status.HTTP_403_FORBIDDEN)

        process = get_object_or_404(
            DonationProcess.objects.select_related('application__listing__donor', 'application__need_user'),
            pk=process_id,
        )
        donor_user, _ = _get_participants(process)
        if request.user != donor_user and not request.user.is_staff:
            return Response({'detail': 'Bu surece erisim yok.'}, status=status.HTTP_403_FORBIDDEN)

        if process.status != DonationProcess.STATUS_CODE_GENERATED:
            return Response({'detail': 'Kargo kodu olusmadan kargoya verilemez.'}, status=status.HTTP_400_BAD_REQUEST)

        process.status = DonationProcess.STATUS_SHIPPED
        process.shipped_at = timezone.now()
        process.save(update_fields=['status', 'shipped_at', 'updated_at'])

        create_audit_log(
            actor=request.user,
            action_type='process_shipped',
            target_type='process',
            target_id=str(process.id),
            metadata={'application_id': process.application.id},
        )

        return Response({'ok': True, 'status': process.status})


class MarkDeliveredView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, process_id: int, *args, **kwargs):
        if getattr(request.user, "is_suspended", False):
            return Response({'detail': 'Hesabiniz askiya alindi.'}, status=status.HTTP_403_FORBIDDEN)

        if getattr(request.user, "role", None) != CustomUser.ROLE_NEED and not request.user.is_staff:
            return Response({'detail': 'Sadece ihtiyac sahibi teslim onayi verebilir.'}, status=status.HTTP_403_FORBIDDEN)

        process = get_object_or_404(
            DonationProcess.objects.select_related('application__listing__donor', 'application__need_user'),
            pk=process_id,
        )
        _, need_user = _get_participants(process)
        if request.user != need_user and not request.user.is_staff:
            return Response({'detail': 'Bu surece erisim yok.'}, status=status.HTTP_403_FORBIDDEN)

        if need_user.verification_status != CustomUser.VERIFICATION_APPROVED and not request.user.is_staff:
            return Response({'detail': 'Ihtiyac sahibi onayi gerekli.'}, status=status.HTTP_403_FORBIDDEN)

        if process.status != DonationProcess.STATUS_SHIPPED:
            return Response({'detail': 'Kargoya verilmeden teslim alindi denilemez.'}, status=status.HTTP_400_BAD_REQUEST)

        process.status = DonationProcess.STATUS_DELIVERED
        process.delivered_at = timezone.now()
        process.save(update_fields=['status', 'delivered_at', 'updated_at'])

        create_audit_log(
            actor=request.user,
            action_type='process_delivered',
            target_type='process',
            target_id=str(process.id),
            metadata={'application_id': process.application.id},
        )

        return Response({'ok': True, 'status': process.status})
