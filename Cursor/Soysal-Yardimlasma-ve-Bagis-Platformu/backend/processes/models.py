from django.conf import settings
from django.db import models
from soyalsite.encrypted_fields import EncryptedTextField

from applications.models import ListingApplication


class DonationProcess(models.Model):
    """
    Tek bir basvuru/aday secimi sonucunda olusan transaksi/surec kaydi.
    """

    STATUS_CODE_PENDING = 'code_pending'
    STATUS_CODE_GENERATED = 'code_generated'
    STATUS_SHIPPED = 'shipped'
    STATUS_DELIVERED = 'delivered'
    STATUS_COMPLETED = 'completed'

    STATUS_CHOICES = [
        (STATUS_CODE_PENDING, 'Kargo kodu bekliyor'),
        (STATUS_CODE_GENERATED, 'Kargo kodu olusturuldu'),
        (STATUS_SHIPPED, 'Kargoya verildi'),
        (STATUS_DELIVERED, 'Teslim alindi'),
        (STATUS_COMPLETED, 'Tamamlandi'),
    ]

    application = models.OneToOneField(
        ListingApplication,
        on_delete=models.CASCADE,
        related_name='process',
    )

    shipping_code = models.CharField(max_length=32, unique=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_CODE_PENDING, db_index=True)

    # Encrypted destination snapshot (so address updates do not affect code validity).
    destination_name = models.CharField(max_length=120, blank=True)
    destination_phone_enc = EncryptedTextField(blank=True, null=True)
    destination_address_enc = EncryptedTextField(blank=True, null=True)

    code_generated_at = models.DateTimeField(null=True, blank=True, db_index=True)
    shipped_at = models.DateTimeField(null=True, blank=True, db_index=True)
    delivered_at = models.DateTimeField(null=True, blank=True, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['status']),
        ]

    @property
    def donor(self):
        return self.application.listing.donor

    @property
    def need_user(self):
        return self.application.need_user

    def __str__(self) -> str:
        return f'DonationProcess(id={self.id}, status={self.status})'

