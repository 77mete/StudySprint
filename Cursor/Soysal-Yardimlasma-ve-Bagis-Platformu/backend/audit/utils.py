from __future__ import annotations

from typing import Any

from django.contrib.auth import get_user_model

from .models import AuditLog

User = get_user_model()


def create_audit_log(
    *,
    actor: User | None,
    action_type: str,
    target_type: str = "",
    target_id: str = "",
    metadata: dict[str, Any] | None = None,
) -> AuditLog:
    metadata = metadata or {}
    return AuditLog.objects.create(
        actor=actor,
        action_type=action_type,
        target_type=target_type,
        target_id=target_id,
        metadata=metadata,
    )

