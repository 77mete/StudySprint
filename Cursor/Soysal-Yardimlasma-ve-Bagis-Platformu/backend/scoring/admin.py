from django.contrib import admin

from .models import ProcessRating


@admin.register(ProcessRating)
class ProcessRatingAdmin(admin.ModelAdmin):
    list_display = ('id', 'process', 'given_by', 'given_to', 'value', 'created_at')
    list_filter = ('value', 'created_at')
    search_fields = ('process__shipping_code', 'given_by__username', 'given_to__username')
    raw_id_fields = ('process', 'given_by', 'given_to')
