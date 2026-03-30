from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdmin
from audit.utils import create_audit_log
from moderation.models import ModerationTicket
from moderation.serializers import (
    ModerationTicketCreateSerializer,
    ModerationTicketReviewSerializer,
)
from processes.models import DonationProcess


class CreateModerationTicketView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        if getattr(request.user, "is_suspended", False):
            return Response({'detail': 'Hesabiniz askiya alindi.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = ModerationTicketCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        process = get_object_or_404(DonationProcess.objects.select_related('application__need_user', 'application__listing__donor'), pk=payload['process_id'])
        donor_user, need_user = process.donor, process.need_user

        if request.user != donor_user and request.user != need_user and not request.user.is_staff:
            return Response({'detail': 'Bu surece itiraz edemezsiniz.'}, status=status.HTTP_403_FORBIDDEN)

        ticket = ModerationTicket.objects.create(
            process=process,
            reporter=request.user,
            ticket_type=payload.get('ticket_type') or 'appeal',
            reason=payload['reason'],
            status=ModerationTicket.STATUS_OPEN,
        )

        create_audit_log(
            actor=request.user,
            action_type='moderation_ticket_created',
            target_type='moderation_ticket',
            target_id=str(ticket.id),
            metadata={'process_id': process.id, 'ticket_type': ticket.ticket_type},
        )

        return Response({'id': ticket.id, 'status': ticket.status}, status=status.HTTP_201_CREATED)


class AdminModerationTicketListView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request, *args, **kwargs):
        qs = ModerationTicket.objects.select_related('process', 'reporter').order_by('-created_at')
        items = [
            {
                'id': t.id,
                'status': t.status,
                'ticket_type': t.ticket_type,
                'reason': t.reason,
                'process_id': t.process_id,
                'reporter_username': getattr(t.reporter, 'username', None),
                'created_at': t.created_at,
            }
            for t in qs
        ]
        return Response({'items': items})


class AdminReviewModerationTicketView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request, pk: int, *args, **kwargs):
        ticket = get_object_or_404(ModerationTicket, pk=pk)
        serializer = ModerationTicketReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        ticket.status = payload['status']
        ticket.admin_notes = payload.get('admin_notes', '')
        ticket.reviewed_by = request.user
        ticket.reviewed_at = timezone.now()
        ticket.save(update_fields=['status', 'admin_notes', 'reviewed_by', 'reviewed_at'])

        create_audit_log(
            actor=request.user,
            action_type='moderation_ticket_reviewed',
            target_type='moderation_ticket',
            target_id=str(ticket.id),
            metadata={'status': ticket.status},
        )

        return Response({'ok': True, 'status': ticket.status})
