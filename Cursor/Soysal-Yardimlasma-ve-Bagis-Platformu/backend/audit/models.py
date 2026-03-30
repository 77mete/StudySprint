from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    """
    PII harici metadata ile surecleri loglamak icin kullanilir.
    """

    class Action(models.TextChoices):
        PROCESS_STATUS_CHANGED = 'process_status_changed'
        ADMIN_REVIEW = 'admin_review'
        CODE_GENERATED = 'code_generated'
        RATING_CREATED = 'rating_created'
        USER_SUSPENDED = 'user_suspended'

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='audit_logs',
    )

    action_type = models.CharField(max_length=80, choices=Action.choices, db_index=True)

    target_type = models.CharField(max_length=120, blank=True)
    target_id = models.CharField(max_length=64, blank=True)

    metadata = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    def __str__(self) -> str:
        return f'AuditLog(action={self.action_type}, id={self.id})'

