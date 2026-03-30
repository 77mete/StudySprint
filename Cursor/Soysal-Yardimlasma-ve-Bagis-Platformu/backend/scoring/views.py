from django.db import IntegrityError
from django.db.models import Avg
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from audit.utils import create_audit_log
from processes.models import DonationProcess
from scoring.models import ProcessRating
from scoring.serializers import ProcessRatingSerializer


class CreateProcessRatingView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, process_id: int, *args, **kwargs):
        if getattr(request.user, "is_suspended", False):
            return Response({'detail': 'Hesabiniz askiya alindi.'}, status=status.HTTP_403_FORBIDDEN)

        process = get_object_or_404(
            DonationProcess.objects.select_related(
                'application__need_user',
                'application__listing__donor',
            ),
            pk=process_id,
        )
        donor_user, need_user = process.donor, process.need_user

        if request.user != donor_user and request.user != need_user and not request.user.is_staff:
            return Response({'detail': 'Bu surece erisim yok.'}, status=status.HTTP_403_FORBIDDEN)

        if process.status != DonationProcess.STATUS_DELIVERED:
            return Response({'detail': 'Puanlama icin teslim onayi gerekir.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ProcessRatingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        if ProcessRating.objects.filter(process=process, given_by=request.user).exists():
            return Response({'detail': 'Bu surec icin puanlamayi zaten yaptiniz.'}, status=status.HTTP_400_BAD_REQUEST)

        given_to = need_user if request.user == donor_user else donor_user

        try:
            rating = ProcessRating.objects.create(
                process=process,
                given_by=request.user,
                given_to=given_to,
                value=payload['value'],
                comment=payload.get('comment', ''),
            )
        except IntegrityError:
            return Response({'detail': 'Puanlama kaydi olusturulamadi.'}, status=status.HTTP_400_BAD_REQUEST)

        create_audit_log(
            actor=request.user,
            action_type='rating_created',
            target_type='process_rating',
            target_id=str(rating.id),
            metadata={'process_id': process.id, 'value': payload['value']},
        )

        # Trust score (MVP): verilen kullanicinin gelen puanlar ortalamasini kullan.
        for user in [donor_user, need_user]:
            avg = ProcessRating.objects.filter(given_to=user).aggregate(a=Avg('value')).get('a')
            if avg is None:
                continue
            user.trust_score = int(round(avg))
            user.save(update_fields=['trust_score'])

        has_donor_rating = ProcessRating.objects.filter(process=process, given_by=donor_user).exists()
        has_need_rating = ProcessRating.objects.filter(process=process, given_by=need_user).exists()

        if has_donor_rating and has_need_rating and process.status == DonationProcess.STATUS_DELIVERED:
            process.status = DonationProcess.STATUS_COMPLETED
            process.completed_at = timezone.now()
            process.save(update_fields=['status', 'completed_at', 'updated_at'])

            create_audit_log(
                actor=request.user,
                action_type='process_completed',
                target_type='process',
                target_id=str(process.id),
                metadata={},
            )

        return Response(
            {'ok': True, 'rating_id': rating.id, 'process_status': process.status},
            status=status.HTTP_201_CREATED,
        )
