from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'action_type', 'actor', 'target_type', 'target_id', 'created_at')
    list_filter = ('action_type', 'created_at')
    search_fields = ('target_type', 'target_id', 'metadata')
    raw_id_fields = ('actor',)
