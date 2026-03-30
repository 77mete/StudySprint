from django.contrib import admin

from .models import DonationProcess


@admin.register(DonationProcess)
class DonationProcessAdmin(admin.ModelAdmin):
    list_display = ('id', 'application', 'shipping_code', 'status', 'code_generated_at', 'created_at')
    list_filter = ('status',)
    search_fields = ('shipping_code', 'application__listing__title', 'application__need_user__username')
    raw_id_fields = ('application',)
