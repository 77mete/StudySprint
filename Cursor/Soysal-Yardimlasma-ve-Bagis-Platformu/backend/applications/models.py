from django.conf import settings
from django.db import models
from django.utils import timezone

from listings.models import Listing


class ListingApplication(models.Model):
    """
    Ihtiyac sahibinin bir ilana verdigi talep/basvuru.
    """

    STATUS_SUBMITTED = 'submitted'
    STATUS_PENDING_SELECTION = 'pending_selection'
    STATUS_SELECTED = 'selected'
    STATUS_REJECTED = 'rejected'

    STATUS_CHOICES = [
        (STATUS_SUBMITTED, 'Basvuru Yapildi'),
        (STATUS_PENDING_SELECTION, 'Secim Bekliyor'),
        (STATUS_SELECTED, 'Aday Secildi'),
        (STATUS_REJECTED, 'Reddedildi'),
    ]

    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name='applications')
    need_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='applications',
    )

    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default=STATUS_SUBMITTED, db_index=True)

    submitted_at = models.DateTimeField(auto_now_add=True, db_index=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['listing', 'need_user'], name='unique_application_per_listing_per_user'),
        ]
        indexes = [
            models.Index(fields=['listing', 'status']),
            models.Index(fields=['need_user', 'status']),
        ]

    def mark_selected(self) -> None:
        self.status = self.STATUS_SELECTED
        self.decided_at = timezone.now()
        self.save(update_fields=['status', 'decided_at'])

    def mark_rejected(self) -> None:
        self.status = self.STATUS_REJECTED
        self.decided_at = timezone.now()
        self.save(update_fields=['status', 'decided_at'])

    def __str__(self) -> str:
        return f'ListingApplication(id={self.id}, listing_id={self.listing_id}, need_user_id={self.need_user_id})'

