from django.conf import settings
from django.db import models


class Listing(models.Model):
    """
    Bagisci tarafindan olusturulan bagis ilani.
    """

    class Category(models.TextChoices):
        CLOTHING = 'giysi', 'Giysi'
        BOOK = 'kitap', 'Kitap'
        ELECTRONIC = 'elektronik', 'Elektronik'
        OTHER = 'diger', 'Diger'

    STATUS_ACTIVE = 'active'
    STATUS_PAUSED = 'paused'
    STATUS_DELETED = 'deleted'
    STATUS_CHOICES = [
        (STATUS_ACTIVE, 'Aktif'),
        (STATUS_PAUSED, 'Beklemede'),
        (STATUS_DELETED, 'Silindi'),
    ]

    donor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='donor_listings',
    )

    category = models.CharField(max_length=32, choices=Category.choices, db_index=True)
    title = models.CharField(max_length=120, blank=True)
    description = models.TextField()

    primary_image = models.ImageField(upload_to='listings/images/', blank=True, null=True)

    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_ACTIVE, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['category', 'status']),
        ]

    def __str__(self) -> str:
        return f'Listing(id={self.id}, category={self.category})'

