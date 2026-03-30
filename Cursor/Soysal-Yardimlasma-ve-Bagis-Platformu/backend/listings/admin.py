from django.contrib import admin

from .models import Listing


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = ('id', 'donor', 'category', 'title', 'status', 'created_at')
    list_filter = ('category', 'status')
    search_fields = ('title', 'description', 'donor__username')
    raw_id_fields = ('donor',)
