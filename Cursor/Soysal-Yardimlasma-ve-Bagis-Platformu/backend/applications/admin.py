from django.contrib import admin

from .models import ListingApplication


@admin.register(ListingApplication)
class ListingApplicationAdmin(admin.ModelAdmin):
    list_display = ('id', 'listing', 'need_user', 'status', 'submitted_at', 'decided_at')
    list_filter = ('status',)
    search_fields = ('need_user__username', 'listing__title', 'listing__description')
    raw_id_fields = ('listing', 'need_user')
