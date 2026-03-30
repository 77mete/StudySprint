from django.contrib import admin

from .models import ModerationTicket


@admin.register(ModerationTicket)
class ModerationTicketAdmin(admin.ModelAdmin):
    list_display = ('id', 'process', 'reporter', 'ticket_type', 'status', 'created_at', 'reviewed_by', 'reviewed_at')
    list_filter = ('status', 'ticket_type', 'created_at')
    search_fields = ('reason', 'process__shipping_code', 'reporter__username')
    raw_id_fields = ('process', 'reporter', 'reviewed_by')
