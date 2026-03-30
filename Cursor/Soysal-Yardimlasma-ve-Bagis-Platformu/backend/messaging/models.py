from django.conf import settings
from django.db import models

from processes.models import DonationProcess


class ProcessMessage(models.Model):
    """
    Mesajlar, process baglaminda tutulur; taraflar arasinda PII gostermemeye yardimci olur.
    (PII engeli: UI + API filtreleri + yetkilendirme katmaninda saglanir.)
    """

    process = models.ForeignKey(DonationProcess, on_delete=models.CASCADE, related_name='messages', db_index=True)

    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_process_messages',
        db_index=True,
    )
    receiver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_process_messages',
        db_index=True,
    )

    body = models.TextField()

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['process', 'created_at']),
        ]

    def __str__(self) -> str:
        return f'ProcessMessage(id={self.id}, process_id={self.process_id})'

