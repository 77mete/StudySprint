from django.conf import settings
from django.db import models

from processes.models import DonationProcess


class ModerationTicket(models.Model):
    """
    Admin incelemesi gereken itiraz/sikayet kaydi.
    """

    STATUS_OPEN = 'open'
    STATUS_REVIEWING = 'reviewing'
    STATUS_RESOLVED = 'resolved'
    STATUS_REJECTED = 'rejected'

    STATUS_CHOICES = [
        (STATUS_OPEN, 'Acik'),
        (STATUS_REVIEWING, 'Inceleniyor'),
        (STATUS_RESOLVED, 'Cozuldu'),
        (STATUS_REJECTED, 'Reddedildi'),
    ]

    process = models.ForeignKey(
        DonationProcess,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='moderation_tickets',
    )

    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='moderation_tickets',
    )

    ticket_type = models.CharField(max_length=40, default='appeal', db_index=True)
    reason = models.TextField()

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_OPEN, db_index=True)
    admin_notes = models.TextField(blank=True)

    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='moderation_reviews',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    def __str__(self) -> str:
        return f'ModerationTicket(id={self.id}, status={self.status})'

