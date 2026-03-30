import re

from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import CustomUser
from applications.models import ListingApplication
from processes.models import DonationProcess

from .models import ProcessMessage


class _PIISafeBodyValidator:
    """
    MVP icin basit sunucu tarafinda girdi engelleme.
    Tam kapsamli PII tespiti daha sonra geliştirilebilir.
    """

    @staticmethod
    def validate(body: str) -> None:
        if not body or not body.strip():
            raise ValueError("Mesaj bos olamaz.")

        # TC kimlik no: 11 haneli (bosluk/karakter ayrimi olmadan yakalamaya calisir).
        if re.search(r"\b\d{11}\b", body):
            raise ValueError("Mesaj 11 haneli kimlik bilgisi iceremez.")

        # Basit telefon yakalama: 10-13 haneli uzun rakam grubu.
        if re.search(r"\b\d{10,13}\b", body):
            raise ValueError("Mesaj telefon bilgisi iceremez.")


def _get_participant_users(process: DonationProcess) -> tuple[CustomUser, CustomUser]:
    return process.donor, process.need_user


class ProcessMessageSendView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, process_id: int, *args, **kwargs):
        if getattr(request.user, "is_suspended", False):
            return Response({'detail': 'Hesabiniz askiya alindi.'}, status=status.HTTP_403_FORBIDDEN)

        process = get_object_or_404(
            DonationProcess.objects.select_related(
                'application__listing__donor',
                'application__need_user',
            ),
            pk=process_id,
        )

        # Verify application is in "Aday Secildi" state.
        if process.application.status != ListingApplication.STATUS_SELECTED:
            return Response({'detail': 'Bu surec icin mesajlasma henüz acilmaz.'}, status=status.HTTP_403_FORBIDDEN)

        donor_user, need_user = _get_participant_users(process)

        if request.user != donor_user and request.user != need_user:
            return Response({'detail': 'Bu surece erisim yok.'}, status=status.HTTP_403_FORBIDDEN)

        # Need owner not approved cannot message.
        if request.user == need_user and need_user.verification_status != CustomUser.VERIFICATION_APPROVED:
            return Response({'detail': 'Ihtiyac sahibi onayi gerekli.'}, status=status.HTTP_403_FORBIDDEN)

        receiver = need_user if request.user == donor_user else donor_user
        body = request.data.get('body', '')

        try:
            _PIISafeBodyValidator.validate(body)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        msg = ProcessMessage.objects.create(
            process=process,
            sender=request.user,
            receiver=receiver,
            body=body.strip(),
        )

        return Response({'id': msg.id, 'created_at': msg.created_at}, status=status.HTTP_201_CREATED)


class ProcessMessageListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, process_id: int, *args, **kwargs):
        if getattr(request.user, "is_suspended", False):
            return Response({'detail': 'Hesabiniz askiya alindi.'}, status=status.HTTP_403_FORBIDDEN)

        process = get_object_or_404(DonationProcess, pk=process_id)

        if process.application.status != ListingApplication.STATUS_SELECTED:
            return Response({'detail': 'Bu surec icin mesajlasma henüz acilmaz.'}, status=status.HTTP_403_FORBIDDEN)

        donor_user, need_user = _get_participant_users(process)

        if request.user != donor_user and request.user != need_user:
            return Response({'detail': 'Bu surece erisim yok.'}, status=status.HTTP_403_FORBIDDEN)

        if request.user == need_user and need_user.verification_status != CustomUser.VERIFICATION_APPROVED:
            return Response({'detail': 'Ihtiyac sahibi onayi gerekli.'}, status=status.HTTP_403_FORBIDDEN)

        messages = ProcessMessage.objects.filter(process=process).order_by('created_at')
        payload = [
            {
                'id': m.id,
                'sender_is_me': m.sender_id == request.user.id,
                'body': m.body,
                'created_at': m.created_at,
            }
            for m in messages
        ]
        return Response({'items': payload})
