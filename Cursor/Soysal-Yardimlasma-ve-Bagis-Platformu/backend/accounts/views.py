from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import NeedVerification
from .permissions import IsAdmin, IsNeedOwner
from .serializers import AdminSuspendUserSerializer, LoginSerializer, NeedVerificationReviewSerializer, RegisterSerializer
from audit.utils import create_audit_log

from django.contrib.auth import authenticate, login
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model

User = get_user_model()


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {
                'id': user.id,
                'username': user.username,
                'role': user.role,
                'verification_status': user.verification_status,
            },
            status=status.HTTP_201_CREATED,
        )


class NeedVerificationMeView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsNeedOwner]

    def get(self, request, *args, **kwargs):
        ver = get_object_or_404(NeedVerification, user=request.user)
        return Response(
            {
                'status': ver.status,
                'admin_notes': ver.admin_notes,
                'submitted_at': ver.submitted_at,
                'reviewed_at': ver.reviewed_at,
            }
        )


class NeedVerificationReviewView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request, pk: int, *args, **kwargs):
        ver = get_object_or_404(NeedVerification, pk=pk)
        serializer = NeedVerificationReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payload = serializer.validated_data
        new_status = payload['status']
        admin_notes = payload.get('admin_notes', '')

        from django.utils import timezone

        ver.status = new_status
        ver.admin_notes = admin_notes
        ver.reviewed_by = request.user
        ver.reviewed_at = timezone.now()
        ver.save(update_fields=['status', 'admin_notes', 'reviewed_by', 'reviewed_at'])

        # Kullanici durumunu senkronize et.
        ver.user.verification_status = new_status
        ver.user.save(update_fields=['verification_status'])

        return Response({'ok': True, 'status': new_status}, status=status.HTTP_200_OK)


class AdminPendingNeedVerificationsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request, *args, **kwargs):
        qs = NeedVerification.objects.select_related('user').filter(status=NeedVerification.STATUS_PENDING).order_by('-submitted_at')
        items = [
            {
                'id': v.id,
                'user_id': v.user_id,
                'username': getattr(v.user, 'username', None),
                'status': v.status,
                'submitted_at': v.submitted_at,
            }
            for v in qs
        ]
        return Response({'items': items})


class AdminSuspendUserView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request, pk: int, *args, **kwargs):
        serializer = AdminSuspendUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        user = get_object_or_404(User, pk=pk)
        user.is_suspended = payload['suspended']
        user.save(update_fields=['is_suspended'])

        create_audit_log(
            actor=request.user,
            action_type='user_suspended',
            target_type='user',
            target_id=str(user.id),
            metadata={'suspended': payload['suspended'], 'reason': payload.get('reason', '')},
        )

        return Response({'ok': True, 'user_id': user.id, 'is_suspended': user.is_suspended})


class LoginView(APIView):
    """
    MVP icin basit login endpoint'i.
    Not: CSRF middleware kaldirildigi icin POST'ler takilmaz.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = authenticate(
            request,
            username=serializer.validated_data['username'],
            password=serializer.validated_data['password'],
        )
        if user is None:
            return Response({'detail': 'Gecersiz kullanici adi veya parola.'}, status=status.HTTP_400_BAD_REQUEST)

        if isinstance(user, AnonymousUser):
            return Response({'detail': 'Gecersiz giris.'}, status=status.HTTP_400_BAD_REQUEST)

        login(request, user)
        return Response(
            {
                'id': user.id,
                'username': user.username,
                'role': user.role,
                'verification_status': user.verification_status,
            },
            status=status.HTTP_200_OK,
        )


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        u = request.user
        return Response(
            {
                'id': u.id,
                'username': u.username,
                'role': u.role,
                'verification_status': getattr(u, 'verification_status', None),
                'is_suspended': getattr(u, 'is_suspended', False),
                'trust_score': getattr(u, 'trust_score', 0),
            }
        )
