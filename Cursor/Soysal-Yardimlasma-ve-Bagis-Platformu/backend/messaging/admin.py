from django.contrib import admin

from .models import ProcessMessage


@admin.register(ProcessMessage)
class ProcessMessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'process', 'sender', 'receiver', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('body', 'sender__username', 'receiver__username', 'process__shipping_code')
    raw_id_fields = ('process', 'sender', 'receiver')
