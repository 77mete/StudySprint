from django.conf import settings
from django.db import models

from processes.models import DonationProcess


class ProcessRating(models.Model):
    """
    Tamamlanmis islem sonrasi puanlama.
    PRD: Her iki taraf sureci degerlendirir; bir taraf ayni surec icin bir kez puanlar.
    """

    value_min = 1
    value_max = 5

    process = models.ForeignKey(DonationProcess, on_delete=models.CASCADE, related_name='ratings', db_index=True)

    given_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='given_process_ratings',
        db_index=True,
    )
    given_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_process_ratings',
        db_index=True,
    )

    value = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['process', 'given_by'], name='unique_rating_per_process_per_giver'),
        ]

    def __str__(self) -> str:
        return f'ProcessRating(process_id={self.process_id}, given_by_id={self.given_by_id}, value={self.value})'

