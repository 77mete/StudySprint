from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from soyalsite.encrypted_fields import EncryptedTextField


class CustomUser(AbstractUser):
    """
    PRD'deki KVKK anonimlik gereksinimi icin hassas bilgiler (TC/telefon/adres)
    sifreli saklanir ve sadece admin tarafindan serialize edilmesi gerekir.
    """

    ROLE_DONOR = 'donor'
    ROLE_NEED = 'need'
    ROLE_CHOICES = [
        (ROLE_DONOR, 'Bagisci'),
        (ROLE_NEED, 'Ihtiyac Sahibi'),
    ]

    VERIFICATION_PENDING = 'pending'
    VERIFICATION_APPROVED = 'approved'
    VERIFICATION_REJECTED = 'rejected'
    VERIFICATION_CHOICES = [
        (VERIFICATION_PENDING, 'Onay Bekliyor'),
        (VERIFICATION_APPROVED, 'Onaylandi'),
        (VERIFICATION_REJECTED, 'Reddedildi'),
    ]

    role = models.CharField(
        max_length=16,
        choices=ROLE_CHOICES,
        db_index=True,
        default=ROLE_DONOR,
    )

    # Public profile text (PII degil).
    display_name = models.CharField(max_length=60, blank=True)

    # Encrypted PII
    tc_identity = EncryptedTextField(blank=True, null=True)
    phone = EncryptedTextField(blank=True, null=True)
    address = EncryptedTextField(blank=True, null=True)

    # Only meaningful for need owners; for donors it can be left as pending/approved.
    verification_status = models.CharField(
        max_length=20,
        choices=VERIFICATION_CHOICES,
        default=VERIFICATION_PENDING,
        db_index=True,
    )

    is_suspended = models.BooleanField(default=False, db_index=True)

    # Aggregated reputation score (starting point).
    trust_score = models.IntegerField(default=0)

    def __str__(self) -> str:
        return f'{self.username} ({self.get_role_display()})'


def verification_upload_path(instance: 'NeedVerification', filename: str) -> str:
    return f'verification/user_{instance.user_id}/{filename}'


class NeedVerification(models.Model):
    """
    Ihtiyac Sahibi kayit evraklari (ogrenci belgesi, gelir durumu vb.)
    Admin tarafindan onaylanir.
    """

    STATUS_PENDING = CustomUser.VERIFICATION_PENDING
    STATUS_APPROVED = CustomUser.VERIFICATION_APPROVED
    STATUS_REJECTED = CustomUser.VERIFICATION_REJECTED

    STATUS_CHOICES = CustomUser.VERIFICATION_CHOICES

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='need_verification',
    )
    student_document = models.FileField(upload_to=verification_upload_path)
    income_document = models.FileField(upload_to=verification_upload_path)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    admin_notes = models.TextField(blank=True)

    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='need_verification_reviews',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user'], name='unique_need_verification_per_user'),
        ]

    def __str__(self) -> str:
        return f'NeedVerification(user_id={self.user_id}, status={self.status})'

